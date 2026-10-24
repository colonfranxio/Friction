/** Message shapes between content script / popup and the service worker (chrome.runtime.sendMessage). */
import type { BloomLevel, InterceptResponse, UUID } from '@friction/shared';

export type RuntimeRequest =
  | { type: 'friction:intercept'; raw_prompt: string; conversation_id: string | null; previous_assistant_text: string | null }
  | { type: 'friction:status' }
  | { type: 'friction:bypass' };

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

export type BypassResult = { ok: true; remaining_quota: number } | { ok: false; code: string; message: string };
