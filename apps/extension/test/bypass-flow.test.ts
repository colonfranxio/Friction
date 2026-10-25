// @vitest-environment happy-dom
// Bypass races: the server's answer is held (deferred) while the user changes the chat, draft, consent or send state.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InterceptRuntimeResult } from '../src/background-types';
import type { BadgeState } from '../src/lib/badge';
import { createBypassFlow } from '../src/lib/bypass-flow';
import { createConversationTracker } from '../src/lib/conversation';
import type { BypassResult } from '../src/lib/messages';
import { installSendInterceptor, withBypassNote } from '../src/lib/send-interceptor';
import * as site from '../src/site/claude';

const RAW = 'How do I stop my useEffect from running in an infinite loop?';
const U1 = '11111111-aaaa-4aaa-8aaa-000000000001';
const U2 = '11111111-aaaa-4aaa-8aaa-000000000002';
const OK: BypassResult = { ok: true, remaining_quota: 2, scope_applied: 'prompt' };
const norm = (s: string) => s.replace(/\s+/g, '');

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

let cleanup: () => void = () => {};
afterEach(() => cleanup());

/**
 * A fake claude.ai page, the real interceptor and conversation tracker, and a bypass flow whose server answer is held.
 * The friction-ed message was the first send of a new chat when `firstTurn` is set ('before'/'after': when the URL gets its uuid
 * relative to the send-completion callback); otherwise it was sent in existing chat U1.
 */
function setup(opts: { firstTurn?: 'before' | 'after'; holdIntercept?: boolean } = {}) {
  document.body.innerHTML = `<fieldset><div class="ProseMirror" contenteditable="true"><p></p></div><button aria-label="Send message">Send</button></fieldset>`;
  const composer = document.querySelector<HTMLElement>('.ProseMirror')!;
  const button = document.querySelector<HTMLButtonElement>('button')!;
  const sent: string[] = [];
  const doSend = () => {
    sent.push(norm(composer.textContent ?? ''));
    composer.innerHTML = '<p></p>';
  };
  button.addEventListener('click', doSend);
  composer.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Enter' && doSend());

  let path = opts.firstTurn ? '/new' : `/chat/${U1}`;
  let n = 0;
  const tracker = createConversationTracker({ idFromPath: site.conversationIdFromPath, getPath: () => path, newId: () => `gen-${++n}`, store: null });
  const interceptGate = deferred<InterceptRuntimeResult>();
  const ic = installSendInterceptor({
    doc: document, win: window, site, timeoutMs: 5000, settleMs: 20, confirmMs: 80,
    intercept: () => (opts.holdIntercept ? interceptGate.promise : Promise.resolve({ outcome: { passthrough: true, reason: 'no_match' }, concept_name: null })),
    onSent: (mode) => mode !== 'not-sent' && flow.noteSent(), // as content.ts does
  });
  cleanup = ic;

  let enabled = true;
  const answer = deferred<BypassResult>();
  const requestBypass = vi.fn(() => answer.promise);
  const badges: BadgeState[] = [];
  const flow = createBypassFlow({
    interceptor: ic,
    currentConversation: () => tracker.currentId(),
    isEnabled: () => enabled,
    requestBypass,
    badge: { set: (s) => badges.push(s), setBusy: () => {} },
    isContextInvalidated: () => false,
  });

  const go = (p: string) => {
    path = p;
    tracker.onPath(p);
    flow.onConversation(tracker.currentId()); // what the content script's path watcher does
  };
  // The message that got friction.
  const conv = tracker.idForSend();
  if (opts.firstTurn === 'before') go(`/chat/${U1}`);
  tracker.endSend(true);
  flow.setTarget({ raw: RAW, node_id: 'node-1', concept: 'React useEffect', conv });
  if (opts.firstTurn === 'after') go(`/chat/${U1}`);

  return {
    composer, button, sent, flow, requestBypass, badges, interceptGate, go,
    goSilently: (p: string) => (path = p), // navigation the 500ms path watcher hasn't seen yet
    disable: () => (enabled = false),
    answer: (r: BypassResult = OK) => answer.resolve(r),
  };
}

const lastBadge = (b: BadgeState[]) => b[b.length - 1];

describe('bypass flow', () => {
  it('normal same-chat bypass: one charge, sent exactly once', async () => {
    const p = setup();
    const run = p.flow.run();
    p.answer();
    expect(await run).toEqual({ ok: true, remaining_quota: 2, resent: true, scope_applied: 'prompt' });
    expect(p.sent).toEqual([norm(withBypassNote(RAW))]);
    expect(p.requestBypass).toHaveBeenCalledTimes(1);
    expect(p.flow.getArmed()).toBeNull();
    expect(lastBadge(p.badges)).toMatchObject({ kind: 'bypassed', remaining: 2 });
  });

  it('a second click while the first is pending is refused: no duplicate charge', async () => {
    const p = setup();
    const first = p.flow.run();
    expect(await p.flow.run()).toMatchObject({ ok: false, code: 'busy' });
    p.answer();
    await first;
    expect(p.requestBypass).toHaveBeenCalledTimes(1);
    expect(p.sent).toEqual([norm(withBypassNote(RAW))]);
  });

  it('new draft typed while the server answers: draft kept, nothing sent or armed, question offered', async () => {
    const p = setup();
    const run = p.flow.run();
    p.composer.innerHTML = '<p>a different question</p>';
    p.answer();
    expect(await run).toMatchObject({ ok: true, resent: false, not_sent_reason: 'you started a new draft', prompt: RAW });
    expect(p.composer.textContent).toBe('a different question');
    expect(p.sent).toEqual([]);
    expect(p.flow.getArmed()).toBeNull();
    expect(lastBadge(p.badges)).toEqual({ kind: 'spent', remaining: 2, reason: 'you started a new draft', prompt: RAW });
    expect(p.requestBypass).toHaveBeenCalledTimes(1);
  });

  it('switched to another chat while the server answers: no wrong-chat send, nothing armed', async () => {
    const p = setup();
    const run = p.flow.run();
    p.goSilently(`/chat/${U2}`);
    p.answer();
    expect(await run).toMatchObject({ ok: true, resent: false, not_sent_reason: 'you switched chats' });
    expect(p.sent).toEqual([]);
    expect(p.flow.getArmed()).toBeNull();
    expect(p.flow.skipIntercept(RAW)).toBe(false);
  });

  it('consent turned off while the server answers: nothing sent', async () => {
    const p = setup();
    const run = p.flow.run();
    p.disable();
    p.answer();
    expect(await run).toMatchObject({ ok: true, resent: false, not_sent_reason: 'Friction was turned off' });
    expect(p.sent).toEqual([]);
  });

  it('another send started while the server answers: it is not clobbered and the old prompt is not sent', async () => {
    const p = setup({ holdIntercept: true });
    const run = p.flow.run();
    p.composer.innerHTML = '<p>another question</p>';
    p.composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); // held by the interceptor
    p.answer();
    expect(await run).toMatchObject({ ok: true, resent: false, not_sent_reason: 'another message was sending' });
    p.interceptGate.resolve({ outcome: { passthrough: true, reason: 'no_match' }, concept_name: null });
    await vi.waitFor(() => expect(p.sent).toHaveLength(1));
    expect(p.sent).toEqual([norm('another question')]);
  });

  it('another message sent AND completed while the server answers: the old prompt is not re-sent out of order', async () => {
    const p = setup();
    const run = p.flow.run();
    p.composer.innerHTML = '<p>a newer question</p>';
    p.composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(p.sent).toHaveLength(1)); // composer is empty again, interceptor idle
    p.answer();
    expect(await run).toMatchObject({ ok: true, resent: false, not_sent_reason: 'another message was sent' });
    expect(p.sent).toEqual([norm('a newer question')]);
    expect(p.flow.getArmed()).toBeNull();
  });

  it('quota refused: nothing sent, badge says so', async () => {
    const p = setup();
    const run = p.flow.run();
    p.answer({ ok: false, code: 'quota_exhausted', message: 'none left' });
    expect(await run).toMatchObject({ ok: false, code: 'quota_exhausted' });
    expect(p.sent).toEqual([]);
    expect(lastBadge(p.badges)).toEqual({ kind: 'error', message: 'no bypasses left' });
  });

  it('checks before spending: a draft or another chat refuses without charging', async () => {
    const p = setup();
    p.composer.innerHTML = '<p>a draft</p>';
    expect(await p.flow.run()).toMatchObject({ ok: false, code: 'draft' });
    p.composer.innerHTML = '<p></p>';
    p.goSilently(`/chat/${U2}`);
    expect(await p.flow.run()).toMatchObject({ ok: false, code: 'stale' });
    expect(p.requestBypass).not.toHaveBeenCalled();
  });

  for (const order of ['before', 'after'] as const) {
    it(`first turn of a new chat: the uuid assigned ${order} the send callback keeps the bypass target`, async () => {
      const p = setup({ firstTurn: order });
      expect(p.flow.getTarget()).not.toBeNull();
      const run = p.flow.run();
      p.answer();
      expect(await run).toMatchObject({ ok: true, resent: true });
      expect(p.sent).toEqual([norm(withBypassNote(RAW))]);
    });
  }

  it('switching chats clears both the target and an armed re-send', async () => {
    const p = setup();
    // The page ignores sends (e.g. Claude still replying): the bypassed text is armed for the next Send.
    p.button.replaceWith(p.button.cloneNode(true));
    p.composer.replaceWith(p.composer.cloneNode(true));
    const run = p.flow.run();
    p.answer();
    expect(await run).toMatchObject({ ok: true, resent: false });
    expect(p.flow.getArmed()).toMatchObject({ text: RAW });
    p.flow.setTarget({ raw: 'later prompt', node_id: 'node-2', concept: null, conv: U1 });
    p.go(`/chat/${U2}`);
    expect(p.flow.getArmed()).toBeNull();
    expect(p.flow.getTarget()).toBeNull();
  });

  it('an armed re-send only applies in its own chat', async () => {
    const p = setup();
    p.button.replaceWith(p.button.cloneNode(true));
    p.composer.replaceWith(p.composer.cloneNode(true));
    const run = p.flow.run();
    p.answer();
    await run;
    p.goSilently(`/chat/${U2}`);
    expect(p.flow.skipIntercept(RAW)).toBe(false);
  });
});
