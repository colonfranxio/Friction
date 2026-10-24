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
    expect(b).toEqual({ ok: true, remaining_quota: 2, scope_applied: 'prompt' }); // v4 default: per-prompt
    const s = await call<StatusResponse>({ type: 'friction:status' });
    expect(s.paused).toBe(false); // prompt scope never pauses the concept
    expect(s.bypass_quota).toBe(2);
  });

  it('bypass targets the node the content script names', async () => {
    const before = await call<StatusResponse>({ type: 'friction:status' });
    const b = await call<BypassResult>({ type: 'friction:bypass', node_id: SEED_IDS.nodes.useEffect });
    expect(b).toEqual({ ok: true, remaining_quota: (before.bypass_quota ?? 0) - 1, scope_applied: 'prompt' });
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

  it('v4: a prompt-scoped bypass spends quota but does NOT pause the concept', async () => {
    await fetch(`${API}/demo/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ student_id: SEED_IDS.demoStudent }) });
    const before = await call<StatusResponse>({ type: 'friction:status' });
    const b = await call<BypassResult>({ type: 'friction:bypass', node_id: SEED_IDS.nodes.useEffect, scope: 'prompt' });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.scope_applied).toBe('prompt');
    expect(b.remaining_quota).toBe((before.bypass_quota ?? 0) - 1);
    const st = await (await fetch(`${API}/students/${SEED_IDS.demoStudent}`)).json();
    expect(st.states.find((x: { node_id: string }) => x.node_id === SEED_IDS.nodes.useEffect).paused).toBe(false);
  });

  it('v4: a concept-scoped bypass pauses the concept and reports it', async () => {
    await fetch(`${API}/demo/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ student_id: SEED_IDS.demoStudent }) });
    const b = await call<BypassResult>({ type: 'friction:bypass', node_id: SEED_IDS.nodes.dataFetching, scope: 'concept' });
    expect(b.ok && b.scope_applied).toBe('concept');
    const st = await (await fetch(`${API}/students/${SEED_IDS.demoStudent}`)).json();
    expect(st.states.find((x: { node_id: string }) => x.node_id === SEED_IDS.nodes.dataFetching).paused).toBe(true);
  });

  /** Make the in-process mock look like the real API (server:'api') and record /bypass request bodies. */
  async function asRealApi<T>(fn: (bodies: Array<Record<string, unknown>>) => Promise<T>): Promise<T> {
    const realFetch = globalThis.fetch;
    const bodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/bypass') && init?.body) bodies.push(JSON.parse(String(init.body)));
      const res = await realFetch(input, init);
      if (!url.endsWith('/health')) return res;
      const h = await res.json();
      return new Response(JSON.stringify({ ...h, mode: { ...h.mode, server: 'api' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    try {
      return await fn(bodies);
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  it('gate: a real API without an API READY SHA gets the legacy payload (no scope field) → concept', async () => {
    await fetch(`${API}/demo/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ student_id: SEED_IDS.demoStudent }) });
    store.promptBypassReadySha = '';
    await asRealApi(async (bodies) => {
      const s = await call<StatusResponse>({ type: 'friction:status' });
      expect(s.prompt_bypass).toBe(false);
      const b = await call<BypassResult>({ type: 'friction:bypass', node_id: SEED_IDS.nodes.useEffect, scope: 'prompt' });
      expect(b.ok && b.scope_applied).toBe('concept');
      expect(bodies).toHaveLength(1);
      expect('scope' in bodies[0]).toBe(false); // never send new fields to an uncertified server
    });
  });

  it('gate: a real API WITH an exact API READY SHA gets scope "prompt"', async () => {
    await fetch(`${API}/demo/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ student_id: SEED_IDS.demoStudent }) });
    store.promptBypassReadySha = 'd52e791' + 'a'.repeat(33);
    try {
      await asRealApi(async (bodies) => {
        const s = await call<StatusResponse>({ type: 'friction:status' });
        expect(s.prompt_bypass).toBe(true);
        const b = await call<BypassResult>({ type: 'friction:bypass', node_id: SEED_IDS.nodes.useEffect, scope: 'prompt' });
        expect(b.ok && b.scope_applied).toBe('prompt');
        expect(bodies[0]).toMatchObject({ scope: 'prompt' });
        expect('raw_prompt' in bodies[0] || 'conversation_id' in bodies[0]).toBe(false); // D resends itself: no token binding
      });
    } finally {
      store.promptBypassReadySha = '';
    }
  });

  it('gate: if /health fails, the bypass falls back to the legacy payload (no scope) → concept', async () => {
    await fetch(`${API}/demo/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ student_id: SEED_IDS.demoStudent }) });
    const realFetch = globalThis.fetch;
    const bodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/health')) throw new TypeError('health down');
      if (url.endsWith('/bypass') && init?.body) bodies.push(JSON.parse(String(init.body)));
      return realFetch(input, init);
    }) as typeof fetch;
    try {
      const b = await call<BypassResult>({ type: 'friction:bypass', node_id: SEED_IDS.nodes.useEffect, scope: 'prompt' });
      expect(b.ok && b.scope_applied).toBe('concept');
      expect(bodies).toHaveLength(1);
      expect('scope' in bodies[0]).toBe(false);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('bypass makes no API call when consent is off', async () => {
    store.enabled = false;
    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async (...a: Parameters<typeof fetch>) => { calls++; return realFetch(...a); }) as typeof fetch;
    const b = await call<BypassResult>({ type: 'friction:bypass', node_id: SEED_IDS.nodes.useEffect });
    globalThis.fetch = realFetch;
    store.enabled = true;
    expect(calls).toBe(0);
    expect(b).toEqual({ ok: false, code: 'disabled', message: 'Friction is turned off.' });
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
