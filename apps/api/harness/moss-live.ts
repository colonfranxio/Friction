/**
 * Paid, opt-in Moss evidence run (handoff Step 5). Private HTTP servers on ephemeral ports and
 * memory-only stores; never touches :8787 or apps/api/data/db.json.
 * Output: harness/results/<timestamp>-<sha>/moss-live.json (one directory per run).
 * Sections: `live` = real Moss + real Claude; `injected` = test doubles for Moss + real Claude;
 * `config` = genuine missing-credential startup.
 */
import { serve } from '@hono/node-server';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAT_HEADERS, DEMO_PROMPTS, SEED_IDS } from '@friction/shared';
import { createApp } from '../src/app';
import { createCtx } from '../src/bootstrap';
import { loadConfig } from '../src/env';
import { loadIntelligence, type LoadedIntelligence } from '../src/intelligence';
import type { CurriculumIndex, RetrievalTrace } from '../src/services/moss-runtime';
import { createJsonStore } from '../src/store/json-store';

type Store = ReturnType<typeof createJsonStore>;
const THEME = 'How do I share the selected theme with deeply nested descendants without passing it through every layer?';
const ANSWER = 'You create it once with createContext, wrap the subtree in ThemeContext.Provider with value={theme}, ' +
  'and any nested component reads it with useContext(ThemeContext), so no intermediate layer has to pass it down.';
const UNRELATED = 'Can you suggest a good banana bread recipe for this weekend?';

let stage = 'configuration';
const sha = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();
const dirty = (() => { try { return execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim() !== ''; } catch { return true; } })();
const report = {
  timestamp: new Date().toISOString(), sha, dirtyWorkingTree: dirty,
  models: { classify: process.env.MODEL_CLASSIFY, chat: process.env.MODEL_CHAT, grade: process.env.MODEL_GRADE },
  live: [] as object[], injected: [] as object[], config: [] as object[], status: 'running' as string, failedStage: undefined as string | undefined,
};
type Section = 'live' | 'injected' | 'config';
function record(section: Section, value: object) { report[section].push(value); console.log(`[${section}] ${JSON.stringify(value)}`); }
// Never print provider exceptions, headers or credentials from this diagnostic process.
console.error = () => {};
class CheckFailed extends Error {}
function check(value: unknown, label: string): asserts value {
  if (!value) throw new CheckFailed(label);
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitUntil(predicate: () => boolean, timeout: number, label: string) {
  const until = Date.now() + timeout;
  while (!predicate() && Date.now() < until) await sleep(100);
  check(predicate(), label);
}

async function privateServer(store: Store, loaded: LoadedIntelligence) {
  const config = loadConfig({ API_PORT: '0', DEMO_MODE: '1', USE_REAL_INTELLIGENCE: '1' });
  const ctx = createCtx({ config, intel: loaded.intel, intelligenceMode: 'real', store });
  const server = serve({ fetch: createApp(ctx).fetch, hostname: '127.0.0.1', port: 0 });
  if (!server.listening) await once(server, 'listening');
  const address = server.address();
  check(address && typeof address !== 'string', 'HTTP binding');
  const base = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: object, ms = 60_000) => fetch(`${base}${path}`, { method: 'POST',
    signal: AbortSignal.timeout(ms), headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const intercept = async (conversation_id: string, raw_prompt: string) => {
    const res = await post('/intercept', { student_id: SEED_IDS.demoStudent, conversation_id, app_source: 'sandbox', raw_prompt }, 15_000);
    check(res.ok, `intercept HTTP ${res.status}`);
    return await res.json() as { node_id: string | null; level: number | null; injected_prompt: string; quiz_attached: boolean };
  };
  return { base, post, intercept, close: async () => {
    if ('closeAllConnections' in server) server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await loaded.close();
  } };
}

async function setup(env: NodeJS.ProcessEnv, load?: Parameters<typeof loadIntelligence>[1]['load']) {
  const store = createJsonStore(null);
  const traces: RetrievalTrace[] = [];
  const loaded = await loadIntelligence(true, { store, env, load, trace: (e) => traces.push(e) });
  const server = await privateServer(store, loaded);
  const node = (name: string) => store.db.nodes.find((n) => n.concept_name === name)!;
  const names = (ids: string[] = []) => ids.map((id) => store.db.nodes.find((n) => n.id === id)?.concept_name ?? 'unknown');
  return { store, traces, loaded, server, node, names };
}

async function live(env: NodeJS.ProcessEnv) {
  const t = await setup(env);
  try {
    stage = 'live:warmup';
    t.loaded.start();
    const health = await fetch(`${t.server.base}/health`);
    check(health.ok, 'health during warmup');
    await health.body?.cancel();
    record('live', { step: 'available_during_warmup', http: health.status });
    await waitUntil(() => t.traces.some((e) => e.state === 'ready'), 60_000, 'background preparation deadline');
    record('live', { step: 'ready', ...t.traces.find((e) => e.state === 'ready') });

    stage = 'live:keyword_control';
    let mark = t.traces.length;
    const kw = await t.server.intercept('moss-live-keyword', DEMO_PROMPTS.question);
    check(kw.node_id === t.node('React useEffect').id, 'keyword control node');
    check(t.traces.length === mark, 'keyword hit must not query Moss');
    record('live', { step: 'keyword_control_pass', concept: 'React useEffect', mossQueries: 0 });

    stage = 'live:retrieval_chat';
    const context = t.node('Context API');
    const before = structuredClone(t.store.db.states);
    mark = t.traces.length;
    const res = await t.server.post('/chat', { student_id: SEED_IDS.demoStudent, conversation_id: 'moss-live-theme',
      messages: [{ role: 'user', content: THEME }] });
    const reply = await res.text();
    const retrieved = t.traces.slice(mark).find((e) => e.state === 'retrieved');
    check(res.ok && reply.trim(), 'live chat');
    check(retrieved?.ids?.includes(context.id), 'Context API among Moss candidates');
    check(res.headers.get(CHAT_HEADERS.nodeId) === context.id, 'Claude chose Context API');
    check(JSON.stringify(t.store.db.states) === JSON.stringify(before), 'retrieval does not change mastery or quota');
    const log = t.store.db.logs.find((l) => l.conversation_id === 'moss-live-theme');
    check(log?.llm_response === reply, 'complete assistant reply stored');
    record('live', { step: 'retrieval_chat_pass', candidates: t.names(retrieved!.ids), retrievalMs: retrieved!.ms,
      selected: context.concept_name, level: res.headers.get(CHAT_HEADERS.level),
      quizAttached: res.headers.get(CHAT_HEADERS.quizAttached), masteryUnchanged: true,
      replyCharacters: reply.length, replyExcerpt: reply.slice(0, 400) });

    stage = 'live:pending_quiz_answer';
    mark = t.traces.length;
    const answer = await t.server.post('/chat', { student_id: SEED_IDS.demoStudent, conversation_id: 'moss-live-theme',
      messages: [{ role: 'user', content: THEME }, { role: 'assistant', content: reply }, { role: 'user', content: ANSWER }] });
    const answerReply = await answer.text();
    check(answer.ok && answerReply.trim(), 'answer turn');
    check(answer.headers.get(CHAT_HEADERS.nodeId) === context.id, 'pending quiz keeps Context API');
    check(t.traces.length === mark, 'pending quiz bypasses classification and Moss');
    await waitUntil(() => !!log!.verdict, 30_000, 'grade recorded');
    const state = t.store.db.states.find((s) => s.student_id === SEED_IDS.demoStudent && s.node_id === context.id);
    record('live', { step: 'pending_quiz_pass', concept: context.concept_name, mossQueries: 0, verdict: log!.verdict,
      levelBefore: Number(res.headers.get(CHAT_HEADERS.level)), levelAfter: state?.current_blooms_level });

    stage = 'live:unrelated';
    mark = t.traces.length;
    const off = await t.server.intercept('moss-live-unrelated', UNRELATED);
    const offTrace = t.traces.slice(mark).find((e) => e.state === 'retrieved' || e.state === 'fallback');
    check(off.node_id === null && off.injected_prompt === UNRELATED, 'Claude abstains on unrelated prompt');
    record('live', { step: 'unrelated_abstain_pass', mossCandidates: t.names(offTrace?.ids), selected: null });
  } finally { await t.server.close(); }
}

async function injected(env: NodeJS.ProcessEnv) {
  const module = await import('@friction/intelligence');
  const doubles: Record<string, () => CurriculumIndex> = {
    init_failure: () => new module.MossCurriculumRetriever(async () => { throw new Error('injected init failure'); }),
    query_timeout: () => ({ prepare: async () => true, retrieve: () => new Promise<string[]>(() => {}), close: async () => {} }),
  };
  for (const [fault, make] of Object.entries(doubles)) {
    stage = `injected:${fault}`;
    const t = await setup(env, async () => ({ ...module, mossFromEnv: () => make() as InstanceType<typeof module.MossCurriculumRetriever> }));
    try {
      t.loaded.start();
      await waitUntil(() => t.traces.some((e) => e.state === (fault === 'init_failure' ? 'fallback' : 'ready')), 5000, `${fault} warmup`);
      const r = await t.server.intercept(`moss-injected-${fault}`, THEME);
      check(r.node_id === t.node('Context API').id, `${fault}: baseline classifier`);
      check(r.injected_prompt.includes('Learning goal:'), `${fault}: policy applied`);
      check(!t.traces.some((e) => e.state === 'retrieved'), `${fault}: no Moss hints`);
      const reason = fault === 'query_timeout' ? t.traces.at(-1)?.reason : t.traces.find((e) => e.state === 'fallback')?.reason;
      record('injected', { step: `${fault}_fallback_pass`, fallbackReason: reason, selected: 'Context API', claude: 'real' });
    } finally { await t.server.close(); }
  }
}

async function config() {
  stage = 'config:missing_credentials';
  const { MOSS_PROJECT_ID: _id, MOSS_PROJECT_KEY: _key, ...rest } = process.env;
  const t = await setup({ ...rest, USE_MOSS_RETRIEVAL: '1' });
  try {
    t.loaded.start();
    check(t.traces.some((e) => e.state === 'disabled' && e.reason === 'credentials'), 'disabled trace');
    const r = await t.server.intercept('moss-config', DEMO_PROMPTS.question);
    check(r.node_id === t.node('React useEffect').id, 'API works without Moss credentials');
    record('config', { step: 'missing_credentials_pass', trace: 'disabled/credentials', apiServing: true });
  } finally { await t.server.close(); }
}

async function main() {
  check(process.env.MOSS_PROJECT_ID && process.env.MOSS_PROJECT_KEY && process.env.ANTHROPIC_API_KEY &&
    process.env.MODEL_CLASSIFY && process.env.MODEL_CHAT && process.env.MODEL_GRADE, 'required configuration');
  const env = { ...process.env, USE_MOSS_RETRIEVAL: '1' };
  await live(env);
  await injected(env);
  await config();
  report.status = 'complete';
}
main().catch((e: unknown) => { report.status = 'failed'; report.failedStage = e instanceof CheckFailed ? `${stage}: ${e.message}` : stage; console.log(`[failed] ${report.failedStage}`); process.exitCode = 1; })
  .finally(() => {
    const dir = fileURLToPath(new URL(`./results/${report.timestamp.replace(/[:.]/g, '-')}-${sha.slice(0, 7)}/`, import.meta.url));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'moss-live.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`[report] ${dir}`);
  });
