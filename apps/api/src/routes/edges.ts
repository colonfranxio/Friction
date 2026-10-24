import type { Hono } from 'hono';
import { wouldCreateCycle, type CreateEdgeRequest, type Edge } from '@friction/shared';
import type { Ctx } from '../context';
import { HttpError, badRequest, notFound } from '../errors';
import { isNonEmptyString, readObject } from '../lib/http';

export function edgeRoutes(app: Hono, ctx: Ctx) {
  const { store, bus } = ctx;

  app.post('/edges', async (c) => {
    const db = store.db;
    const b = await readObject<CreateEdgeRequest>(c);
    if (!isNonEmptyString(b.parent_node_id) || !isNonEmptyString(b.child_node_id)) {
      throw badRequest('parent_node_id and child_node_id required');
    }
    const p = db.nodes.find((n) => n.id === b.parent_node_id);
    const ch = db.nodes.find((n) => n.id === b.child_node_id);
    if (!p || !ch) throw notFound('node');
    if (p.tree_id !== ch.tree_id) throw badRequest('nodes are in different trees');
    if (p.id === ch.id) throw new HttpError(409, 'cycle', 'a node cannot depend on itself');
    const existing = db.edges.find((e) => e.parent_node_id === p.id && e.child_node_id === ch.id);
    if (existing) return c.json(existing);
    if (wouldCreateCycle(db.edges, p.id, ch.id)) throw new HttpError(409, 'cycle', 'edge would create a cycle');
    const e: Edge = { tree_id: p.tree_id, parent_node_id: p.id, child_node_id: ch.id };
    db.edges.push(e);
    store.save();
    bus.publish(p.tree_id, { type: 'tree_updated', data: { tree_id: p.tree_id } });
    return c.json(e);
  });

  app.delete('/edges/:parentId/:childId', (c) => {
    const db = store.db;
    const e = db.edges.find((x) => x.parent_node_id === c.req.param('parentId') && x.child_node_id === c.req.param('childId'));
    if (!e) throw notFound('edge');
    db.edges = db.edges.filter((x) => x !== e);
    store.save();
    bus.publish(e.tree_id, { type: 'tree_updated', data: { tree_id: e.tree_id } });
    return c.body(null, 204);
  });
}
