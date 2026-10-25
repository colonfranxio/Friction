/** Every supported site. Frozen at CP0: adding a site's selectors never touches this file. */
import { chatgpt } from './chatgpt';
import { claude } from './claude';
import { gemini } from './gemini';
import type { SiteAdapter } from './types';

export type { SiteAdapter } from './types';
export const ADAPTERS: SiteAdapter[] = [claude, chatgpt, gemini];

/** The adapter for this exact hostname, or null (unknown host, or a stub with no composer selectors yet). */
export function siteFor(hostname: string): SiteAdapter | null {
  return ADAPTERS.find((a) => a.selectors.composer.length > 0 && a.hosts.includes(hostname)) ?? null;
}
