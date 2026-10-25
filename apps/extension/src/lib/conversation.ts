/**
 * A stable conversation id for every send, including the first message of a new chat.
 *
 * claude.ai only puts the chat's UUID in the URL after the first message, so a new chat used to send
 * `conversation_id: null`. The API then grades against the latest open check question from ANY chat
 * (contracts §4.1), so asking the same question in a second new chat counted as an answer.
 *
 * Here a new chat gets its own id at its first send. When the URL then turns into /chat/<uuid>,
 * that uuid is aliased to the same id, so the follow-up answer is graded in the same conversation.
 */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const ALIAS_KEY = 'friction:conversation-aliases';

export interface ConversationTracker {
  /** The id to send with a message on the current page. */
  idForSend(): string;
  /** Call when location.pathname may have changed. */
  onPath(pathname: string): void;
}

export function createConversationTracker(deps: {
  idFromPath(pathname: string): string | null;
  getPath(): string;
  newId(): string;
  /** sessionStorage in the page: per tab, survives reloads. */
  store?: KeyValueStore | null;
}): ConversationTracker {
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

  /** Id given to a new chat's first message, waiting for claude.ai to assign the real uuid. */
  let unsaved: { id: string; path: string } | null = null;
  let lastPath = deps.getPath();

  function onPath(pathname: string) {
    if (pathname === lastPath) return;
    lastPath = pathname;
    if (!unsaved) return;
    const real = deps.idFromPath(pathname);
    if (real && !aliases[real]) {
      aliases[real] = unsaved.id; // the new chat just got its uuid
      save();
    }
    unsaved = null; // any navigation ends the unsaved chat
  }

  return {
    idForSend() {
      const path = deps.getPath();
      onPath(path);
      const real = deps.idFromPath(path);
      if (real) return aliases[real] ?? real;
      if (!unsaved || unsaved.path !== path) unsaved = { id: deps.newId(), path };
      return unsaved.id;
    },
    onPath,
  };
}
