/**
 * The only content script on claude.ai (isolated world).
 * - Intercepts sends and rewrites the composer with Friction's instructions.
 * - Shows the status badge and hides the injected block in rendered messages.
 */
import { EXTENSION_TIMEOUT_MS } from '@friction/shared';
import type { InterceptRuntimeResult } from './background-types';
import { mountBadge, type BadgeState } from './lib/badge';
import { startHidingInjected } from './lib/hide-injected';
import type { RuntimeRequest, StatusResponse } from './lib/messages';
import { installSendInterceptor, type SendMode } from './lib/send-interceptor';
import * as site from './site/claude';

function send<T>(msg: RuntimeRequest): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

const badge = mountBadge(document);

function badgeFor(mode: SendMode, r: InterceptRuntimeResult | null): BadgeState {
  if (mode === 'not-sent') return { kind: 'ready' }; // send was ignored (e.g. Claude still replying); original text restored
  if (mode === 'failed-open' || !r) return { kind: 'offline' };
  const o = r.outcome;
  if (!o.passthrough && o.response.level) return { kind: 'active', level: o.response.level, concept: r.concept_name };
  if (o.passthrough && o.reason === 'offline') return { kind: 'offline' };
  if (o.passthrough && o.reason === 'disabled') return { kind: 'disabled' };
  return { kind: 'none' };
}

installSendInterceptor({
  doc: document,
  win: window,
  site,
  timeoutMs: EXTENSION_TIMEOUT_MS,
  intercept: (raw) =>
    send<InterceptRuntimeResult>({
      type: 'friction:intercept',
      raw_prompt: raw,
      conversation_id: site.conversationIdFromPath(location.pathname),
      previous_assistant_text: site.lastAssistantText(document),
    }),
  onSent: (mode, r) => badge.set(badgeFor(mode, r)),
});

startHidingInjected(document);

send<StatusResponse>({ type: 'friction:status' })
  .then((s) => {
    if (!s.enabled) badge.set({ kind: 'disabled' });
    else if (!s.online) badge.set({ kind: 'offline' });
  })
  .catch(() => badge.set({ kind: 'offline' }));
