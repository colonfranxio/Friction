import { describe, expect, it } from 'vitest';
import { createConversationTracker, type KeyValueStore } from '../src/lib/conversation';
import { conversationIdFromPath } from '../src/site/claude';

const U1 = '11111111-aaaa-4aaa-8aaa-000000000001';
const U2 = '11111111-aaaa-4aaa-8aaa-000000000002';

function memoryStore(): KeyValueStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

function setup(store: KeyValueStore | null = memoryStore(), start = '/new') {
  let path = start;
  let n = 0;
  const t = createConversationTracker({ idFromPath: conversationIdFromPath, getPath: () => path, newId: () => `gen-${++n}`, store });
  return { t, go: (p: string) => ((path = p), t.onPath(p)), goSilently: (p: string) => (path = p) };
}

describe('conversation ids', () => {
  it('a new chat never sends null', () => {
    const { t } = setup();
    expect(t.idForSend()).toBe('gen-1');
  });

  it('two separate new chats get different ids (no cross-chat grading)', () => {
    const { t, go } = setup();
    const first = t.idForSend();
    go(`/chat/${U1}`);
    go('/new');
    expect(t.idForSend()).not.toBe(first);
  });

  it('the follow-up in the same chat keeps the first id after claude.ai assigns the uuid', () => {
    const { t, go } = setup();
    const first = t.idForSend();
    go(`/chat/${U1}`);
    expect(t.idForSend()).toBe(first);
  });

  it('also when the URL change is only seen at the next send', () => {
    const { t, goSilently } = setup();
    const first = t.idForSend();
    goSilently(`/chat/${U1}`);
    expect(t.idForSend()).toBe(first);
  });

  it('existing chats use their own uuid', () => {
    const { t } = setup(memoryStore(), `/chat/${U2}`);
    expect(t.idForSend()).toBe(U2);
  });

  it('a retried send on the same new-chat page keeps its id', () => {
    const { t } = setup();
    expect(t.idForSend()).toBe(t.idForSend());
  });

  it('aliases survive a page reload (sessionStorage)', () => {
    const store = memoryStore();
    const a = setup(store);
    const first = a.t.idForSend();
    a.go(`/chat/${U1}`);
    a.t.endSend(true);
    const b = setup(store, `/chat/${U1}`);
    expect(b.t.idForSend()).toBe(first);
  });

  it('confirmed first send: uuid assigned BEFORE the send-completion callback keeps the id', () => {
    const { t, go } = setup();
    const first = t.idForSend();
    go(`/chat/${U1}`);
    t.endSend(true);
    expect(t.currentId()).toBe(first);
    expect(t.idForSend()).toBe(first);
  });

  it('confirmed first send: uuid assigned AFTER the send-completion callback keeps the id', () => {
    const { t, go } = setup();
    const first = t.idForSend();
    t.endSend(true);
    go(`/chat/${U1}`);
    expect(t.currentId()).toBe(first);
    expect(t.idForSend()).toBe(first);
  });

  it('failed/ignored first send, then opening an existing chat: that chat keeps its own id', () => {
    const { t, go } = setup();
    const first = t.idForSend();
    t.endSend(false);
    go(`/chat/${U2}`);
    expect(t.idForSend()).toBe(U2);
    expect(t.idForSend()).not.toBe(first);
  });

  it('URL moved while the send was in flight, but the send failed: no alias', () => {
    const { t, go } = setup();
    t.idForSend();
    go(`/chat/${U2}`);
    t.endSend(false);
    expect(t.idForSend()).toBe(U2);
  });

  it('a confirmed send does not alias a chat opened long after it', () => {
    let clock = 0;
    let path = '/new';
    const t = createConversationTracker({ idFromPath: conversationIdFromPath, getPath: () => path, newId: () => 'gen-1', store: memoryStore(), now: () => clock });
    t.idForSend();
    t.endSend(true);
    clock += 60_000;
    path = `/chat/${U2}`;
    t.onPath(path);
    expect(t.idForSend()).toBe(U2);
  });

  it('currentId is null on a new chat before anything is sent', () => {
    expect(setup().t.currentId()).toBeNull();
  });

  it('works without storage', () => {
    const { t, go } = setup(null);
    const first = t.idForSend();
    go(`/chat/${U1}`);
    expect(t.idForSend()).toBe(first);
  });
});

// Other sites put the chat id elsewhere in the URL; the tracker must only depend on idFromPath.
describe.each([
  { site: 'ChatGPT-style', newChat: '/', chat: `/c/${U1}`, other: `/c/${U2}`, idFromPath: (p: string) => /\/c\/([0-9a-f-]{36})(?:[/?#]|$)/.exec(p)?.[1] ?? null },
  { site: 'Gemini-style', newChat: '/app', chat: '/app/0a1b2c3d4e5f6a7b', other: '/app/ffffeeeeddddcccc', idFromPath: (p: string) => /\/app\/([0-9a-f]{12,})(?:[/?#]|$)/.exec(p)?.[1] ?? null },
])('conversation ids on $site paths', ({ newChat, chat, other, idFromPath }) => {
  function make() {
    let path = newChat;
    let n = 0;
    const t = createConversationTracker({ idFromPath, getPath: () => path, newId: () => `gen-${++n}`, store: memoryStore() });
    return { t, go: (p: string) => ((path = p), t.onPath(p)) };
  }

  it('first turn: the id the chat gets after its first send is aliased to the generated one', () => {
    const { t, go } = make();
    const first = t.idForSend();
    go(chat);
    t.endSend(true);
    expect(t.currentId()).toBe(first);
    expect(t.idForSend()).toBe(first);
  });

  it('also when the URL changes after the send is confirmed', () => {
    const { t, go } = make();
    const first = t.idForSend();
    t.endSend(true);
    go(chat);
    expect(t.currentId()).toBe(first);
  });

  it('switching to another existing chat gives that chat its own id', () => {
    const { t, go } = make();
    const first = t.idForSend();
    go(chat);
    t.endSend(true);
    go(other);
    expect(t.currentId()).not.toBe(first);
    expect(t.idForSend()).toBe(idFromPath(other));
  });
});
