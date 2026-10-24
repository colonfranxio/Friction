import type { Hono } from 'hono';
import type {
  ActivityItem,
  BloomLevel,
  CreateNodeRequest,
  ParseTreeRequest,
  SkillNode,
  StudentNodeState,
  TreeActivityResponse,
  TreeBundle,
  TreeStudentsResponse,
} from '@friction/shared';
import type { Ctx } from '../context';
import { badRequest, notFound } from '../errors';
import { isNonEmptyString, readObject } from '../lib/http';
import { activityFromLog } from '../services/activity';
import { parseTree } from '../services/parse';
import { randomUUID } from 'node:crypto';

const LEVELS = [1, 2, 3, 4];
export const isLevel = (v: unknown): v is BloomLevel => typeof v === 'number' && LEVELS.includes(v);

export function treeRoutes(app: Hono, ctx: Ctx) {
  const { store, bus } = ctx;

  app.post('/trees/parse', async (c) => {
    const b = await readObject<ParseTreeRequest>(c);
    if (b.kind === 'pdf') {
      if (!isNonEmptyString((b as { base64?: unknown }).base64)) throw badRequest('base64 required for kind "pdf"');
    } else if (b.kind === 'text') {
      if (!isNonEmptyString((b as { text?: unknown }).text)) throw badRequest('text required for kind "text"');
    } else {
      throw badRequest('kind must be pdf or text');
    }
    return c.json(await parseTree(ctx, b as ParseTreeRequest));
  });

  app.get('/trees/:treeId', (c) => {
    const db = store.db;
    const tree = db.trees.find((t) => t.id === c.req.param('treeId'));
    if (!tree) throw notFound('tree');
    const body: TreeBundle = {
      tree,
      pillars: db.pillars.filter((p) => p.tree_id === tree.id).sort((a, b) => a.order - b.order),
      nodes: db.nodes.filter((n) => n.tree_id === tree.id),
      edges: db.edges.filter((e) => e.tree_id === tree.id),
    };
    return c.json(body);
  });

  app.post('/trees/:treeId/nodes', async (c) => {
    const db = store.db;
    const treeId = c.req.param('treeId');
    if (!db.trees.some((t) => t.id === treeId)) throw notFound('tree');
    const b = await readObject<CreateNodeRequest>(c);
    if (!isNonEmptyString(b.concept_name) || !isNonEmptyString(b.pillar_id)) {
      throw badRequest('concept_name and pillar_id required');
    }
    if (!db.pillars.some((p) => p.id === b.pillar_id && p.tree_id === treeId)) {
      throw badRequest('pillar_id does not belong to this tree');
    }
    if (b.required_blooms_level !== undefined && !isLevel(b.required_blooms_level)) {
      throw badRequest('required_blooms_level must be 1-4');
    }
    if (b.size !== undefined && b.size !== 'major' && b.size !== 'minor') throw badRequest('size must be major or minor');
    const n: SkillNode = {
      id: randomUUID(),
      tree_id: treeId,
      pillar_id: b.pillar_id,
      concept_name: b.concept_name,
      mastery_criteria: b.mastery_criteria ?? '',
      required_blooms_level: b.required_blooms_level ?? 4,
      size: b.size ?? 'minor',
      icon: b.icon ?? 'circle',
      keywords: b.keywords ?? [],
      position: b.position ?? null,
    };
    db.nodes.push(n);
    const at = new Date().toISOString();
    for (const u of db.users.filter((x) => x.role === 'student' && x.active_tree_id === treeId)) {
      db.states.push({ student_id: u.id, node_id: n.id, current_blooms_level: 1, paused: false, updated_at: at });
    }
    store.save();
    bus.publish(treeId, { type: 'tree_updated', data: { tree_id: treeId } });
    return c.json(n);
  });

  app.get('/trees/:treeId/students', (c) => {
    const db = store.db;
    const treeId = c.req.param('treeId');
    const nodeIds = new Set(db.nodes.filter((n) => n.tree_id === treeId).map((n) => n.id));
    const body: TreeStudentsResponse = {
      students: db.users
        .filter((u) => u.role === 'student' && u.active_tree_id === treeId)
        .map((u) => ({ user: u, states: db.states.filter((s: StudentNodeState) => s.student_id === u.id && nodeIds.has(s.node_id)) })),
    };
    return c.json(body);
  });

  app.get('/trees/:treeId/activity', (c) => {
    const db = store.db;
    const nodeIds = new Set(db.nodes.filter((n) => n.tree_id === c.req.param('treeId')).map((n) => n.id));
    const items: ActivityItem[] = [
      ...db.logs.filter((l) => nodeIds.has(l.node_id)).map((l) => activityFromLog(db, l, l.verdict ? 'graded' : 'intercept')),
      ...db.bypasses
        .filter((b) => nodeIds.has(b.node_id))
        .map<ActivityItem>((b) => ({
          id: b.id,
          kind: 'bypass',
          student_id: b.student_id,
          student_name: db.users.find((u) => u.id === b.student_id)?.name ?? '?',
          node_id: b.node_id,
          concept_name: db.nodes.find((n) => n.id === b.node_id)?.concept_name ?? '?',
          level: 4,
          verdict: null,
          confidence: null,
          rationale: null,
          created_at: b.created_at,
        })),
    ];
    const body: TreeActivityResponse = {
      items: items.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50),
    };
    return c.json(body);
  });
}
