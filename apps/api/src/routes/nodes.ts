import type { Hono } from 'hono';
import type { UpdateNodeRequest } from '@friction/shared';
import type { Ctx } from '../context';
import { badRequest, notFound } from '../errors';
import { readObject } from '../lib/http';
import { isLevel } from './trees';

const EDITABLE = ['pillar_id', 'concept_name', 'mastery_criteria', 'required_blooms_level', 'size', 'icon', 'keywords', 'position'] as const;

export function nodeRoutes(app: Hono, ctx: Ctx) {
  const { store, bus } = ctx;

  app.patch('/nodes/:nodeId', async (c) => {
    const db = store.db;
    const n = db.nodes.find((x) => x.id === c.req.param('nodeId'));
    if (!n) throw notFound('node');
    const b = await readObject<UpdateNodeRequest>(c);
    if (b.required_blooms_level !== undefined && !isLevel(b.required_blooms_level)) {
      throw badRequest('required_blooms_level must be 1-4');
    }
    if (b.size !== undefined && b.size !== 'major' && b.size !== 'minor') throw badRequest('size must be major or minor');
    if (b.pillar_id !== undefined && !db.pillars.some((p) => p.id === b.pillar_id && p.tree_id === n.tree_id)) {
      throw badRequest('pillar_id does not belong to this tree');
    }
    if (b.concept_name !== undefined && (typeof b.concept_name !== 'string' || !b.concept_name.trim())) {
      throw badRequest('concept_name must be a non-empty string');
    }
    for (const key of EDITABLE) {
      if (b[key] !== undefined) (n as unknown as Record<string, unknown>)[key] = b[key];
    }
    store.save();
    bus.publish(n.tree_id, { type: 'tree_updated', data: { tree_id: n.tree_id } });
    return c.json(n);
  });

  app.delete('/nodes/:nodeId', (c) => {
    const db = store.db;
    const n = db.nodes.find((x) => x.id === c.req.param('nodeId'));
    if (!n) throw notFound('node');
    db.nodes = db.nodes.filter((x) => x.id !== n.id);
    db.edges = db.edges.filter((e) => e.parent_node_id !== n.id && e.child_node_id !== n.id);
    db.states = db.states.filter((s) => s.node_id !== n.id);
    db.logs = db.logs.filter((l) => l.node_id !== n.id);
    db.bypasses = db.bypasses.filter((b) => b.node_id !== n.id);
    store.save();
    bus.publish(n.tree_id, { type: 'tree_updated', data: { tree_id: n.tree_id } });
    return c.body(null, 204);
  });
}
