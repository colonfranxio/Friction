import type Anthropic from '@anthropic-ai/sdk';
import { buildSeed } from '@friction/shared';
import { describe, expect, it, vi } from 'vitest';

// Simulates a platform where the optional native SDK failed to install or load.
vi.mock('@moss-js/moss', () => { throw new Error('native module unavailable'); });

const { createIntelligence, mossFromEnv } = await import('../src/index');
const nodes = buildSeed().nodes;

describe('missing optional native SDK', () => {
  it('imports the package and degrades to the baseline classifier', async () => {
    const retriever = mossFromEnv({ MOSS_PROJECT_ID: 'project', MOSS_PROJECT_KEY: 'key' })!;
    expect(await retriever.prepare(nodes)).toBe(false);
    expect(await retriever.retrieve('a novel question', nodes)).toEqual([]);
    const parse = vi.fn(async () => ({ stop_reason: 'end_turn', parsed_output: { concept: 1, confidence: 0.8 } }));
    const intel = createIntelligence({ client: { messages: { parse } } as unknown as Anthropic, models: { classify: 'test-model' },
      curriculumRetriever: retriever });
    expect((await intel.classifyTopic('a novel question', nodes)).node_id).toBe(nodes[0].id);
    const [params] = (parse.mock.calls as unknown[][])[0] as [{ messages: { content: string }[] }];
    expect(params.messages[0].content).not.toContain('Search suggests');
    await retriever.close();
  });
});
