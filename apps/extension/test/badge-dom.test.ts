// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mountBadge } from '../src/lib/badge';

describe('badge Bypass button tooltip (honesty)', () => {
  it('defaults to the cautious concept-pause wording and switches only when the gate is on', () => {
    document.body.innerHTML = '';
    const b = mountBadge(document, { onBypass: () => {} });
    const btn = b.host.shadowRoot!.querySelector('.bypass') as HTMLButtonElement;
    expect(btn.title).toMatch(/pauses friction on this concept until reset/);
    b.setPromptBypass(true);
    expect(btn.title).not.toMatch(/concept/);
    expect(btn.title).toMatch(/Re-send this message without friction/);
    b.setPromptBypass(false);
    expect(btn.title).toMatch(/pauses friction on this concept until reset/);
  });
});
