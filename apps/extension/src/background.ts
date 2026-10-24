/**
 * MV3 service worker. The ONLY context that calls our API (host_permissions bypass page CSP).
 * Keeps no state in memory that matters: settings + last intercept live in chrome.storage.
 */
import { ApiError, EXTENSION_TIMEOUT_MS, createFrictionClient, type FrictionClient, type UUID } from '@friction/shared';
import type { InterceptRuntimeResult } from './background-types';
import type { BypassResult, LastIntercept, RuntimeRequest, StatusResponse } from './lib/messages';
import { getLastIntercept, getSettings, setLastIntercept } from './lib/storage';

const API_BUDGET_MS = EXTENSION_TIMEOUT_MS - 500; // leave room for the content ⇄ worker hop

// ---- concept names (node_id → concept_name), refreshed lazily ----
let concepts = new Map<UUID, string>();
let conceptsFor = '';
let refreshing: Promise<void> | null = null;

function refreshConcepts(client: FrictionClient, studentId: string): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const s = await client.getStudent(studentId);
      if (!s.tree_id) return;
      const tree = await client.getTree(s.tree_id);
      concepts = new Map(tree.nodes.map((n) => [n.id, n.concept_name]));
      conceptsFor = `${client.baseUrl}|${studentId}`;
    } catch {
      /* offline: keep the old map */
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function conceptName(client: FrictionClient, studentId: string, nodeId: UUID | null): string | null {
  if (!nodeId) return null;
  const key = `${client.baseUrl}|${studentId}`;
  if (conceptsFor !== key || !concepts.has(nodeId)) void refreshConcepts(client, studentId);
  return conceptsFor === key ? concepts.get(nodeId) ?? null : null;
}

// ---- handlers ----
async function handleIntercept(m: Extract<RuntimeRequest, { type: 'friction:intercept' }>): Promise<InterceptRuntimeResult> {
  const s = await getSettings();
  if (!s.enabled) return { outcome: { passthrough: true, reason: 'disabled' }, concept_name: null };
  const client = createFrictionClient(s.apiUrl);
  try {
    const r = await client.intercept(
      {
        student_id: s.studentId,
        raw_prompt: m.raw_prompt,
        app_source: 'claude_web',
        conversation_id: m.conversation_id,
        previous_assistant_text: m.previous_assistant_text,
      },
      AbortSignal.timeout(API_BUDGET_MS),
    );
    let concept = conceptName(client, s.studentId, r.node_id);
    if (r.node_id && !concept) {
      // First intercept: give the name map a moment so the badge can show the concept.
      await Promise.race([refreshConcepts(client, s.studentId), new Promise((res) => setTimeout(res, 400))]);
      concept = concepts.get(r.node_id) ?? null;
    }
    const last: LastIntercept = {
      node_id: r.node_id,
      level: r.level,
      concept_name: concept,
      intercept_id: r.intercept_id,
      at: new Date().toISOString(),
    };
    if (r.node_id) await setLastIntercept(last); // off-topic prompts keep the last concept (bypass target)
    if (!r.node_id) return { outcome: { passthrough: true, reason: 'no_match' }, concept_name: null };
    return { outcome: { passthrough: false, response: r }, concept_name: concept };
  } catch (err) {
    console.warn('[friction] intercept failed, passing prompt through', err);
    return { outcome: { passthrough: true, reason: err instanceof ApiError ? 'error' : 'offline' }, concept_name: null };
  }
}

async function handleStatus(): Promise<StatusResponse> {
  const s = await getSettings();
  if (!s.enabled) {
    // Consent off: contract §11, no API calls at all.
    return { online: false, enabled: false, studentId: s.studentId, apiUrl: s.apiUrl, bypass_quota: null, last: await getLastIntercept(), paused: false };
  }
  const client = createFrictionClient(s.apiUrl);
  let last = await getLastIntercept();
  let online = false;
  let quota: number | null = null;
  let paused = false;
  try {
    const student = await Promise.race([
      client.getStudent(s.studentId),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
    ]);
    online = true;
    quota = student.user.bypass_quota;
    if (last?.node_id) {
      paused = !!student.states.find((x) => x.node_id === last!.node_id)?.paused;
      if (!last.concept_name) {
        await refreshConcepts(client, s.studentId);
        last = { ...last, concept_name: concepts.get(last.node_id) ?? null };
      }
    }
  } catch {
    online = false;
  }
  return { online, enabled: s.enabled, studentId: s.studentId, apiUrl: s.apiUrl, bypass_quota: quota, last, paused };
}

async function handleBypass(m: Extract<RuntimeRequest, { type: 'friction:bypass' }>): Promise<BypassResult> {
  const s = await getSettings();
  // Consent off: contract §11, no API calls at all (guards queued/programmatic messages too, not only the buttons).
  if (!s.enabled) return { ok: false, code: 'disabled', message: 'Friction is turned off.' };
  const nodeId = m.node_id ?? (await getLastIntercept())?.node_id;
  if (!nodeId) return { ok: false, code: 'no_concept', message: 'Ask Claude something first so Friction knows the concept.' };
  const scope = m.scope ?? 'prompt'; // v4: per-prompt by default; the extension resends to claude.ai itself (no token fields)
  const client = createFrictionClient(s.apiUrl);
  /** The node's paused flag, or null if it can't be read within 1.5s. */
  const pausedNow = async (): Promise<boolean | null> => {
    try {
      const st = await Promise.race([
        client.getStudent(s.studentId),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500)),
      ]);
      return !!st.states.find((x) => x.node_id === nodeId)?.paused;
    } catch {
      return null;
    }
  };
  try {
    // A pre-v4 server ignores `scope` and pauses the concept. Read `paused` before and after so the UI only
    // says "concept" when THIS bypass caused the pause (false → true), and makes no claim if it can't tell.
    const before = scope === 'prompt' ? await pausedNow() : null;
    const r = await client.bypass({ student_id: s.studentId, node_id: nodeId, scope });
    let applied: 'prompt' | 'concept' | 'unknown' = scope;
    if (scope === 'prompt') {
      const after = await pausedNow();
      if (before === null || after === null) applied = 'unknown';
      else if (!before && after) applied = 'concept';
    }
    return { ok: true, remaining_quota: r.remaining_quota, scope_applied: applied };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, code: err.code, message: err.code === 'quota_exhausted' ? 'No bypasses left.' : err.message };
    return { ok: false, code: 'offline', message: 'Friction server is unreachable.' };
  }
}

chrome.runtime.onMessage.addListener((msg: RuntimeRequest, _sender, sendResponse) => {
  const handle = (): Promise<unknown> => {
    switch (msg?.type) {
      case 'friction:intercept':
        return handleIntercept(msg);
      case 'friction:status':
        return handleStatus();
      case 'friction:bypass':
        return handleBypass(msg);
      default:
        return Promise.resolve(undefined);
    }
  };
  handle().then(sendResponse, (err) => sendResponse({ error: String(err) }));
  return true; // async response
});
