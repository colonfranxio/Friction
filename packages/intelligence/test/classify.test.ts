import type Anthropic from '@anthropic-ai/sdk';
import { buildSeed, DEMO_PROMPTS } from '@friction/shared';
import { describe, expect, it, vi } from 'vitest';
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


function fakeClient(impl: () => Promise<object>) {
  const parse = vi.fn().mockImplementation(impl);
  const intel = createIntelligence({ client: { messages: { parse } } as unknown as Anthropic, models: { classify: 'test-classify-model' } });
  return { intel, parse };
}
const reply = (concept: number | null, confidence: number) => async () => ({ stop_reason: 'end_turn', parsed_output: { concept, confidence } });

describe('classifyTopic LLM fallback', () => {
  it('skips the LLM when keywords hit', async () => {
    const { intel, parse } = fakeClient(reply(1, 0.9));
    expect((await intel.classifyTopic(DEMO_PROMPTS.question, nodes)).method).toBe('keyword');
    expect(parse).not.toHaveBeenCalled();
  });

  it('maps the numbered answer to a node id, low effort, with a timeout', async () => {
    const i = nodes.findIndex((n) => n.concept_name === 'Context API');
    const { intel, parse } = fakeClient(reply(i + 1, 0.8));
    const r = await intel.classifyTopic('how do I share a theme across deeply nested parts of my app', nodes);
    expect(r).toEqual({ node_id: idOf('Context API'), confidence: 0.8, method: 'llm' });
    const [params, opts] = parse.mock.calls[0];
    expect(params.model).toBe('test-classify-model');
    expect(params.output_config.effort).toBe('low');
    expect(params.messages[0].content).toContain('1. ' + nodes[0].concept_name);
    expect(opts.timeout).toBeLessThanOrEqual(3000);
  });

  it('null below 0.5 confidence, for null, or for an out-of-range number', async () => {
    for (const [c, conf] of [[1, 0.4], [null, 0.9], [99, 0.9]] as const) {
      const { intel } = fakeClient(reply(c, conf));
      expect(await intel.classifyTopic(`unmatched prompt ${c} ${conf}`, nodes)).toEqual({ node_id: null, confidence: 0, method: 'none' });
    }
  });

  it('caches by prompt + node ids; errors count as no match and are not cached', async () => {
    const { intel, parse } = fakeClient(reply(1, 0.9));
    await intel.classifyTopic('cache me please', nodes);
    await intel.classifyTopic('cache me please', [...nodes].reverse());
    expect(parse).toHaveBeenCalledTimes(1);
    await intel.classifyTopic('cache me please', nodes.slice(1));
    expect(parse).toHaveBeenCalledTimes(2);

    const failing = fakeClient(async () => { throw new Error('timeout'); });
    expect((await failing.intel.classifyTopic('flaky prompt', nodes)).node_id).toBeNull();
    await failing.intel.classifyTopic('flaky prompt', nodes);
    expect(failing.parse).toHaveBeenCalledTimes(2);
  });
});
