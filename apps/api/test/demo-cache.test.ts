import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createDemoMatcher } from '../src/services/demo-cache';

const root = mkdtempSync(join(tmpdir(), 'friction-fixtures-'));
mkdirSync(join(root, 'fixtures'));
const md = '# Demo syllabus\r\n\r\nWeek 1: JSX\r\nWeek 2: useEffect\r\n\r\n';
const pdfBytes = Buffer.from('%PDF-1.4 fake demo pdf bytes \u0000\u0001\u0002');
writeFileSync(join(root, 'fixtures', 'demo-syllabus.md'), md);
writeFileSync(join(root, 'fixtures', 'demo-syllabus.pdf'), pdfBytes);

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('demo matcher', () => {
  const match = createDemoMatcher(root);

  it('matches the demo text regardless of CRLF/LF and surrounding whitespace', () => {
    expect(match({ kind: 'text', text: md })).toBe(true);
    expect(match({ kind: 'text', text: md.replace(/\r\n/g, '\n') })).toBe(true);
    expect(match({ kind: 'text', text: `\n\n  ${md.replace(/\r\n/g, '\n')}  \n` })).toBe(true);
  });

  it('rejects other text', () => {
    expect(match({ kind: 'text', text: md + 'Week 3: extra' })).toBe(false);
    expect(match({ kind: 'text', text: '' })).toBe(false);
  });

  it('matches the demo PDF by bytes (base64 without a data: prefix)', () => {
    expect(match({ kind: 'pdf', base64: pdfBytes.toString('base64'), filename: 'x.pdf' })).toBe(true);
    expect(match({ kind: 'pdf', base64: Buffer.from('other pdf').toString('base64') })).toBe(false);
  });

  it('without fixtures nothing matches and nothing throws', () => {
    const empty = mkdtempSync(join(tmpdir(), 'friction-nofixtures-'));
    try {
      const none = createDemoMatcher(empty);
      expect(none({ kind: 'text', text: md })).toBe(false);
      expect(none({ kind: 'pdf', base64: pdfBytes.toString('base64') })).toBe(false);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('the repo\'s own demo syllabus is recognised by the default matcher', async () => {
    const { readFileSync } = await import('node:fs');
    const { findRepoRoot } = await import('../src/lib/paths');
    const real = readFileSync(join(findRepoRoot(), 'fixtures', 'demo-syllabus.md'), 'utf8');
    expect(createDemoMatcher()({ kind: 'text', text: real })).toBe(true);
    expect(createDemoMatcher()({ kind: 'text', text: real.replace(/\n/g, '\r\n') })).toBe(true);
  });
});
