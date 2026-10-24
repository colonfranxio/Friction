/**
 * Drives the real background.ts message handlers against the real mock API (started in-process),
 * with a minimal chrome.* stub. Proves the service worker ⇄ API path end to end, minus the browser.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_PROMPTS, SEED_IDS } from '@friction/shared';
import type { InterceptRuntimeResult } from '../src/background-types';
import type { BypassResult, RuntimeRequest, StatusResponse } from '../src/lib/messages';

// FRICTION_API_URL=<url> runs these against a real API (see test/run-against-api.mjs); default = in-process mock.
const EXTERNAL = process.env.FRICTION_API_URL?.replace(/\/$/, '');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const API = EXTERNAL ?? `http://127.0.0.1:${PORT}`;
let listener: (msg: unknown, sender: unknown, send: (r: unknown) => void) => boolean;
const store: Record<string, unknown> = {};

function call<T>(msg: RuntimeRequest): Promise<T> {
  return new Promise((resolve) => listener(msg, {}, (r) => resolve(r as T)));
}

beforeAll(async () => {
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: async (keys: string | string[]) =>
          Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((k) => k in store).map((k) => [k, store[k]])),
        set: async (patch: Record<string, unknown>) => Object.assign(store, patch),
      },
    },
    runtime: {
      onMessage: { addListener: (fn: typeof listener) => (listener = fn) },
      getManifest: () => ({ version: 'test' }),
    },
  };
  if (!EXTERNAL) {
    process.env.DEMO_MODE = '1';
    process.argv.push('--port', String(PORT));
    await import('../../../scripts/mock-api');
  }
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${API}/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  // Start from seed state (needs DEMO_MODE=1 on the server).
  const reset = await fetch(`${API}/demo/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ full: true }) }).catch(() => {
    throw new Error(`cannot reach ${API}: is the API running?`);
  });
  if (!reset.ok) throw new Error(`demo reset failed (${reset.status}): is DEMO_MODE=1 on ${API}?`);
  store.apiUrl = API;
  store.studentId = SEED_IDS.demoStudent;
  await import('../src/background');
});

afterAll(async () => {
  await fetch(`${API}/demo/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ full: true }) }).catch(() => {});
  delete (globalThis as any).chrome;
});

describe('background ⇄ mock API', () => {
  it('reports online status and bypass quota', async () => {
    const s = await call<StatusResponse>({ type: 'friction:status' });
    expect(s.online).toBe(true);
    expect(s.bypass_quota).toBe(3);
    expect(s.enabled).toBe(true);
  });

  it('intercepts a course question with L1 friction', async () => {
    const r = await call<InterceptRuntimeResult>({
      type: 'friction:intercept',
      raw_prompt: DEMO_PROMPTS.question,
      conversation_id: 'conv-bg-1',
      previous_assistant_text: null,
    });
    expect(r.outcome.passthrough).toBe(false);
    if (r.outcome.passthrough) return;
    expect(r.outcome.response.level).toBe(1);
    expect(r.outcome.response.node_id).toBe(SEED_IDS.nodes.useEffect);
    expect(r.outcome.response.injected_prompt.startsWith(DEMO_PROMPTS.question)).toBe(true);

    // Concept names load lazily; the status call fills them in.
    const s = await call<StatusResponse>({ type: 'friction:status' });
    expect(s.last?.concept_name).toBe('React useEffect');
  });

  it('a correct answer (quiz text read from the page) moves the student to L4', async () => {
    const r = await call<InterceptRuntimeResult>({
      type: 'friction:intercept',
      raw_prompt: DEMO_PROMPTS.correctAnswer,
      conversation_id: 'conv-bg-1',
      previous_assistant_text: 'Quick check: what does the dependency array tell React?',
    });
    expect(r.outcome.passthrough).toBe(false);
    if (!r.outcome.passthrough) expect(r.outcome.response.graded?.verdict).toBe('correct');
    const again = await call<InterceptRuntimeResult>({
      type: 'friction:intercept',
      raw_prompt: DEMO_PROMPTS.question,
      conversation_id: 'conv-bg-2',
      previous_assistant_text: null,
    });
    if (!again.outcome.passthrough) expect(again.outcome.response.level).toBe(4);
  });

  it('off-topic prompts pass through', async () => {
    const r = await call<InterceptRuntimeResult>({
      type: 'friction:intercept',
      raw_prompt: 'write a haiku about the sea',
      conversation_id: 'conv-bg-3',
      previous_assistant_text: null,
    });
    expect(r.outcome).toEqual({ passthrough: true, reason: 'no_match' });
  });

  it('bypass uses the last intercepted concept and reports the quota', async () => {
    await call({ type: 'friction:intercept', raw_prompt: DEMO_PROMPTS.bypassQuestion, conversation_id: 'conv-bg-4', previous_assistant_text: null });
    const b = await call<BypassResult>({ type: 'friction:bypass' });
    expect(b).toEqual({ ok: true, remaining_quota: 2 });
    const s = await call<StatusResponse>({ type: 'friction:status' });
    expect(s.paused).toBe(true);
    expect(s.bypass_quota).toBe(2);
  });

  it('off-topic prompts keep the last concept for the bypass button', async () => {
    const before = await call<StatusResponse>({ type: 'friction:status' });
    await call({ type: 'friction:intercept', raw_prompt: 'tell me a joke', conversation_id: 'conv-bg-5', previous_assistant_text: null });
    const after = await call<StatusResponse>({ type: 'friction:status' });
    expect(after.last?.node_id).toBe(before.last?.node_id);
    expect(after.last?.node_id).toBeTruthy();
  });

  it('status makes no API call when consent is off', async () => {
    store.enabled = false;
    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async (...a: Parameters<typeof fetch>) => { calls++; return realFetch(...a); }) as typeof fetch;
    const s = await call<StatusResponse>({ type: 'friction:status' });
    globalThis.fetch = realFetch;
    expect(calls).toBe(0);
    expect(s.enabled).toBe(false);
    store.enabled = true;
  });

  it('the consent toggle stops all API calls', async () => {
    store.enabled = false;
    const r = await call<InterceptRuntimeResult>({ type: 'friction:intercept', raw_prompt: DEMO_PROMPTS.question, conversation_id: null, previous_assistant_text: null });
    expect(r.outcome).toEqual({ passthrough: true, reason: 'disabled' });
    store.enabled = true;
  });

  it('fails open (offline) when the API is unreachable', async () => {
    store.apiUrl = 'http://127.0.0.1:1';
    const r = await call<InterceptRuntimeResult>({ type: 'friction:intercept', raw_prompt: DEMO_PROMPTS.question, conversation_id: null, previous_assistant_text: null });
    expect(r.outcome).toEqual({ passthrough: true, reason: 'offline' });
    const s = await call<StatusResponse>({ type: 'friction:status' });
    expect(s.online).toBe(false);
    store.apiUrl = API;
  });
});
