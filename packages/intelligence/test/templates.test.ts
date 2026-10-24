import { buildSeed, FRICTION_CLOSE, FRICTION_OPEN, readInjectedLevel, stripInjected, type BloomLevel } from '@friction/shared';
import { describe, expect, it } from 'vitest';
import { buildFrictionPrompt } from '../src/templates';

const nodes = buildSeed().nodes;
const node = nodes.find((n) => n.concept_name === 'React useEffect')!;
const raw = 'How do I stop my useEffect from running in an infinite loop?';
const body = (s: string) => s.slice(s.indexOf(FRICTION_OPEN) + FRICTION_OPEN.length, s.indexOf(FRICTION_CLOSE));
const words = (s: string) => s.trim().split(/\s+/).length;

describe('buildFrictionPrompt', () => {
  it('L4 with no feedback is a passthrough', () => {
    expect(buildFrictionPrompt({ raw_prompt: raw, level: 4, node, includeQuiz: false })).toBe(raw);
    expect(buildFrictionPrompt({ raw_prompt: raw, level: 4, node, includeQuiz: false, feedback: null })).toBe(raw);
  });

  for (const level of [1, 2, 3] as BloomLevel[]) {
    it(`L${level}: raw prompt first, delimited block, Level line, anti-leak, concept + goal`, () => {
      const out = buildFrictionPrompt({ raw_prompt: raw, level, node, includeQuiz: true });
      expect(out.startsWith(`${raw}\n\n${FRICTION_OPEN}\n`)).toBe(true);
      expect(out.endsWith(FRICTION_CLOSE)).toBe(true);
      expect(stripInjected(out)).toBe(raw);
      expect(readInjectedLevel(out)).toBe(level);
      expect(out).toMatch(new RegExp(`^Level: ${level} \\(\\w+\\)$`, 'm'));
      expect(out).toMatch(/never mention, quote or allude/);
      expect(out).toContain(`Concept: ${node.concept_name}`);
      expect(out).toContain(`Learning goal: ${node.mastery_criteria}`);
      expect(out).toMatch(/End with one short, natural question/);
    });
  }

  it('level instructions match the brief', () => {
    const at = (level: BloomLevel) => buildFrictionPrompt({ raw_prompt: raw, level, node, includeQuiz: false });
    expect(at(1)).toMatch(/Do not give the answer or any code/);
    expect(at(1)).toMatch(/one hint/);
    expect(at(2)).toMatch(/pseudocode with blanks/);
    expect(at(3)).toMatch(/exactly one subtle, deliberate bug/);
    expect(at(3)).toMatch(/there is one bug to find, but not where/);
  });

  it('quiz line only when includeQuiz and below L4 (matches the fake)', () => {
    expect(buildFrictionPrompt({ raw_prompt: raw, level: 2, node, includeQuiz: false })).not.toMatch(/End with one short/);
    const l4 = buildFrictionPrompt({ raw_prompt: raw, level: 4, node, includeQuiz: true, feedback: { verdict: 'correct' } });
    expect(l4).not.toMatch(/End with one short/);
  });

  it('feedback variants; not_an_answer adds nothing', () => {
    const fb = (verdict: any, level: BloomLevel = 2) =>
      buildFrictionPrompt({ raw_prompt: raw, level, node, includeQuiz: false, feedback: { verdict } });
    expect(fb('correct')).toMatch(/Feedback: .*Briefly confirm they got it right and why/);
    expect(fb('partial')).toMatch(/Feedback: .*missing piece/);
    expect(fb('incorrect')).toMatch(/Feedback: .*Gently correct/);
    expect(fb('lazy')).toMatch(/Feedback: .*try first/);
    expect(fb('not_an_answer')).not.toMatch(/Feedback:/);
  });

  it('L4 with feedback wraps a block that confirms then helps fully', () => {
    const out = buildFrictionPrompt({ raw_prompt: raw, level: 4, node, includeQuiz: false, feedback: { verdict: 'correct' } });
    expect(readInjectedLevel(out)).toBe(4);
    expect(out).toMatch(/Help fully/);
    expect(out).toMatch(/Briefly confirm/);
  });

  it('body stays short (≤120 words) for every seed node and level', () => {
    for (const n of nodes) {
      for (const level of [1, 2, 3, 4] as BloomLevel[]) {
        const out = buildFrictionPrompt({ raw_prompt: raw, level, node: n, includeQuiz: true, feedback: { verdict: 'partial' } });
        expect(words(body(out))).toBeLessThanOrEqual(120);
      }
    }
  });
});
