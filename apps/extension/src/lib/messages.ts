/** Message shapes between content script / popup and the service worker (chrome.runtime.sendMessage). */
import type { BloomLevel, InterceptResponse, UUID } from '@friction/shared';

export type RuntimeRequest =
  | { type: 'friction:intercept'; raw_prompt: string; conversation_id: string | null; previous_assistant_text: string | null }
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
}

/**
 * scope_applied: what the server actually did. 'concept' when a prompt-scoped request reached a pre-v4 server
 * (it ignores `scope` and pauses the whole concept), detected by the node's paused flag going false → true.
 * 'unknown' when the flag couldn't be read; the UI then makes no claim either way.
 */
export type BypassResult =
  | { ok: true; remaining_quota: number; scope_applied: 'prompt' | 'concept' | 'unknown' }
  | { ok: false; code: string; message: string };

/** Content script's answer to 'friction:bypass-resend'. resent=false: quota used, text left in the composer, next send goes out unmodified. */
export type BypassResendResult =
  | { ok: true; remaining_quota: number; resent: boolean; scope_applied: 'prompt' | 'concept' | 'unknown' }
  | { ok: false; code: string; message: string };
