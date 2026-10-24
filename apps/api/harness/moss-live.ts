/** Paid, opt-in integration check: private HTTP servers and memory-only stores. */
import { serve } from '@hono/node-server';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAT_HEADERS, SEED_IDS } from '@friction/shared';
import { createApp } from '../src/app';
import { createCtx } from '../src/bootstrap';
import { loadConfig } from '../src/env';
import { loadIntelligence, type LoadedIntelligence } from '../src/intelligence';
import { createJsonStore } from '../src/store/json-store';
import type { RetrievalTrace } from '../src/services/moss-runtime';

const prompt = 'How do I share the selected theme with deeply nested descendants without passing it through every layer?';
let stage = 'configuration';
const evidence: object[] = [];
function record(value: object) { evidence.push(value); console.log(JSON.stringify(value)); }
// Never print provider exceptions, headers or credentials from this diagnostic process.
console.error = () => { record({ status: 'provider_diagnostic_suppressed', stage }); };
function check(value: unknown, label: string): asserts value {
  if (!value) throw new Error(label);
}
async function privateServer(store: ReturnType<typeof createJsonStore>, loaded: LoadedIntelligence) {
  const config = loadConfig({ API_PORT: '0', DEMO_MODE: '1', USE_REAL_INTELLIGENCE: '1' });
  const ctx = createCtx({ config, intel: loaded.intel, intelligenceMode: 'real', store });
  const server = serve({ fetch: createApp(ctx).fetch, hostname: '127.0.0.1', port: 0 });
  if (!server.listening) await once(server, 'listening');
  const address = server.address();
  check(address && typeof address !== 'string', 'HTTP binding');
  const base = `http://127.0.0.1:${address.port}`;
  return { base, close: async () => {
    if ('closeAllConnections' in server) server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await loaded.close();
  } };
}
async function waitUntil(predicate: () => boolean, timeout: number) {
  const until = Date.now() + timeout;
  while (!predicate() && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 100));
  check(predicate(), 'background preparation deadline');
}

async function main() {
  check(process.env.MOSS_PROJECT_ID && process.env.MOSS_PROJECT_KEY && process.env.ANTHROPIC_API_KEY &&
    process.env.MODEL_CLASSIFY && process.env.MODEL_CHAT, 'required configuration');
  const env = { ...process.env, USE_MOSS_RETRIEVAL: '1' };
  const store = createJsonStore(null);
  const traces: RetrievalTrace[] = [];
  const loaded = await loadIntelligence(true, { store, env, trace: (e) => {
    traces.push(e); evidence.push({ provider: 'moss', ...e }); console.log(`[moss] ${JSON.stringify(e)}`);
  } });
  const server = await privateServer(store, loaded);
  try {
    stage = 'startup';
    loaded.start();
    const health = await fetch(`${server.base}/health`);
    check(health.ok, 'health during warmup');
    await health.body?.cancel();
    record({ status: 'available_during_warmup', http: health.status });
    stage = 'prepare';
    await waitUntil(() => traces.some((e) => e.state === 'ready'), 60_000);
    stage = 'live_chat';
    const before = structuredClone(store.db.states);
    const context = store.db.nodes.find((n) => n.concept_name === 'Context API')!;
    const res = await fetch(`${server.base}/chat`, { method: 'POST', signal: AbortSignal.timeout(60_000),
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ student_id: SEED_IDS.demoStudent,
        conversation_id: 'moss-runtime-live-demo', messages: [{ role: 'user', content: prompt }] }) });
    const reply = await res.text();
    check(res.ok && res.headers.get(CHAT_HEADERS.nodeId) === context.id && reply.trim(), 'live policy-guided chat');
    check(traces.some((e) => e.state === 'retrieved' && e.candidates), 'Moss actually queried');
    check(JSON.stringify(store.db.states) === JSON.stringify(before), 'retrieval does not advance mastery');
    const log = store.db.logs.find((l) => l.conversation_id === 'moss-runtime-live-demo');
    check(log?.llm_response === reply, 'complete assistant reply stored');
    record({ status: 'live_chat_pass', http: res.status, concept: context.concept_name,
      level: res.headers.get(CHAT_HEADERS.level), quizAttached: res.headers.get(CHAT_HEADERS.quizAttached),
      replyCharacters: reply.length, endsWithQuestion: reply.trim().endsWith('?'),
      replyExcerpt: reply.slice(0, 400), masteryUnchanged: true });
  } finally { await server.close(); }

  stage = 'injected_failure';
  const baselineStore = createJsonStore(null);
  const fallbackTraces: RetrievalTrace[] = [];
  const module = await import('@friction/intelligence');
  const fallback = await loadIntelligence(true, { store: baselineStore, env, trace: (e) => fallbackTraces.push(e),
    load: async () => ({ ...module, mossFromEnv: () => new module.MossCurriculumRetriever(async () => {
      throw new Error('intentional unavailable runtime');
    }) }) });
  const fallbackServer = await privateServer(baselineStore, fallback);
  try {
    fallback.start();
    await waitUntil(() => fallbackTraces.some((e) => e.reason === 'unavailable'), 5000);
    const res = await fetch(`${fallbackServer.base}/intercept`, { method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ student_id: SEED_IDS.demoStudent,
        conversation_id: 'moss-runtime-fallback', app_source: 'sandbox', raw_prompt: prompt }) });
    const result = await res.json() as { node_id?: string; injected_prompt?: string };
    const context = baselineStore.db.nodes.find((n) => n.concept_name === 'Context API')!;
    check(res.ok && result.node_id === context.id, 'baseline fallback');
    check(!fallbackTraces.some((e) => e.state === 'retrieved'), 'no Moss hints during fallback');
    check(result.injected_prompt?.includes('Learning goal:'), 'policy after fallback');
    record({ status: 'live_fallback_pass', http: res.status, concept: context.concept_name,
      fault: 'intentionally injected Moss initialization failure; Claude is real' });
  } finally { await fallbackServer.close(); }
  record({ status: 'complete', privateMemoryOnly: true, sharedServicesUntouched: true });
}
main().catch(() => { record({ status: 'failed', stage }); process.exitCode = 1; }).finally(() => {
  const output = fileURLToPath(new URL('./results/moss-live.json', import.meta.url));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ timestamp: new Date().toISOString(), events: evidence }, null, 2) + '\n', 'utf8');
});
