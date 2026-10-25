import { describe, expect, it } from 'vitest';
import { buildSeed, computeDepths, computeNodeStatuses, SEED_IDS, type StudentSummary, type TreeBundle } from '@friction/shared';
import { layoutTree, levelsFor, syllabusOrder, treePresentation, COLUMN_GAP, NODE_WIDTH, STEP_Y } from '../src/tree/layout';

function fixture() {
  const seed = buildSeed();
  const bundle: TreeBundle = { tree: seed.trees[0], pillars: seed.pillars, nodes: seed.nodes, edges: seed.edges };
  const students: StudentSummary[] = seed.users.filter((u) => u.role === 'student').map((user) => ({ user, states: seed.states.filter((s) => s.student_id === user.id) }));
  return { bundle, students };
}
describe('skill tree presentation', () => {
  it('lays cards out as centred prerequisite rows in syllabus order, ignoring saved positions and modules', () => {
    const { bundle } = fixture();
    bundle.nodes[0].position = { x: 17, y: 42 };
    const placed = layoutTree(bundle);
    expect(placed).toHaveLength(bundle.nodes.length);
    expect(placed.find((n) => n.id === bundle.nodes[0].id)!.position).not.toEqual({ x: 17, y: 42 });
    const depths = computeDepths(bundle.nodes, bundle.edges);
    for (const node of placed) expect(node.position.y).toBe(depths[node.id] * STEP_Y);
    for (const edge of bundle.edges) expect(placed.find((n) => n.id === edge.parent_node_id)!.position.y).toBeLessThan(placed.find((n) => n.id === edge.child_node_id)!.position.y);
    for (const depth of new Set(placed.map((n) => n.depth))) {
      const row = placed.filter((n) => n.depth === depth).sort((a, b) => a.position.x - b.position.x);
      const centre = (row[0].position.x + row.at(-1)!.position.x + NODE_WIDTH) / 2;
      expect(centre).toBeCloseTo(0);
      for (let i = 1; i < row.length; i++) expect(row[i].position.x - row[i - 1].position.x).toBe(NODE_WIDTH + COLUMN_GAP);
    }
    expect(syllabusOrder(bundle).map((n) => n.id)).toHaveLength(bundle.nodes.length);
  });
  it('reflects a live promotion and unlocks prerequisites without treating bypasses as mastery', () => {
    const { bundle, students } = fixture();
    const alex = students.find((s) => s.user.id === SEED_IDS.demoStudent)!;
    expect(treePresentation(bundle, students, alex.user.id).statuses[SEED_IDS.nodes.useEffect]).toBe('active');
    const effect = alex.states.find((s) => s.node_id === SEED_IDS.nodes.useEffect)!;
    effect.paused = true;
    expect(treePresentation(bundle, students, alex.user.id).statuses[SEED_IDS.nodes.dataFetching]).toBe('locked');
    effect.current_blooms_level = 4;
    const updated = treePresentation(bundle, students, alex.user.id);
    expect(updated.statuses[SEED_IDS.nodes.useEffect]).toBe('mastered');
    expect(updated.statuses[SEED_IDS.nodes.dataFetching]).toBe('active');
    expect(updated.focused).toEqual({});
  });
  it('shows majority status and counts one focus per student', () => {
    const { bundle, students } = fixture();
    const presentation = treePresentation(bundle, students);
    expect(presentation.statuses[SEED_IDS.nodes.jsx]).toBe('mastered');
    const learningStudents = students.filter((s) => Object.values(computeNodeStatuses(bundle.nodes, bundle.edges, levelsFor(s))).includes('active'));
    expect(Object.values(presentation.focused).reduce((a, b) => a + b, 0)).toBe(learningStudents.length);
    expect(presentation.levels[SEED_IDS.nodes.jsx]).toBeGreaterThanOrEqual(3);
  });
});
