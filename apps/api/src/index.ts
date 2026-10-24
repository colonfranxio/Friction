import { serve } from '@hono/node-server';
import { CONTRACT_VERSION } from '@friction/shared';
import { createApp } from './app';
import { createCtx } from './bootstrap';
import { loadConfig } from './env';
import { loadIntelligence } from './intelligence';
import { defaultDbPath } from './lib/paths';
import { createJsonStore } from './store/json-store';

// A failed background promise must never take the demo down.
process.on('unhandledRejection', (reason) => console.error('[api] unhandled rejection:', reason));
process.on('uncaughtException', (err) => console.error('[api] uncaught exception:', err));

const config = loadConfig();
if (config.useRealIntelligence && !process.env.ANTHROPIC_API_KEY) {
  console.warn('[api] USE_REAL_INTELLIGENCE=1 but ANTHROPIC_API_KEY is not set (add it to .env). Model calls will fail with llm_error.');
}
const dbPath = defaultDbPath();
const store = createJsonStore(dbPath);
const intelligence = await loadIntelligence(config.useRealIntelligence, { store });
const intel = intelligence.intel;
const ctx = createCtx({
  config,
  intel,
  intelligenceMode: config.useRealIntelligence ? 'real' : 'fake',
  store,
});
const app = createApp(ctx);
intelligence.start();

// No hostname: binds dual-stack so http://127.0.0.1:<port> works on Windows too.
const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  const base = `http://127.0.0.1:${info.port}`;
  console.log(
    [
      '',
      `  Friction API  (contract v${CONTRACT_VERSION})`,
      `  ${base}`,
      `  health  ${base}/health`,
      `  events  ${base}/events?tree_id=<tree id>`,
      `  mode    intelligence=${ctx.intelligenceMode}  demo=${config.demo ? 'on' : 'off'}  budget=${config.interceptBudgetMs}ms`,
      `  store   ${dbPath}`,
      '',
    ].join('\n'),
  );
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[api] port ${config.port} is already in use. Stop the other server (npx kill-port ${config.port}) or set API_PORT.`);
  } else {
    console.error('[api] server error:', err);
  }
  process.exit(1);
});

async function shutdown() {
  // close() stops Moss polling synchronously. Persistence is never cut short; only native
  // disposal, which may hang and cannot be cancelled, is capped.
  const closing = intelligence.close().catch(() => {});
  await store.flush();
  await Promise.race([closing, new Promise((resolve) => setTimeout(resolve, 2000))]);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
