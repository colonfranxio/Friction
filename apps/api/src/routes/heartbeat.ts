import type { Hono } from 'hono';
import type { HeartbeatRequest } from '@friction/shared';
import type { Ctx } from '../context';
import { badRequest, notFound } from '../errors';
import { isNonEmptyString, readObject } from '../lib/http';

/** Cut from the MVP but kept as a cheap route: updates last_seen_at and emits student_seen. */
export function heartbeatRoutes(app: Hono, ctx: Ctx) {
  app.post('/heartbeat', async (c) => {
    const b = await readObject<HeartbeatRequest>(c);
    if (!isNonEmptyString(b.student_id)) throw badRequest('student_id required');
    const u = ctx.store.db.users.find((x) => x.id === b.student_id);
    if (!u) throw notFound('student');
    u.last_seen_at = new Date().toISOString();
    ctx.store.save();
    if (u.active_tree_id) {
      ctx.bus.publish(u.active_tree_id, {
        type: 'student_seen',
        data: { student_id: u.id, last_seen_at: u.last_seen_at, enabled: b.enabled !== false },
      });
    }
    return c.body(null, 204);
  });
}
