import type { Hono } from 'hono';
import { DEFAULT_BYPASS_QUOTA, buildSeed, type DemoResetRequest } from '@friction/shared';
import type { Ctx } from '../context';
import { HttpError, notFound } from '../errors';
import { readJson } from '../lib/http';

export function demoRoutes(app: Hono, ctx: Ctx) {
  const { store, bus, config } = ctx;

  app.post('/demo/reset', async (c) => {
    if (!config.demo) throw new HttpError(404, 'demo_only', 'DEMO_MODE is off');
    const b = ((await readJson<DemoResetRequest>(c)) ?? {}) as DemoResetRequest;
    // Reset invalidates the affected one-use prompt-bypass tokens.
    if (b.full || !b.student_id) {
      ctx.promptTokens.clear();
      store.reset();
    } else {
      ctx.promptTokens.clearStudent(b.student_id);
      const db = store.db;
      const u = db.users.find((x) => x.id === b.student_id);
      if (!u) throw notFound('student');
      const seed = buildSeed();
      u.bypass_quota = seed.users.find((x) => x.id === u.id)?.bypass_quota ?? DEFAULT_BYPASS_QUOTA;
      // Seed-course states reset to the seed as before. If the student's active course is an uploaded one,
      // its states are recreated at L1/unpaused too, so intercepts keep working on that course after a reset.
      const seedNodes = new Set(seed.nodes.map((n) => n.id));
      const at = new Date().toISOString();
      const active = u.active_tree_id && !seed.trees.some((t) => t.id === u.active_tree_id)
        ? db.nodes.filter((n) => n.tree_id === u.active_tree_id && !seedNodes.has(n.id))
            .map((n) => ({ student_id: u.id, node_id: n.id, current_blooms_level: 1 as const, paused: false, updated_at: at }))
        : [];
      db.states = db.states.filter((s) => s.student_id !== u.id).concat(seed.states.filter((s) => s.student_id === u.id), active);
      db.logs = db.logs.filter((l) => l.student_id !== u.id);
      db.bypasses = db.bypasses.filter((x) => x.student_id !== u.id);
      store.save();
    }
    // Clients refetch tree + students on tree_updated.
    for (const t of store.db.trees) bus.publish(t.id, { type: 'tree_updated', data: { tree_id: t.id } });
    return c.json({ ok: true });
  });
}
