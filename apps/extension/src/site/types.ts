/** One AI chat site. The interceptor, tracker, bypass flow, badge and popup only ever see this. Contract: docs/multi-site/PLAN.md §2. */
import type { AppSource } from '@friction/shared';
import type { SiteOps } from '../lib/send-interceptor';

export interface SiteSelectors {
  composer: string[];
  send: string[];
  assistant: string[];
}

export interface SiteAdapter extends SiteOps {
  id: 'claude' | 'chatgpt' | 'gemini';
  app_source: AppSource;
  /** Exact hostnames, no suffix match. */
  hosts: string[];
  /** Tried in order. Empty `composer` = stub: the extension stays off on this site. */
  selectors: SiteSelectors;
  /** null on a brand-new chat (no id in the URL yet). */
  conversationIdFromPath(pathname: string): string | null;
  /** Newest assistant reply (last 4000 chars), null if none or it contains the friction block. */
  lastAssistantText(doc: Document): string | null;
}
