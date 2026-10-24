/** Real HTTP regression: failure after a delivered chunk must reject the body reader. No key or persistent store. */
import { createRequire } from 'node:module';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { makeApp } from '../apps/api/test/helpers';
import { fakeIntelligence, DEMO_PROMPTS, SEED_IDS } from '@friction/shared';

const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { serve } = requireApi('@hono/node-server') as {
  serve(options: { fetch: (request: Request) => Response | Promise<Response>; port: number; hostname: string }): Server;
};
let release!: () => void;
const fail = new Promise<void>(resolve => { release = resolve; });
const test = makeApp({ intel: { ...fakeIntelligence, chat: async function* () {
  yield 'Partial reply';
  await fail;
  throw new Error('synthetic upstream failure');
} } });
const server = serve({ fetch: req => test.app.fetch(req), port: 0, hostname: '127.0.0.1' });
try {
  if (!server.listening) await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing ephemeral listener');
  const response = await fetch(`http://127.0.0.1:${address.port}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ student_id: SEED_IDS.demoStudent, conversation_id: 'verify-stream-failure',
      messages: [{ role: 'user', content: DEMO_PROMPTS.question }] }),
  });
  if (response.status !== 200 || !response.body) throw new Error(`Expected started stream; HTTP ${response.status}`);
  const reader = response.body.getReader();
  const first = await reader.read();
  if (first.done || new TextDecoder().decode(first.value) !== 'Partial reply') throw new Error('Expected a delivered partial chunk');
  release(); // Only fail after the client received bytes, not merely after the server queued them.
  let rejected = false;
  try { while (!(await reader.read()).done) {} } catch { rejected = true; }
  if (!rejected) throw new Error('Upstream failure ended as clean EOF; client cannot detect interruption');
  const log = test.store.db.logs[0];
  if (log.llm_response !== 'Partial reply' || log.quiz_pending) throw new Error('Failure cleanup must retain partial text and close the quiz');
  console.log('PASS: real HTTP reader rejects after partial text; partial saved and quiz closed.');
} catch (error) {
  console.error(`FAIL: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  release();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
