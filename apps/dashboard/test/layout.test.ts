import { describe, expect, it } from 'vitest';
import { buildSeed, computeDepths, computeNodeStatuses, SEED_IDS, type StudentSummary, type TreeBundle } from '@friction/shared';
import { layoutTree, levelsFor, treePresentation } from '../src/tree/layout';

function fixture() {
  const seed = buildSeed();
  const bundle: TreeBundle = { tree: seed.trees[0], pillars: seed.pillars, nodes: seed.nodes, edges: seed.edges };
  const students: StudentSummary[] = seed.users.filter((u) => u.role === 'student').map((user) => ({ user, states: seed.states.filter((s) => s.student_id === user.id) }));
  return { bundle, students };
}
describe('skill tree presentation', () => {
  it('keeps saved positions and places prerequisites above dependants', () => {
    const { bundle } = fixture();
    bundle.nodes[0].position = { x: 17, y: 42 };
    const nodes = layoutTree(bundle);
    expect(nodes[0].position).toEqual({ x: 17, y: 42 });
    const depths = computeDepths(bundle.nodes, bundle.edges);
    for (const node of nodes.slice(1)) expect(node.position.y).toBe(depths[node.id] * 150 + 80);
    const siblings = nodes.filter((n) => n.pillar_id === SEED_IDS.pillars.effects && depths[n.id] === 3);
    expect(Math.abs(siblings[0].position.x - siblings[1].position.x)).toBe(100);
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
