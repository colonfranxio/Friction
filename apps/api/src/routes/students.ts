import type { Hono } from 'hono';
import type { StudentStateResponse } from '@friction/shared';
import type { Ctx } from '../context';
import { notFound } from '../errors';

export function studentRoutes(app: Hono, ctx: Ctx) {
  app.get('/students/:studentId', (c) => {
    const db = ctx.store.db;
    const u = db.users.find((x) => x.id === c.req.param('studentId'));
    if (!u) throw notFound('student');
    const nodeIds = new Set(db.nodes.filter((n) => n.tree_id === u.active_tree_id).map((n) => n.id));
    const body: StudentStateResponse = {
      user: u,
      tree_id: u.active_tree_id,
      states: db.states.filter((s) => s.student_id === u.id && nodeIds.has(s.node_id)),
    };
    return c.json(body);
  });
}
