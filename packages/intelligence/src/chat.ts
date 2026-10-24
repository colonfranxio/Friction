import type { ChatMessage } from '@friction/shared';
import type { Config } from './config';

const SYSTEM = 'You are a helpful programming assistant.';

/** Streams text deltas from MODEL_CHAT. The friction block in the last user message is passed through untouched. */
export async function* chat(cfg: Config, messages: ChatMessage[], opts: { signal?: AbortSignal } = {}): AsyncIterable<string> {
  const stream = cfg.client().messages.stream(
    { model: cfg.model('chat'), max_tokens: 8192, system: SYSTEM, messages },
    { signal: opts.signal },
  );
  try {
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') yield ev.delta.text;
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new Error('chat: model refused');
  } catch (err) {
    if (opts.signal?.aborted) return; // caller cancelled: end quietly, like the fake
    throw err;
  } finally {
    stream.abort(); // no-op when finished; stops the request if the consumer broke out early
  }
}
