import { describe, expect, it } from 'vitest';
import { promptBypassEnabled } from '../src/lib/bypass-gate';

const SHA = 'd52e791' + 'a'.repeat(33); // any exact 40-hex string
const h = (contract_version: number, server: 'api' | 'mock') => ({ contract_version, mode: { intelligence: 'fake' as const, demo: true, server } });

describe('promptBypassEnabled (same rule as C sandbox)', () => {
  it('reference mock with contract v4: enabled without a SHA', () => {
    expect(promptBypassEnabled(h(4, 'mock'), '')).toBe(true);
  });
  it('real API: health v4 alone is NOT enough', () => {
    expect(promptBypassEnabled(h(4, 'api'), '')).toBe(false);
  });
  it('real API with an exact 40-hex API READY SHA: enabled', () => {
    expect(promptBypassEnabled(h(4, 'api'), SHA)).toBe(true);
    expect(promptBypassEnabled(h(4, 'api'), `  ${SHA.toUpperCase()}  `)).toBe(true);
  });
  it('rejects short, long or non-hex SHAs', () => {
    expect(promptBypassEnabled(h(4, 'api'), 'd52e791')).toBe(false);
    expect(promptBypassEnabled(h(4, 'api'), SHA + 'a')).toBe(false);
    expect(promptBypassEnabled(h(4, 'api'), 'z'.repeat(40))).toBe(false);
  });
  it('pre-v4 servers and unknown health: never', () => {
    expect(promptBypassEnabled(h(3, 'mock'), SHA)).toBe(false);
    expect(promptBypassEnabled(h(3, 'api'), SHA)).toBe(false);
    expect(promptBypassEnabled(null, SHA)).toBe(false);
  });
});
