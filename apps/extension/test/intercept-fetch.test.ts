import { describe, expect, it, vi } from 'vitest';
import { claudeAdapter } from '../src/adapters/claude';
import { createPatchedFetch, type PatchDeps } from '../src/lib/intercept-fetch';
import type { InterceptOutcome } from '../src/lib/messages';
import { fixtureJson, fixtureText } from './helpers';

const req = fixtureJson('request-followup.json');
const SSE = fixtureText('response-messages.sse.txt');
const RAW = req.body.prompt as string;
const INJECTED = `${RAW}\n\n⟦friction⟧\nLevel: 1 (Socratic)\n⟦/friction⟧`;

function sseResponse() {
  return new Response(SSE, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function setup(outcome: InterceptOutcome | Error, opts: { fetchFails?: boolean } = {}) {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const origFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    if (opts.fetchFails) throw new TypeError('network down');
    return sseResponse();
  }) as unknown as typeof fetch;
  const reported: Array<{ intercept_id: string; llm_response: string }> = [];
  const deps: PatchDeps = {
    origFetch,
    adapter: claudeAdapter,
    intercept: vi.fn(async () => {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    }),
    reportResponse: (r) => reported.push(r),
  };
  return { patched: createPatchedFetch(deps), calls, reported, deps };
}

const injectOutcome: InterceptOutcome = {
  passthrough: false,
  response: { intercept_id: 'ic-1', node_id: 'n-1', level: 1, injected_prompt: INJECTED, quiz_attached: true, graded: null },
};
const flush = () => new Promise((r) => setTimeout(r, 20));

describe('patched fetch', () => {
  it('passes unrelated requests straight through without asking', async () => {
    const { patched, calls, deps } = setup(injectOutcome);
    await patched('https://claude.ai/api/organizations/x/chat_conversations', { method: 'GET' });
    expect(deps.intercept).not.toHaveBeenCalled();
    expect(calls[0].input).toBe('https://claude.ai/api/organizations/x/chat_conversations');
  });

  it('rewrites the prompt and keeps the rest of the body', async () => {
    const { patched, calls, deps } = setup(injectOutcome);
    await patched(req.url, { method: 'POST', body: JSON.stringify(req.body), headers: { 'content-type': 'application/json' } });
    expect(deps.intercept).toHaveBeenCalledWith({ raw_prompt: RAW, conversation_id: '9b2f6c1e-3d4a-4b5c-8d6e-7f8091a2b3c4' });
    const sent = JSON.parse(calls[0].init!.body as string);
    expect(sent.prompt).toBe(INJECTED);
    expect(sent.parent_message_uuid).toBe(req.body.parent_message_uuid);
    expect((calls[0].init!.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('captures the streamed reply and reports it with the intercept id', async () => {
    const { patched, reported } = setup(injectOutcome);
    const res = await patched(req.url, { method: 'POST', body: JSON.stringify(req.body) });
    expect(await res.text()).toBe(SSE); // the page still gets the full, untouched stream
    await flush();
    expect(reported).toEqual([{ intercept_id: 'ic-1', llm_response: 'Hello there, friend!' }]);
  });

  it('sends the original request when the extension says passthrough', async () => {
    const { patched, calls, reported } = setup({ passthrough: true, reason: 'disabled' });
    const init = { method: 'POST', body: JSON.stringify(req.body) };
    await patched(req.url, init);
    expect(calls[0].init).toBe(init);
    await flush();
    expect(reported).toEqual([]);
  });

  it('fails open when the intercept call throws or times out', async () => {
    const { patched, calls } = setup(new Error('bridge timed out'));
    const init = { method: 'POST', body: JSON.stringify(req.body) };
    await patched(req.url, init);
    expect(calls).toHaveLength(1);
    expect(calls[0].init).toBe(init);
  });

  it('reports unmatched completion-like POSTs (adapter drift detector)', async () => {
    const { patched, deps } = setup(injectOutcome);
    const seen: string[] = [];
    const p2 = createPatchedFetch({ ...deps, onUnmatched: (u) => seen.push(u) });
    await p2('https://claude.ai/api/v2/some/new/completion', { method: 'POST', body: '{}' });
    await patched('https://claude.ai/other', { method: 'POST', body: '{}' });
    expect(seen).toEqual(['https://claude.ai/api/v2/some/new/completion']);
  });

  it('a hanging intercept is cut off by the bridge timeout and the original is sent', async () => {
    const { deps, calls } = setup(injectOutcome);
    const p2 = createPatchedFetch({
      ...deps,
      intercept: () => new Promise((_, rej) => setTimeout(() => rej(new Error('bridge timed out after 30ms')), 30)),
    });
    const init = { method: 'POST', body: JSON.stringify(req.body) };
    await p2(req.url, init);
    expect(calls[0].init).toBe(init);
  });

  it('fails open on a non-JSON body', async () => {
    const { patched, calls, deps } = setup(injectOutcome);
    await patched(req.url, { method: 'POST', body: 'not json' });
    expect(calls).toHaveLength(1);
    expect(deps.intercept).not.toHaveBeenCalled();
  });

  it('re-throws network errors from the real fetch without retrying', async () => {
    const { patched, calls } = setup(injectOutcome, { fetchFails: true });
    await expect(patched(req.url, { method: 'POST', body: JSON.stringify(req.body) })).rejects.toThrow('network down');
    expect(calls).toHaveLength(1);
  });

  it('handles a Request object input', async () => {
    const { patched, calls } = setup(injectOutcome);
    await patched(new Request(req.url, { method: 'POST', body: JSON.stringify(req.body) }));
    const sentReq = calls[0].input as Request;
    expect(sentReq.method).toBe('POST');
    expect(JSON.parse(await sentReq.text()).prompt).toBe(INJECTED);
  });

  it('still captures the reply when nothing was injected (L4)', async () => {
    const { patched, calls, reported } = setup({
      passthrough: false,
      response: { intercept_id: 'ic-4', node_id: 'n-1', level: 4, injected_prompt: RAW, quiz_attached: false, graded: null },
    });
    const init = { method: 'POST', body: JSON.stringify(req.body) };
    await patched(req.url, init);
    expect(calls[0].init).toBe(init);
    await flush();
    expect(reported[0]?.intercept_id).toBe('ic-4');
  });
});
