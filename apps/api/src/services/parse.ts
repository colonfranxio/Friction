import { randomUUID } from 'node:crypto';
import {
  ICON_KEYWORDS,
  SEED_IDS,
  buildSeed,
  clampLevel,
  wouldCreateCycle,
  type Edge,
  type ParseTreeRequest,
  type ParseTreeResponse,
  type ParsedTree,
  type Pillar,
  type SkillNode,
  type StudentNodeState,
  type Tree,
  type UUID,
} from '@friction/shared';
import type { Ctx } from '../context';
import { HttpError } from '../errors';
import type { DB } from '../store/store';

const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function demoStudent(db: DB) {
  return db.users.find((u) => u.id === SEED_IDS.demoStudent) ?? db.users.find((u) => u.role === 'student');
}

/**
 * Restores the seed tree (tree row, pillars, nodes, edges), every seed student's states,
 * quota and logs, and points the demo student back at it. Other (parsed) trees are untouched.
 */
export function resetSeedTree(db: DB): void {
  const seed = buildSeed();
  const seedNodeIds = new Set(seed.nodes.map((n) => n.id));

  db.trees = db.trees.filter((t) => t.id !== SEED_IDS.tree).concat(seed.trees);
  db.pillars = db.pillars.filter((p) => p.tree_id !== SEED_IDS.tree).concat(seed.pillars);
  db.nodes = db.nodes.filter((n) => n.tree_id !== SEED_IDS.tree).concat(seed.nodes);
  db.edges = db.edges.filter((e) => e.tree_id !== SEED_IDS.tree).concat(seed.edges);
  db.states = db.states.filter((s) => !seedNodeIds.has(s.node_id)).concat(seed.states);
  db.logs = db.logs.filter((l) => !seedNodeIds.has(l.node_id));
  db.bypasses = db.bypasses.filter((b) => !seedNodeIds.has(b.node_id));

  for (const su of seed.users) {
    const existing = db.users.find((u) => u.id === su.id);
    if (existing) Object.assign(existing, su);
    else db.users.push(su);
  }
}

/** Validates the LLM's ParsedTree and turns it into rows. Throws 502 llm_error if it's unusable. */
export function buildRowsFromParsed(
  parsed: ParsedTree,
  educatorId: UUID,
  meta: { title?: string; source_ref: string | null },
): { tree: Tree; pillars: Pillar[]; nodes: SkillNode[]; edges: Edge[] } {
  if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
    throw new HttpError(502, 'llm_error', 'parser returned no concepts');
  }
  const tree: Tree = {
    id: randomUUID(),
    educator_id: educatorId,
    title: (meta.title || parsed.title || 'Untitled course').trim(),
    source_ref: meta.source_ref,
    created_at: now(),
  };

  const pillarNames: string[] = [];
  for (const name of parsed.pillars ?? []) if (name && !pillarNames.includes(name)) pillarNames.push(name);
  for (const n of parsed.nodes) if (n.pillar && !pillarNames.includes(n.pillar)) pillarNames.push(n.pillar);
  if (pillarNames.length === 0) pillarNames.push('Concepts');
  const pillars: Pillar[] = pillarNames.map((name, order) => ({ id: randomUUID(), tree_id: tree.id, name, order }));
  const pillarId = (name: string) => (pillars.find((p) => p.name === name) ?? pillars[0]).id;

  const idByKey = new Map<string, UUID>();
  const nodes: SkillNode[] = [];
  for (const n of parsed.nodes) {
    if (!n.key || idByKey.has(n.key) || !n.concept_name) continue; // keys must be unique
    const id = randomUUID();
    idByKey.set(n.key, id);
    nodes.push({
      id,
      tree_id: tree.id,
      pillar_id: pillarId(n.pillar),
      concept_name: n.concept_name,
      mastery_criteria: n.mastery_criteria ?? '',
      required_blooms_level: clampLevel(Number(n.required_blooms_level) || 4),
      size: n.size === 'major' ? 'major' : 'minor',
      icon: (ICON_KEYWORDS as readonly string[]).includes(n.icon) ? n.icon : 'circle',
      keywords: (n.keywords ?? []).map((k) => String(k).toLowerCase()).filter(Boolean),
      position: null,
    });
  }
  if (nodes.length === 0) throw new HttpError(502, 'llm_error', 'parser returned no usable concepts');

  const edges: Edge[] = [];
  for (const n of parsed.nodes) {
    const child = idByKey.get(n.key);
    if (!child) continue;
    for (const depKey of n.depends_on ?? []) {
      const parent = idByKey.get(depKey);
      if (!parent || parent === child) continue; // dangling or self dependency
      if (edges.some((e) => e.parent_node_id === parent && e.child_node_id === child)) continue;
      if (wouldCreateCycle(edges, parent, child)) continue; // drop cycle-causing edges
      edges.push({ tree_id: tree.id, parent_node_id: parent, child_node_id: child });
    }
  }
  return { tree, pillars, nodes, edges };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new HttpError(504, 'llm_timeout', `parsing took longer than ${Math.round(ms / 1000)}s`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
}

export async function parseTree(ctx: Ctx, input: ParseTreeRequest): Promise<ParseTreeResponse> {
  const { config, store, bus, intel, demoMatcher } = ctx;

  // DEMO_MODE cache: the demo syllabus re-activates the seed tree (which already has classmates).
  if (config.demo && demoMatcher(input)) {
    await sleep(config.parseDelayMs);
    resetSeedTree(store.db);
    store.save();
    bus.publish(SEED_IDS.tree, { type: 'tree_updated', data: { tree_id: SEED_IDS.tree } });
    return { tree_id: SEED_IDS.tree, cached: true };
  }

  let parsed: ParsedTree;
  try {
    parsed = await withTimeout(intel.parseSyllabus(input), config.parseTimeoutMs);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error('[parse] intelligence failed:', (e as Error)?.message ?? e);
    throw new HttpError(502, 'llm_error', `could not parse syllabus: ${(e as Error)?.message ?? 'unknown error'}`);
  }

  const db = store.db;
  const educator = db.users.find((u) => u.role === 'educator');
  const rows = buildRowsFromParsed(parsed, educator?.id ?? SEED_IDS.educator, {
    title: input.title,
    source_ref: input.kind === 'pdf' ? input.filename ?? 'uploaded.pdf' : 'pasted text',
  });
  db.trees.push(rows.tree);
  db.pillars.push(...rows.pillars);
  db.nodes.push(...rows.nodes);
  db.edges.push(...rows.edges);

  // The demo student moves to the new tree with L1 everywhere.
  const student = demoStudent(db);
  const previousTreeId = student?.active_tree_id ?? null;
  if (student) {
    student.active_tree_id = rows.tree.id;
    const fresh: StudentNodeState[] = rows.nodes.map((n) => ({
      student_id: student.id,
      node_id: n.id,
      current_blooms_level: 1,
      paused: false,
      updated_at: now(),
    }));
    db.states.push(...fresh);
  }
  store.save();
  bus.publish(rows.tree.id, { type: 'tree_updated', data: { tree_id: rows.tree.id } });
  if (previousTreeId) bus.publish(previousTreeId, { type: 'tree_updated', data: { tree_id: previousTreeId } });
  return { tree_id: rows.tree.id, cached: false };
}
