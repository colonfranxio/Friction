/**
 * A stable conversation id for every send, including the first message of a new chat.
 *
 * Chat sites (claude.ai, ChatGPT, Gemini) only put the chat's id in the URL after the first message, so a new chat used to send
 * `conversation_id: null`. The API then grades against the latest open check question from ANY chat
 * (contracts §4.1), so asking the same question in a second new chat counted as an answer.
 *
 * Here a new chat gets its own id at its first send. When the URL then turns into /chat/<uuid>,
 * that uuid is aliased to the same id, so the follow-up answer is graded in the same conversation.
 *
 * Only a confirmed first send creates the alias: the uuid must appear while that send is in flight
 * (confirmed by endSend(true) afterwards) or shortly after it was confirmed. A failed or ignored first
 * send followed by opening an existing chat leaves that chat with its own id.
 */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const ALIAS_KEY = 'friction:conversation-aliases';

/** How long after a confirmed first send the new chat's uuid may still show up in the URL. */
const ASSIGN_WINDOW_MS = 15_000;

export interface ConversationTracker {
  /** The id to send with a message on the current page. Marks a new chat's send as in flight. */
  idForSend(): string;
  /** The logical id of the chat on the current page, without starting a send (null: a new chat with nothing sent yet). */
  currentId(): string | null;
  /** Result of the send that idForSend() started: true = it went out. */
  endSend(sent: boolean): void;
  /** Call when location.pathname may have changed. */
  onPath(pathname: string): void;
}

export function createConversationTracker(deps: {
  idFromPath(pathname: string): string | null;
  getPath(): string;
  newId(): string;
  /** sessionStorage in the page: per tab, survives reloads. */
  store?: KeyValueStore | null;
  now?(): number;
}): ConversationTracker {
  const now = deps.now ?? Date.now;
  let aliases: Record<string, string> = {};
  try {
    aliases = JSON.parse(deps.store?.getItem(ALIAS_KEY) ?? '{}') ?? {};
  } catch {
    aliases = {};
  }
  const save = () => {
    try {
      deps.store?.setItem(ALIAS_KEY, JSON.stringify(aliases));
    } catch {
      /* storage blocked: aliases still work for this page */
    }
  };

  /**
   * Id given to a new chat's first message, waiting for the site to assign the real id.
   * state: idle (nothing confirmed), sending (a send is in flight), sent (confirmed at sentAt).
   * uuid: the fresh uuid the URL turned into while the send was still in flight.
   */
  let unsaved: { id: string; path: string; state: 'idle' | 'sending' | 'sent'; sentAt?: number; uuid?: string } | null = null;
  let lastPath = deps.getPath();

  const alias = (real: string, id: string) => {
    aliases[real] = id; // the new chat just got its uuid
    save();
  };

  function onPath(pathname: string) {
    if (pathname === lastPath) return;
    lastPath = pathname;
    if (!unsaved) return;
    const real = deps.idFromPath(pathname);
    const fresh = !!real && !aliases[real];
    if (fresh && unsaved.state === 'sending' && !unsaved.uuid) {
      unsaved.uuid = real!; // decided by endSend()
      return;
    }
    if (fresh && unsaved.state === 'sent' && now() - (unsaved.sentAt ?? 0) <= ASSIGN_WINDOW_MS) alias(real!, unsaved.id);
    unsaved = null; // any other navigation ends the unsaved chat
  }

  function currentId() {
    const path = deps.getPath();
    onPath(path);
    const real = deps.idFromPath(path);
    if (real) return aliases[real] ?? (unsaved?.uuid === real ? unsaved.id : real);
    return unsaved && unsaved.path === path ? unsaved.id : null;
  }

  return {
    idForSend() {
      const id = currentId();
      if (unsaved && id === unsaved.id) unsaved.state = 'sending';
      if (id) return id;
      unsaved = { id: deps.newId(), path: deps.getPath(), state: 'sending' };
      return unsaved.id;
    },
    currentId,
    endSend(sent) {
      if (unsaved?.state !== 'sending') return;
      if (!sent) {
        // Not sent: the chat the URL moved to (if any) is not the one this send would have created.
        if (unsaved.uuid) unsaved = null;
        else unsaved.state = 'idle';
        return;
      }
      if (unsaved.uuid) {
        alias(unsaved.uuid, unsaved.id);
        unsaved = null;
      } else {
        unsaved.state = 'sent';
        unsaved.sentAt = now();
      }
    },
    onPath,
  };
}
