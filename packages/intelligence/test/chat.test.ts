import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { createIntelligence } from '../src/index';

const delta = (text: string) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text } });

function fakeStream(events: object[], stop_reason = 'end_turn') {
  const abort = vi.fn();
  const stream = {
    async *[Symbol.asyncIterator]() {
      yield* events;
    },
    finalMessage: async () => ({ stop_reason }),
    abort,
  };
  const create = vi.fn().mockReturnValue(stream);
  return { client: { messages: { stream: create } } as unknown as Anthropic, create, abort };
}
const intel = (client: Anthropic) => createIntelligence({ client, models: { chat: 'test-chat-model' } });
const collect = async (it: AsyncIterable<string>) => {
  let s = '';
  for await (const t of it) s += t;
  return s;
};

describe('chat', () => {
  it('streams only text deltas and passes messages through untouched', async () => {
    const { client, create } = fakeStream([
      { type: 'message_start' },
      { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hmm' } },
      delta('Hello'),
      delta(' world'),
    ]);
    const messages = [{ role: 'user' as const, content: 'q\n\n⟦friction⟧\nLevel: 1 (Socratic)\n⟦/friction⟧' }];
    expect(await collect(intel(client).chat(messages))).toBe('Hello world');
    const [params] = create.mock.calls[0];
    expect(params.model).toBe('test-chat-model');
    expect(params.system).toBe('You are a helpful programming assistant.');
    expect(params.messages).toEqual(messages);
    expect(params).not.toHaveProperty('temperature');
  });

  it('forwards the signal and ends quietly when aborted', async () => {
    const ac = new AbortController();
    const client = {
      messages: {
        stream: vi.fn().mockReturnValue({
          async *[Symbol.asyncIterator]() {
            yield delta('a');
            ac.abort();
            throw new Error('aborted');
          },
          finalMessage: async () => ({}),
          abort: vi.fn(),
        }),
      },
    } as unknown as Anthropic;
    expect(await collect(intel(client).chat([{ role: 'user', content: 'x' }], { signal: ac.signal }))).toBe('a');
    expect((client.messages.stream as any).mock.calls[0][1].signal).toBe(ac.signal);
  });

  it('aborts the request when the consumer stops early', async () => {
    const { client, abort } = fakeStream([delta('a'), delta('b')]);
    for await (const _ of intel(client).chat([{ role: 'user', content: 'x' }])) break;
    expect(abort).toHaveBeenCalled();
  });

  it('throws on refusal and on API errors', async () => {
    await expect(collect(intel(fakeStream([], 'refusal').client).chat([{ role: 'user', content: 'x' }]))).rejects.toThrow(/refused/);
    const client = {
      messages: { stream: () => ({ async *[Symbol.asyncIterator]() { throw new Error('529 overloaded'); }, abort() {} }) },
    } as unknown as Anthropic;
    await expect(collect(intel(client).chat([{ role: 'user', content: 'x' }]))).rejects.toThrow(/overloaded/);
  });
});
