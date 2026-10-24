/**
 * A↔B cancellation regression, with injected SDK and an in-memory store.
 * No credentials, network service, persistent data or builder edits required.
 * Run: pnpm exec tsx scripts/verify-chat-abort.ts
 */
import { setTimeout as delay } from 'node:timers/promises';
import { DEMO_PROMPTS, SEED_IDS } from '@friction/shared';
import { makeApp } from '../apps/api/test/helpers';
import { createIntelligence, type IntelligenceOptions } from '../packages/intelligence/src/index';

let aborted = false;
const partial = 'Partial reply';
const client = {
  messages: {
    stream(_request: unknown, options: { signal: AbortSignal }) {
      return {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: partial } };
          await new Promise<never>((_resolve, reject) => {
            const stop = () => { aborted = true; reject(new Error('synthetic abort')); };
            if (options.signal.aborted) stop();
            else options.signal.addEventListener('abort', stop, { once: true });
          });
        },
        finalMessage: async () => ({ stop_reason: 'end_turn' }),
        abort() {},
      };
    },
  },
} as unknown as NonNullable<IntelligenceOptions['client']>;

try {
  const test = makeApp({ intel: createIntelligence({ client, models: { chat: 'injected-test-model' } }) });
  const response = await test.app.request('/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ student_id: SEED_IDS.demoStudent, conversation_id: 'verify-cancel',
      messages: [{ role: 'user', content: DEMO_PROMPTS.question }] }),
  });
  if (response.status !== 200 || !response.body) throw new Error(`Expected chat stream, HTTP ${response.status}`);
  const reader = response.body.getReader();
  const first = await reader.read();
  if (first.done || new TextDecoder().decode(first.value) !== partial) throw new Error('Expected the injected partial chunk');
  await reader.cancel();
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline && test.store.db.logs[0]?.llm_response !== partial) await delay(10);
  const log = test.store.db.logs[0];
  if (!aborted || log?.llm_response !== partial) throw new Error('Cancellation or stream cleanup did not execute');
  if (log.quiz_pending) throw new Error('A↔B cancellation: interrupted reply left quiz_pending=true; expected false');
  console.log('PASS: interrupted B stream aborts, retains partial reply and closes the pending quiz.');
} catch (error) {
  console.error(`FAIL: ${(error as Error).message}`);
  process.exitCode = 1;
}
