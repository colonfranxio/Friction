import { describe, expect, it } from 'vitest';
import { badgeText, canBypass } from '../src/lib/badge';

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

  it('offers Bypass only while the last message got friction', () => {
    expect(canBypass({ kind: 'active', level: 1, concept: null })).toBe(true);
    expect(canBypass({ kind: 'active', level: 3, concept: null })).toBe(true);
    expect(canBypass({ kind: 'active', level: 4, concept: null })).toBe(false);
    expect(canBypass({ kind: 'none' })).toBe(false);
    expect(canBypass({ kind: 'bypassed', concept: null, remaining: 2 })).toBe(false);
  });
  it('opt-out: a held "ignore friction" message points to Bypass', () => {
    expect(badgeText({ kind: 'opt-out' }).text).toBe('Friction · to skip friction, use Bypass · Enter sends anyway');
    expect(canBypass({ kind: 'opt-out' })).toBe(true);
  });
  it('shows the bypassed state with the remaining quota', () => {
    expect(badgeText({ kind: 'bypassed', concept: 'React useEffect', remaining: 2 }).text).toBe('Friction · bypassed · React useEffect · 2 left');
  });
});
