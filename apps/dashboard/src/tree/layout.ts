import { computeDepths, computeNodeStatuses, type BloomLevel, type NodeStatus, type SkillNode, type StudentSummary, type TreeBundle } from '@friction/shared';
/** Concept cards sit in a fixed-width slot so majors and minors share one centre line. */
export const NODE_WIDTH = 132;
export const COLUMN_GAP = 48;
/** Matches .concept-card's fixed height plus its 6px shadow edge. */
export const CARD_HEIGHT = 178;
export const STEP_Y = 215;
/** Syllabus order: modules in order, then concepts as the syllabus lists them. */
export function syllabusOrder(bundle: TreeBundle): SkillNode[] {
  const pillars = [...bundle.pillars].sort((a, b) => a.order - b.order);
  const rank = (node: SkillNode) => { const index = pillars.findIndex((p) => p.id === node.pillar_id); return index < 0 ? pillars.length : index; };
  const listed = new Map(bundle.nodes.map((node, index) => [node.id, index]));
  return [...bundle.nodes].sort((a, b) => rank(a) - rank(b) || listed.get(a.id)! - listed.get(b.id)!);
}
/**
 * One standard tree for every course: each row is a prerequisite level, centred on one axis, cards evenly spaced.
 * Rows keep syllabus order, nudged so each card sits under its prerequisites. Saved positions are ignored.
 */
export function layoutTree(bundle: TreeBundle) {
  const depths = computeDepths(bundle.nodes, bundle.edges);
  const order = syllabusOrder(bundle);
  const rank = new Map(order.map((node, index) => [node.id, index]));
  const x = new Map<string, number>();
  const rows = [...new Set(order.map((node) => depths[node.id]))].sort((a, b) => a - b);
  const placed: (SkillNode & { position: { x: number; y: number }; depth: number })[] = [];
  for (const depth of rows) {
    const parentX = (node: SkillNode) => {
      const xs = bundle.edges.filter((e) => e.child_node_id === node.id && x.has(e.parent_node_id)).map((e) => x.get(e.parent_node_id)!);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    };
    const row = order.filter((node) => depths[node.id] === depth)
      .sort((a, b) => (depth ? parentX(a) - parentX(b) : 0) || rank.get(a.id)! - rank.get(b.id)!);
    const width = row.length * NODE_WIDTH + (row.length - 1) * COLUMN_GAP;
    row.forEach((node, index) => {
      const left = -width / 2 + index * (NODE_WIDTH + COLUMN_GAP);
      x.set(node.id, left + NODE_WIDTH / 2);
      placed.push({ ...node, depth, position: { x: left, y: depth * STEP_Y } });
    });
  }
  return placed;
}
export const levelsFor = (student?: StudentSummary): Record<string, BloomLevel> => Object.fromEntries((student?.states ?? []).map((s) => [s.node_id, s.current_blooms_level]));
export function treePresentation(bundle: TreeBundle, students: StudentSummary[], studentId?: string) {
  const depths = computeDepths(bundle.nodes, bundle.edges);
  const focused: Record<string, number> = {};
  const each = students.map((student) => {
    const levels = levelsFor(student);
    const statuses = computeNodeStatuses(bundle.nodes, bundle.edges, levels);
    const updated = (id: string) => student.states.find((s) => s.node_id === id)?.updated_at ?? '';
    const focus = bundle.nodes.filter((n) => statuses[n.id] === 'active')
      .sort((a, b) => depths[a.id] - depths[b.id] || updated(b.id).localeCompare(updated(a.id)))[0];
    if (focus) focused[focus.id] = (focused[focus.id] ?? 0) + 1;
    return { student, levels, statuses };
  });
  const selected = each.find((s) => s.student.user.id === studentId);
  if (selected) return { levels: selected.levels, statuses: selected.statuses, focused: {} as Record<string, number> };
  const statuses: Record<string, NodeStatus> = {};
  const levels: Record<string, BloomLevel> = {};
  for (const node of bundle.nodes) {
    const count = { mastered: 0, active: 0, locked: 0 };
    each.forEach((s) => count[s.statuses[node.id]]++);
    statuses[node.id] = each.length ? (Object.keys(count) as NodeStatus[]).sort((a, b) => count[b] - count[a])[0] : 'locked';
    const matching = each.filter((s) => s.statuses[node.id] === statuses[node.id]);
    const values = matching.map((s) => s.levels[node.id] ?? 1).sort((a, b) => a - b);
    levels[node.id] = values[Math.floor(values.length / 2)] ?? 1;
  }
  return { levels, statuses, focused };
}
