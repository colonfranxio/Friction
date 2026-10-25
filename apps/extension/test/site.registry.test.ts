import { describe, expect, it } from 'vitest';
import { ADAPTERS, siteFor } from '../src/site';

describe('site registry', () => {
  it('picks claude.ai by exact hostname', () => {
    expect(siteFor('claude.ai')?.id).toBe('claude');
    expect(siteFor('claude.ai')?.app_source).toBe('claude_web');
  });

  it('returns null for unknown hosts and look-alikes (no suffix match)', () => {
    expect(siteFor('evil.com')).toBeNull();
    expect(siteFor('notclaude.ai')).toBeNull();
    expect(siteFor('claude.ai.evil.com')).toBeNull();
  });

  it('every adapter declares hosts and its app_source', () => {
    const sources = { claude: 'claude_web', chatgpt: 'chatgpt_web', gemini: 'gemini_web' } as const;
    expect(ADAPTERS.map((a) => a.id).sort()).toEqual(['chatgpt', 'claude', 'gemini']);
    for (const a of ADAPTERS) {
      expect(a.hosts.length).toBeGreaterThan(0);
      expect(a.app_source).toBe(sources[a.id]);
    }
  });

  it('a stub adapter (no composer selectors) is disabled: the content script does nothing there', () => {
    for (const a of ADAPTERS.filter((x) => x.selectors.composer.length === 0)) {
      for (const h of a.hosts) expect(siteFor(h)).toBeNull();
    }
  });
});
