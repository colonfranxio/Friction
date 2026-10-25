import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { CHAT_HEADERS } from '@friction/shared';
import type { Ctx } from './context';
import { HttpError } from './errors';
import { bypassRoutes } from './routes/bypass';
import { chatRoutes } from './routes/chat';
import { demoRoutes } from './routes/demo';
import { edgeRoutes } from './routes/edges';
import { eventRoutes } from './routes/events';
import { healthRoutes } from './routes/health';
import { heartbeatRoutes } from './routes/heartbeat';
import { interceptRoutes } from './routes/intercept';
import { nodeRoutes } from './routes/nodes';
import { pillarRoutes } from './routes/pillars';
import { studentRoutes } from './routes/students';
import { treeRoutes } from './routes/trees';

const DEV_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);

export function createApp(ctx: Ctx): Hono {
  const app = new Hono();

  // CORS: dashboard dev origin, any Chrome extension, and `*` in DEMO_MODE.
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (ctx.config.demo) return '*';
        if (origin && (DEV_ORIGINS.has(origin) || ctx.config.allowedOrigins?.includes(origin) || origin.startsWith('chrome-extension://'))) return origin;
        return null;
      },
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type'],
      exposeHeaders: Object.values(CHAT_HEADERS),
    }),
  );

  healthRoutes(app, ctx);
  treeRoutes(app, ctx);
  nodeRoutes(app, ctx);
  edgeRoutes(app, ctx);
  pillarRoutes(app, ctx);
  studentRoutes(app, ctx);
  interceptRoutes(app, ctx);
  bypassRoutes(app, ctx);
  chatRoutes(app, ctx);
  eventRoutes(app, ctx);
  heartbeatRoutes(app, ctx);
  demoRoutes(app, ctx);

  // Every non-2xx is {error:{code,message}} (contracts §12).
  app.notFound((c) => c.json(new HttpError(404, 'not_found', `route ${c.req.method} ${new URL(c.req.url).pathname} not found`).toBody(), 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json(err.toBody(), err.status);
    console.error('[api] unhandled error:', err);
    return c.json(new HttpError(500, 'internal', err instanceof Error ? err.message : String(err)).toBody(), 500);
  });

  return app;
}
