import type Anthropic from '@anthropic-ai/sdk';
import { fakeParse } from '@friction/shared';
import { describe, expect, it, vi } from 'vitest';
import { createIntelligence } from '../src/index';

function fakeClient(final: object) {
  const stream = vi.fn().mockReturnValue({ finalMessage: async () => ({ stop_reason: 'end_turn', ...final }) });
  return { client: { messages: { stream } } as unknown as Anthropic, stream };
}
const intel = (client: Anthropic) => createIntelligence({ client, models: { parse: 'test-parse-model' } });
const seed = fakeParse({ kind: 'text', text: '' });

describe('parseSyllabus', () => {
  it('text: high-effort structured request, then validated', async () => {
    const { client, stream } = fakeClient({ parsed_output: { ...structuredClone(seed), nodes: [...seed.nodes, { ...seed.nodes[0] }] } });
    const out = await intel(client).parseSyllabus({ kind: 'text', text: 'SYLLABUS BODY' });
    expect(out.nodes.map((n) => n.key)).toEqual([...seed.nodes.map((n) => n.key), 'n1_9']); // dup key fixed
    const [params] = stream.mock.calls[0];
    expect(params.model).toBe('test-parse-model');
    expect(params.output_config.effort).toBe('high');
    expect(params.output_config.format).toBeTruthy();
    expect(params).not.toHaveProperty('temperature');
    const content = params.messages[0].content;
    expect(content[0]).toEqual({ type: 'text', text: expect.stringContaining('SYLLABUS BODY') });
    expect(content.at(-1).text).toMatch(/3 to 5 course modules/);
  });

  it('pdf: base64 document block comes before the instruction', async () => {
    const { client, stream } = fakeClient({ parsed_output: structuredClone(seed) });
    await intel(client).parseSyllabus({ kind: 'pdf', base64: 'JVBERi0=' });
    const content = stream.mock.calls[0][0].messages[0].content;
    expect(content[0]).toEqual({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' } });
    expect(content[1].type).toBe('text');
  });

  it('throws on max_tokens / refusal / missing output', async () => {
    for (const final of [{ stop_reason: 'max_tokens', parsed_output: seed }, { stop_reason: 'refusal' }, { parsed_output: null }]) {
      await expect(intel(fakeClient(final).client).parseSyllabus({ kind: 'text', text: 'x' })).rejects.toThrow(/unusable/);
    }
  });
});
