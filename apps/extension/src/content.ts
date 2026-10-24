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
import type { BypassResendResult, BypassResult, RuntimeRequest, StatusResponse, TabRequest } from './lib/messages';
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

const badge = mountBadge(document, { onBypass: () => void bypassAndResend() });

/** The last message in this tab that got friction: what a bypass re-sends. Cleared once bypassed (one bypass per prompt). */
let lastFriction: { raw: string; node_id: string; concept: string | null } | null = null;
/** Text that must go out unmodified on the next send (a bypass whose automatic re-send didn't go through). */
let bypassArmed: string | null = null;
let pendingRaw = '';

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
// claude.ai is a single-page app: watch for the new chat's URL to appear.
setInterval(() => conversations.onPath(location.pathname), 500);

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
  skipIntercept: (raw) => {
    if (bypassArmed === null || raw !== bypassArmed.trim()) return false;
    bypassArmed = null;
    return true;
  },
  intercept: (raw) => (
    (pendingRaw = raw),
    send<InterceptRuntimeResult>({
      type: 'friction:intercept',
      raw_prompt: raw,
      conversation_id: conversations.idForSend(),
      previous_assistant_text: site.lastAssistantText(document),
    })
  ),
  onSent: (mode, r) => {
    if (mode === 'injected' && r && !r.outcome.passthrough && r.outcome.response.node_id && r.outcome.response.level !== 4) {
      lastFriction = { raw: pendingRaw, node_id: r.outcome.response.node_id, concept: r.concept_name };
    } else if (mode !== 'not-sent' && mode !== 'bypassed') {
      lastFriction = null; // a newer message without friction: nothing to bypass
    }
    badge.set(badgeFor(mode, r));
  },
});

/**
 * Bypass = one use of the quota (teacher notified, via POST /bypass) + re-send the same prompt unmodified.
 * Applies to that one prompt only on the extension side; see the change request in docs/status/D-extension.md
 * (the current API also pauses the whole concept).
 */
let bypassing = false;
async function bypassAndResend(): Promise<BypassResendResult> {
  const target = lastFriction;
  if (!target) return { ok: false, code: 'no_prompt', message: 'Nothing to bypass in this tab yet.' };
  if (bypassing) return { ok: false, code: 'busy', message: 'Bypass already in progress.' };
  bypassing = true;
  badge.setBusy(true);
  try {
    let r: BypassResult;
    try {
      r = await send<BypassResult>({ type: 'friction:bypass', node_id: target.node_id });
    } catch (e) {
      const message = isContextInvalidated(e) ? 'reload this tab' : 'server unreachable';
      badge.set(isContextInvalidated(e) ? { kind: 'reload' } : { kind: 'error', message });
      return { ok: false, code: 'offline', message: 'Friction server is unreachable.' };
    }
    if (!r.ok) {
      badge.set({ kind: 'error', message: r.code === 'quota_exhausted' ? 'no bypasses left' : 'bypass failed' });
      return r;
    }
    lastFriction = null;
    const resent = await interceptor.sendUnmodified(target.raw);
    if (!resent) bypassArmed = target.raw; // left in the composer: the user's next Send goes out unmodified
    badge.set({ kind: 'bypassed', concept: target.concept, remaining: r.remaining_quota });
    return { ok: true, remaining_quota: r.remaining_quota, resent };
  } finally {
    bypassing = false;
    badge.setBusy(false);
  }
}

chrome.runtime.onMessage.addListener((msg: TabRequest, _sender, sendResponse) => {
  if (msg?.type !== 'friction:bypass-resend') return false;
  bypassAndResend().then(sendResponse);
  return true;
});

startHidingInjected(document);

send<StatusResponse>({ type: 'friction:status' })
  .then((s) => {
    if (!s.enabled) badge.set({ kind: 'disabled' });
    else if (!s.online) badge.set({ kind: 'offline' });
  })
  .catch((e) => badge.set(isContextInvalidated(e) ? { kind: 'reload' } : { kind: 'offline' }));
