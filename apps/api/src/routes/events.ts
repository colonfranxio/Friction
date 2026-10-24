import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Ctx } from '../context';
import { badRequest } from '../errors';

const PING_MS = 15_000;

export function eventRoutes(app: Hono, ctx: Ctx) {
  app.get('/events', (c) => {
    const treeId = c.req.query('tree_id');
    if (!treeId) throw badRequest('tree_id required');
    c.header('X-Accel-Buffering', 'no');
    return streamSSE(c, async (stream) => {
      let open = true;
      const unsubscribe = ctx.bus.subscribe(treeId, (ev) => {
        if (!open) return;
        stream.writeSSE({ event: ev.type, data: JSON.stringify(ev.data) }).catch(() => (open = false));
      });
      stream.onAbort(() => {
        open = false;
        unsubscribe();
      });
      await stream.write(': connected\n\n');
      while (open) {
        await stream.sleep(PING_MS);
        if (!open) break;
        try {
          await stream.write(': ping\n\n');
        } catch {
          break;
        }
      }
      open = false;
      unsubscribe();
    });
  });
}
