import { computeDepths, computeNodeStatuses, type BloomLevel, type NodeStatus, type StudentSummary, type TreeBundle } from '@friction/shared';
export const PILLAR_WIDTH = 280;
export const PILLAR_GAP = 40;
export function layoutTree(bundle: TreeBundle) {
  const pillars = [...bundle.pillars].sort((a, b) => a.order - b.order);
  const depths = computeDepths(bundle.nodes, bundle.edges);
  return bundle.nodes.map((node) => {
    const siblings = bundle.nodes.filter((n) => n.pillar_id === node.pillar_id && depths[n.id] === depths[node.id]);
    const pillarIndex = Math.max(0, pillars.findIndex((p) => p.id === node.pillar_id));
    return { ...node, position: node.position ?? {
      x: pillarIndex * (PILLAR_WIDTH + PILLAR_GAP) + PILLAR_WIDTH / 2 - 50 + (siblings.indexOf(node) - (siblings.length - 1) / 2) * 100,
      y: depths[node.id] * 150 + 80,
    } };
  });
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
