/**
 * The only content script on claude.ai (isolated world).
 * - Intercepts sends and rewrites the composer with Friction's instructions.
 * - Shows the status badge and hides the injected block in rendered messages.
 */
import { EXTENSION_TIMEOUT_MS } from '@friction/shared';
import type { InterceptRuntimeResult } from './background-types';
import { mountBadge, type BadgeState } from './lib/badge';
import { createConversationTracker } from './lib/conversation';
import { startHidingInjected } from './lib/hide-injected';
import { createBypassFlow } from './lib/bypass-flow';
import type { BypassResult, RuntimeRequest, StatusResponse, TabRequest } from './lib/messages';
import { installSendInterceptor, type SendMode } from './lib/send-interceptor';
import * as site from './site/claude';

/** After the extension is reloaded, already-open tabs keep an orphaned content script whose chrome.* calls fail. */
export function isContextInvalidated(err?: unknown): boolean {
  try {
    if (!chrome.runtime?.id) return true;
  } catch {
    return true;
  }
  return /context invalidated/i.test(String((err as Error)?.message ?? err ?? ''));
}

let lastError: unknown = null;
function send<T>(msg: RuntimeRequest): Promise<T> {
  try {
    return (chrome.runtime.sendMessage(msg) as Promise<T>).catch((e) => {
      lastError = e;
      throw e;
    });
  } catch (e) {
    lastError = e;
    return Promise.reject(e);
  }
}

const badge = mountBadge(document, { onBypass: () => void bypass.run() });

let pendingRaw = '';
let pendingConv = '';

/** Consent toggle, kept current so a bypass in flight can see it being turned off. */
let enabled = true;
try {
  chrome.storage.local.get('enabled').then((s) => (enabled = s.enabled !== false), () => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'enabled' in changes) enabled = changes.enabled.newValue !== false;
  });
} catch {
  /* orphaned content script: the background refuses everything anyway */
}

const conversations = createConversationTracker({
  idFromPath: site.conversationIdFromPath,
  getPath: () => location.pathname,
  newId: () => crypto.randomUUID(),
  store: (() => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  })(),
});

function badgeFor(mode: SendMode, r: InterceptRuntimeResult | null): BadgeState {
  if (mode === 'bypassed') return { kind: 'bypassed', concept: null, remaining: null };
  if (mode === 'not-sent') return { kind: 'ready' }; // send was ignored (e.g. Claude still replying); original text restored
  if ((mode === 'failed-open' || !r) && isContextInvalidated(lastError)) return { kind: 'reload' };
  if (mode === 'failed-open' || !r) return { kind: 'offline' };
  const o = r.outcome;
  if (!o.passthrough && o.response.level) return { kind: 'active', level: o.response.level, concept: r.concept_name };
  if (o.passthrough && o.reason === 'offline') return { kind: 'offline' };
  if (o.passthrough && o.reason === 'disabled') return { kind: 'disabled' };
  return { kind: 'none' };
}

const interceptor = installSendInterceptor({
  doc: document,
  win: window,
  site,
  timeoutMs: EXTENSION_TIMEOUT_MS,
  skipIntercept: (raw) => bypass.skipIntercept(raw),
  intercept: (raw) => (
    (pendingRaw = raw),
    (pendingConv = conversations.idForSend()),
    send<InterceptRuntimeResult>({
      type: 'friction:intercept',
      raw_prompt: raw,
      conversation_id: pendingConv,
      previous_assistant_text: site.lastAssistantText(document),
    })
  ),
  onSent: (mode, r) => {
    if (mode !== 'bypassed') conversations.endSend(mode !== 'not-sent'); // before the target: a first send may alias the chat now
    if (mode === 'injected' && r && !r.outcome.passthrough && r.outcome.response.node_id && r.outcome.response.level !== 4) {
      bypass.setTarget({ raw: pendingRaw, node_id: r.outcome.response.node_id, concept: r.concept_name, conv: pendingConv });
    } else if (mode !== 'not-sent' && mode !== 'bypassed') {
      bypass.setTarget(null); // a newer message without friction: nothing to bypass
    }
    badge.set(badgeFor(mode, r));
  },
});

const bypass = createBypassFlow({
  interceptor,
  currentConversation: () => conversations.currentId(),
  isEnabled: () => enabled,
  requestBypass: (node_id) => send<BypassResult>({ type: 'friction:bypass', node_id, scope: 'prompt' }),
  badge,
  isContextInvalidated,
});

// claude.ai is a single-page app: watch for the new chat's URL to appear. The bypass target and armed text follow
// the logical conversation, so a new chat getting its uuid keeps them and switching to another chat drops them.
setInterval(() => bypass.onConversation(conversations.currentId()), 500);

chrome.runtime.onMessage.addListener((msg: TabRequest, _sender, sendResponse) => {
  if (msg?.type !== 'friction:bypass-resend') return false;
  bypass.run().then(sendResponse);
  return true;
});

startHidingInjected(document);

send<StatusResponse>({ type: 'friction:status' })
  .then((s) => {
    badge.setPromptBypass(!!s.prompt_bypass);
    if (!s.enabled) badge.set({ kind: 'disabled' });
    else if (!s.online) badge.set({ kind: 'offline' });
  })
  .catch((e) => badge.set(isContextInvalidated(e) ? { kind: 'reload' } : { kind: 'offline' }));
