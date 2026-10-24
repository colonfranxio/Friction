import { describe, expect, it } from 'vitest';
import { bridgeReply, bridgeRequest, BridgeTimeout, type MessageTarget } from '../src/lib/bridge';
import { isBridgeRequest } from '../src/lib/messages';

/** A fake window: postMessage dispatches asynchronously to all listeners (like the real thing). */
function fakeWindow(): MessageTarget & { listeners: Set<(e: MessageEvent) => void> } {
  const listeners = new Set<(e: MessageEvent) => void>();
  return {
    listeners,
    postMessage(data) {
      setTimeout(() => listeners.forEach((l) => l({ data } as MessageEvent)), 0);
    },
    addEventListener: (_t, fn) => listeners.add(fn),
    removeEventListener: (_t, fn) => listeners.delete(fn),
  };
}

describe('bridge', () => {
  it('round-trips a request via a responder', async () => {
    const w = fakeWindow();
    w.addEventListener('message', (e) => {
      if (isBridgeRequest(e.data)) w.postMessage(bridgeReply(e.data.nonce, true, { ok: true }), '*');
    });
    await expect(bridgeRequest(w, 'responses', { intercept_id: 'x', llm_response: 'y' }, 500)).resolves.toEqual({ ok: true });
    expect(w.listeners.size).toBe(1); // requester cleaned up its listener
  });

  it('ignores replies with a different nonce and times out', async () => {
    const w = fakeWindow();
    w.addEventListener('message', (e) => {
      if (isBridgeRequest(e.data)) w.postMessage(bridgeReply('wrong-nonce', true, { ok: true }), '*');
    });
    await expect(bridgeRequest(w, 'intercept', { raw_prompt: 'p', conversation_id: null }, 50)).rejects.toBeInstanceOf(BridgeTimeout);
  });

  it('ignores replies posted from another window', async () => {
    const w = fakeWindow();
    const other = {};
    const realPost = w.postMessage;
    w.addEventListener('message', (e) => {
      if (isBridgeRequest(e.data)) {
        const reply = bridgeReply(e.data.nonce, true, { ok: true });
        setTimeout(() => w.listeners.forEach((l) => l({ data: reply, source: other } as unknown as MessageEvent)), 0);
      }
    });
    void realPost;
    await expect(bridgeRequest(w, 'intercept', { raw_prompt: 'p', conversation_id: null }, 50)).rejects.toBeInstanceOf(BridgeTimeout);
  });

  it('rejects on an error reply', async () => {
    const w = fakeWindow();
    w.addEventListener('message', (e) => {
      if (isBridgeRequest(e.data)) w.postMessage(bridgeReply(e.data.nonce, false, undefined, 'boom'), '*');
    });
    await expect(bridgeRequest(w, 'intercept', { raw_prompt: 'p', conversation_id: null }, 500)).rejects.toThrow('boom');
  });
});
