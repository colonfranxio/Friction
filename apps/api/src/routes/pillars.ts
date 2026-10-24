import type { Hono } from 'hono';
import type { RenamePillarRequest } from '@friction/shared';
import type { Ctx } from '../context';
import { badRequest, notFound } from '../errors';
import { isNonEmptyString, readObject } from '../lib/http';

export function pillarRoutes(app: Hono, ctx: Ctx) {
  const { store, bus } = ctx;

  app.patch('/pillars/:pillarId', async (c) => {
    const p = store.db.pillars.find((x) => x.id === c.req.param('pillarId'));
    if (!p) throw notFound('pillar');
    const b = await readObject<RenamePillarRequest>(c);
    if (!isNonEmptyString(b.name)) throw badRequest('name required');
    p.name = b.name;
    store.save();
    bus.publish(p.tree_id, { type: 'tree_updated', data: { tree_id: p.tree_id } });
    return c.json(p);
  });
}
