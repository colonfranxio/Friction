/** Message shapes between content script / popup and the service worker (chrome.runtime.sendMessage). */
import type { AppSource, BloomLevel, InterceptResponse, UUID } from '@friction/shared';

export type RuntimeRequest =
  | { type: 'friction:intercept'; raw_prompt: string; conversation_id: string | null; previous_assistant_text: string | null; app_source?: AppSource }
  | { type: 'friction:status' }
  /** node_id: the concept to bypass (the tab's last friction-ed message); falls back to the last intercept. */
  | { type: 'friction:bypass'; node_id?: UUID | null; scope?: 'prompt' | 'concept' };

/** Popup → content script of the active tab. */
export type TabRequest = { type: 'friction:bypass-resend' };

/** What the content script needs back from an intercept. */
export type InterceptOutcome =
  | { passthrough: true; reason: 'disabled' | 'offline' | 'no_match' | 'error' }
  | { passthrough: false; response: InterceptResponse };

export interface LastIntercept {
  node_id: UUID | null;
  level: BloomLevel | null;
  concept_name: string | null;
  intercept_id: UUID | null;
  at: string;
}

export interface StatusResponse {
  online: boolean;
  enabled: boolean;
  studentId: string;
  apiUrl: string;
  bypass_quota: number | null;
  last: LastIntercept | null;
  /** true when the last intercept's node is currently paused by a bypass */
  paused: boolean;
  /** true when a bypass would be prompt-scoped (gate in lib/bypass-gate.ts); false = it pauses the concept. */
  prompt_bypass: boolean;
}

/**
 * scope_applied: 'prompt' only when the bypass gate allowed a prompt-scoped request (see lib/bypass-gate.ts);
 * otherwise the legacy payload was sent and the server paused the whole concept until reset.
 */
export type BypassResult =
  | { ok: true; remaining_quota: number; scope_applied: 'prompt' | 'concept' }
  | { ok: false; code: string; message: string };

/**
 * Content script's answer to 'friction:bypass-resend'. resent=false: quota used and the text left in the composer
 * (next send goes out unmodified), or, with not_sent_reason, quota used but nothing sent because the chat, draft,
 * consent or send state changed meanwhile; `prompt` is the original question for the user to copy.
 */
export type BypassResendResult =
  | { ok: true; remaining_quota: number; resent: boolean; scope_applied: 'prompt' | 'concept'; not_sent_reason?: string; prompt?: string }
  | { ok: false; code: string; message: string };
