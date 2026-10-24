import { buildSeed, DEMO_PROMPTS } from '@friction/shared';
import { describe, expect, it } from 'vitest';
import { keywordClassify } from '../src/classify';
import { createIntelligence } from '../src/index';

const nodes = buildSeed().nodes;
const idOf = (name: string) => nodes.find((n) => n.concept_name === name)!.id;

describe('keywordClassify', () => {
  it('routes the demo prompts', () => {
    const q = keywordClassify(DEMO_PROMPTS.question, nodes);
    expect(q).toMatchObject({ node_id: idOf('React useEffect'), method: 'keyword' });
    expect(q.confidence).toBeGreaterThanOrEqual(0.6);
    expect(q.confidence).toBeLessThanOrEqual(0.95);
    expect(keywordClassify(DEMO_PROMPTS.correctAnswer, nodes).node_id).toBe(idOf('React useEffect'));
    expect(keywordClassify(DEMO_PROMPTS.bypassQuestion, nodes).node_id).toBe(idOf('Context API'));
    // The lazy answer carries no concept; on stage the pending quiz decides its node (contracts §4).
    expect(keywordClassify(DEMO_PROMPTS.lazyAnswer, nodes)).toEqual({ node_id: null, confidence: 0, method: 'none' });
  });

  it('unrelated prompt returns null', () => {
    expect(keywordClassify('write a haiku', nodes).node_id).toBeNull();
  });

  it('matches whole words only', () => {
    // "prop" inside "property" must not hit Props; "contextual" must not hit Context.
    expect(keywordClassify('what is a property bag in contextual typing', nodes).node_id).toBeNull();
  });

  it('prefers the longer / more specific match', () => {
    expect(keywordClassify('my useEffect fetch has a race condition', nodes).node_id).toBe(idOf('Data Fetching'));
    expect(keywordClassify('should I wrap this in useMemo or useCallback?', nodes).node_id).toBe(idOf('Performance & Memoization'));
  });

  it('is fast (<5ms per call)', () => {
    const t = performance.now();
    for (let i = 0; i < 100; i++) keywordClassify(DEMO_PROMPTS.question, nodes);
    expect((performance.now() - t) / 100).toBeLessThan(5);
  });

  it('createIntelligence().classifyTopic uses it', async () => {
    const r = await createIntelligence({ models: {} }).classifyTopic(DEMO_PROMPTS.question, nodes);
    expect(r.node_id).toBe(idOf('React useEffect'));
  });
});
