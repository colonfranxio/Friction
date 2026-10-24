/**
 * Isolated-world content script on claude.ai.
 * - Bridges page (main-world.ts) ⇄ background (service worker).
 * - Adds the last assistant message text (fallback quiz source for grading).
 * - Shows the status badge and hides injected blocks in rendered messages.
 */
import { claudeAdapter } from './adapters/claude';
import { bridgeReply } from './lib/bridge';
import { mountBadge, type BadgeState } from './lib/badge';
import { startHidingInjected } from './lib/hide-injected';
import {
  isBridgeRequest,
  type InterceptAsk,
  type ResponsesAsk,
  type RuntimeRequest,
  type StatusResponse,
} from './lib/messages';
import type { InterceptRuntimeResult } from './background-types';

const MAX_ASSISTANT_CHARS = 4000;

function lastAssistantText(): string | null {
  for (const sel of claudeAdapter.assistantMessageSelectors) {
    const all = document.querySelectorAll<HTMLElement>(sel);
    const last = all[all.length - 1];
    const text = last?.innerText?.trim();
    if (text) return text.slice(-MAX_ASSISTANT_CHARS);
  }
  return null;
}

function send<T>(msg: RuntimeRequest): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

let badge: { set(s: BadgeState): void } | null = null;
let pendingBadge: BadgeState | null = null;
const setBadge = (s: BadgeState) => (badge ? badge.set(s) : (pendingBadge = s));

window.addEventListener('message', async (e: MessageEvent) => {
  if (e.source !== window || !isBridgeRequest(e.data)) return;
  const req = e.data;
  try {
    if (req.kind === 'intercept') {
      const ask = req.payload as InterceptAsk;
      const r = await send<InterceptRuntimeResult>({
        type: 'friction:intercept',
        raw_prompt: ask.raw_prompt,
        conversation_id: ask.conversation_id,
        previous_assistant_text: lastAssistantText(),
      });
      window.postMessage(bridgeReply(req.nonce, true, r.outcome), '*');
      const o = r.outcome;
      if (!o.passthrough && o.response.level) setBadge({ kind: 'active', level: o.response.level, concept: r.concept_name });
      else if (o.passthrough && o.reason === 'offline') setBadge({ kind: 'offline' });
      else if (o.passthrough && o.reason === 'disabled') setBadge({ kind: 'disabled' });
      else setBadge({ kind: 'none' });
    } else {
      const r = req.payload as ResponsesAsk;
      await send({ type: 'friction:responses', intercept_id: r.intercept_id, llm_response: r.llm_response });
      window.postMessage(bridgeReply(req.nonce, true, { ok: true }), '*');
    }
  } catch (err) {
    // Extension reloaded/unavailable: the page falls back to the original prompt.
    window.postMessage(bridgeReply(req.nonce, false, undefined, String(err)), '*');
    if (req.kind === 'intercept') setBadge({ kind: 'offline' });
  }
});

function onReady() {
  badge = mountBadge(document);
  if (pendingBadge) badge.set(pendingBadge);
  startHidingInjected(document);
  send<StatusResponse>({ type: 'friction:status' })
    .then((s) => {
      if (pendingBadge) return;
      if (!s.enabled) setBadge({ kind: 'disabled' });
      else if (!s.online) setBadge({ kind: 'offline' });
    })
    .catch(() => setBadge({ kind: 'offline' }));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true });
else onReady();
