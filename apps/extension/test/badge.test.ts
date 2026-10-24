import { describe, expect, it } from 'vitest';
import { badgeText } from '../src/lib/badge';

describe('badgeText', () => {
  it('shows level, role and concept', () => {
    expect(badgeText({ kind: 'active', level: 1, concept: 'React useEffect' }).text).toBe('Friction · L1 Socratic · React useEffect');
  });
  it('treats L4 as no friction', () => {
    expect(badgeText({ kind: 'active', level: 4, concept: null }).text).toBe('Friction · no friction');
  });
  it('tells the user to reload the tab after an extension update', () => {
    expect(badgeText({ kind: 'reload' }).text).toBe('Friction updated · reload this tab');
  });

  it('has offline and paused states', () => {
    expect(badgeText({ kind: 'offline' }).text).toBe('Friction offline');
    expect(badgeText({ kind: 'disabled' }).text).toBe('Friction paused');
  });
});
