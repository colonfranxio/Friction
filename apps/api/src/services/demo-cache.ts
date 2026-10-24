import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SyllabusInput } from '@friction/shared';
import { findRepoRoot } from '../lib/paths';

export type DemoMatcher = (input: SyllabusInput) => boolean;

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const normalizeText = (s: string) => s.replace(/\r\n/g, '\n').trim();

/**
 * DEMO_MODE parse cache (contracts §8): matches the demo syllabus by hash.
 * Text: sha256 of the trimmed, LF-normalized text of fixtures/demo-syllabus.md.
 * PDF: sha256 of the bytes of fixtures/demo-syllabus.pdf (if that file exists).
 */
export function createDemoMatcher(repoRoot = findRepoRoot()): DemoMatcher {
  const fixtures = join(repoRoot, 'fixtures');
  const mdPath = join(fixtures, 'demo-syllabus.md');
  const pdfPath = join(fixtures, 'demo-syllabus.pdf');
  const textHash = existsSync(mdPath) ? sha256(normalizeText(readFileSync(mdPath, 'utf8'))) : null;
  const pdfHash = existsSync(pdfPath) ? sha256(readFileSync(pdfPath)) : null;

  return (input) => {
    if (input.kind === 'text') return textHash !== null && sha256(normalizeText(input.text)) === textHash;
    if (pdfHash === null) return false;
    return sha256(Buffer.from(input.base64, 'base64')) === pdfHash;
  };
}
