/** Public demo boundary: each bearer URL has its own app, store, event bus and model runtime. */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { SEED_IDS, type Intelligence } from '@friction/shared';
import { createApp } from './app';
import { createCtx } from './bootstrap';
import type { Config } from './env';
import { HttpError } from './errors';
import { loadIntelligence, type LoadedIntelligence } from './intelligence';
import { createJsonStore } from './store/json-store';
import type { Store } from './store/store';

const TTL = 30 * 60_000;
const MAX_SESSIONS = 2;
const MAX_REQUESTS = 150;
const MAX_MODEL_OPS = 20;

/** Persistent, fail-closed reservation ledger; single Node instance only. Failed work still counts. */
export class PublicLedger {
  private state: { day: string; sessions: number; operations: number };
  constructor(private path: string, private now = () => Date.now()) {
    try { this.state = JSON.parse(readFileSync(path, 'utf8')); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      this.state = { day: '', sessions: 0, operations: 0 };
    }
    if (typeof this.state.day !== 'string' || !Number.isSafeInteger(this.state.sessions) || !Number.isSafeInteger(this.state.operations) || this.state.sessions < 0 || this.state.operations < 0) throw new Error('Invalid public usage ledger');
  }
  reserve(kind: 'sessions' | 'operations') {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const next = this.state.day === day ? { ...this.state } : { day, sessions: 0, operations: 0 };
    if (next[kind] >= (kind === 'sessions' ? 20 : 60)) throw new HttpError(429, 'bad_request', 'Daily demo allowance reached.');
    next[kind]++;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(`${this.path}.tmp`, JSON.stringify(next), { mode: 0o600 });
    renameSync(`${this.path}.tmp`, this.path);
    this.state = next;
  }
}

export async function createPublicDemo(config: Config, opts: {
  ledger: PublicLedger;
  load?: typeof loadIntelligence;
  now?: () => number;
}) {
  const app = new Hono();
  const now = opts.now ?? Date.now;
  const sessions = new Map<string, { app: Hono; store: Store; expires: number; requests: number; active: number; writing: boolean; runtime: LoadedIntelligence }>();
  let creating = false;
  let modelBusy = false;
  app.use('*', cors({ origin: (o) => config.allowedOrigins?.includes(o) || o.startsWith('chrome-extension://') ? o : null }));
  app.use('*', bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: { code: 'body_limit', message: 'Demo requests are limited to 64 KiB.' } }, 413) }));
  app.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); c.header('Referrer-Policy', 'no-referrer'); await next(); });
  app.onError((e, c) => e instanceof HttpError ? c.json(e.toBody(), e.status) : c.json({ error: { code: 'internal', message: 'Demo unavailable.' } }, 503));
  app.get('/health', (c) => c.json({ status: 'ok', mode: 'public-guest', contract_version: 4 }));
  async function sweep() {
    for (const [key, s] of sessions) if (s.expires <= now() && s.active === 0) {
      sessions.delete(key);
      // No replacement native indexes until close actually finishes.
      await s.runtime.close();
    }
  }
  app.post('/guest', async (c) => {
    if (creating) throw new HttpError(429, 'bad_request', 'Session creation is busy. Retry shortly.');
    creating = true;
    try {
      await sweep();
      if (sessions.size >= MAX_SESSIONS) throw new HttpError(429, 'bad_request', 'All demo slots are occupied. Try later.');
      opts.ledger.reserve('sessions');
      const store = createJsonStore(null);
      const runtime = await (opts.load ?? loadIntelligence)(config.useRealIntelligence, { store });
      let operations = 0;
      async function paid<T>(fn: () => Promise<T>): Promise<T> {
        if (modelBusy || operations >= MAX_MODEL_OPS) throw new HttpError(429, 'bad_request', 'Demo model allowance or concurrency limit reached.');
        opts.ledger.reserve('operations');
        operations++;
        modelBusy = true;
        try { return await fn(); } finally { modelBusy = false; }
      }
      const intel: Intelligence = {
        buildFrictionPrompt: (v) => runtime.intel.buildFrictionPrompt(v),
        parseSyllabus: (v) => paid(async () => {
          const tree = await runtime.intel.parseSyllabus(v);
          if (tree.nodes.length > 32 || tree.pillars.length > 8) throw new HttpError(413, 'bad_request', 'Syllabus is too large for this demo.');
          return tree;
        }),
        classifyTopic: (p, n) => paid(() => runtime.intel.classifyTopic(p, n)),
        evaluateExchange: (v) => paid(() => runtime.intel.evaluateExchange(v)),
        // Public judging uses Claude's website; server-side sandbox chat is intentionally disabled.
        chat: async function* () { throw new HttpError(403, 'bad_request', 'Use the Claude extension for the public demo.'); },
      };
      const ctx = createCtx({ config: { ...config, demo: false }, intel, store, intelligenceMode: config.useRealIntelligence ? 'real' : 'fake' });
      const token = randomBytes(32).toString('hex');
      const expires = now() + TTL;
      sessions.set(token, { app: createApp(ctx), store, expires, requests: 0, active: 0, writing: false, runtime });
      runtime.start();
      return c.json({ api_path: `/g/${token}`, student_id: SEED_IDS.demoStudent, tree_id: SEED_IDS.tree, expires_at: new Date(expires).toISOString() }, 201);
    } finally { creating = false; }
  });
  app.all('/g/:token/*', async (c) => {
    const s = sessions.get(c.req.param('token'));
    if (!s || s.expires <= now()) throw new HttpError(401, 'bad_request', 'Start a new guest session.');
    if (++s.requests > MAX_REQUESTS || s.active >= 4) throw new HttpError(429, 'bad_request', 'Guest request allowance reached.');
    const url = new URL(c.req.url);
    url.pathname = url.pathname.replace(/^\/g\/[^/]+/, '') || '/';
    if (url.pathname === '/chat' || url.pathname.startsWith('/demo/')) throw new HttpError(403, 'bad_request', 'This operation is not available in the public demo.');
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method);
    if (write && s.writing) throw new HttpError(429, 'bad_request', 'Another guest update is in progress.');
    let nodeTree = url.pathname.match(/^\/trees\/([^/]+)\/nodes$/)?.[1];
    try { if (nodeTree) nodeTree = decodeURIComponent(nodeTree); }
    catch { throw new HttpError(400, 'bad_request', 'Invalid tree URL.'); }
    if (c.req.method === 'POST' || c.req.method === 'PATCH') {
      // Uploaded syllabus gets 64 KiB; metadata edits get only 4 KiB to bound later model context.
      if (url.pathname !== '/trees/parse' && (await c.req.raw.clone().arrayBuffer()).byteLength > 4096) throw new HttpError(413, 'bad_request', 'Demo metadata is limited to 4 KiB per edit.');
    }
    const request = new Request(url, c.req.raw);
    if (s.active >= 4) throw new HttpError(429, 'bad_request', 'Guest concurrency allowance reached.');
    if (write && s.writing) throw new HttpError(429, 'bad_request', 'Another guest update is in progress.');
    if (c.req.method === 'POST' && nodeTree && s.store.db.nodes.filter((n) => n.tree_id === nodeTree).length >= 32) throw new HttpError(413, 'bad_request', 'Demo trees are limited to 32 nodes.');
    if (write) s.writing = true;
    s.active++;
    let response: Response;
    try { response = await s.app.fetch(request); } catch (e) { s.active--; throw e; } finally { if (write) s.writing = false; }
    if (!response.body) { s.active--; return response; }
    const reader = response.body.getReader();
    let done = false;
    const release = () => { if (!done) { done = true; s.active--; } };
    let timer: ReturnType<typeof setTimeout>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { timer = setTimeout(() => { release(); void reader.cancel(); controller.close(); }, Math.min(90_000, Math.max(1, s.expires - now()))); },
      async pull(controller) {
        try {
          const chunk = await reader.read();
          if (done) return;
          if (chunk.done) { clearTimeout(timer); release(); controller.close(); }
          else controller.enqueue(chunk.value);
        } catch (e) { if (!done) { clearTimeout(timer); release(); controller.error(e); } }
      },
      async cancel() { clearTimeout(timer); release(); await reader.cancel(); },
    });
    return new Response(body, { status: response.status, headers: response.headers });
  });
  const cleanup = setInterval(() => {
    if (creating) return;
    creating = true;
    void sweep().catch(() => {}).finally(() => { creating = false; });
  }, 30_000);
  cleanup.unref();
  return { app, close: async () => { clearInterval(cleanup); for (const s of sessions.values()) await s.runtime.close(); sessions.clear(); } };
}
