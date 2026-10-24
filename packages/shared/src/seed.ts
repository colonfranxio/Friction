/**
 * Fixed demo data. This is ALSO the cached parse result of fixtures/demo-syllabus.(md|pdf):
 * in DEMO_MODE, parsing the demo syllabus re-activates this tree instead of calling Claude.
 */
import { DEFAULT_BYPASS_QUOTA } from './constants';
import type { BloomLevel, Edge, Pillar, SkillNode, StudentNodeState, Tree, User, UUID } from './types';

const SEED_TIME = '2026-10-24T09:00:00.000Z';

export const SEED_IDS = {
  educator: '11111111-1111-4111-8111-111111111111',
  demoStudent: '22222222-2222-4222-8222-222222222222',
  tree: '33333333-3333-4333-8333-333333333333',
  pillars: {
    foundations: '44444444-4444-4444-8444-000000000001',
    effects: '44444444-4444-4444-8444-000000000002',
    apps: '44444444-4444-4444-8444-000000000003',
  },
  nodes: {
    jsx: '55555555-5555-4555-8555-000000000001',
    props: '55555555-5555-4555-8555-000000000002',
    useState: '55555555-5555-4555-8555-000000000003',
    useEffect: '55555555-5555-4555-8555-000000000004',
    dataFetching: '55555555-5555-4555-8555-000000000005',
    customHooks: '55555555-5555-4555-8555-000000000006',
    context: '55555555-5555-4555-8555-000000000007',
    performance: '55555555-5555-4555-8555-000000000008',
  },
} as const;

/** Demo prompts used by smoke.ts and B's harness. */
export const DEMO_PROMPTS = {
  question: 'How do I stop my useEffect from running in an infinite loop?',
  correctAnswer:
    'The dependency array lists the values the effect depends on, so React only re-runs the effect when one of those values changes. An empty array means run once after mount.',
  lazyAnswer: 'just give me the code',
  bypassQuestion: 'How does React Context help me avoid prop drilling?',
} as const;

const N = SEED_IDS.nodes;
const P = SEED_IDS.pillars;

export interface SeedData {
  users: User[];
  trees: Tree[];
  pillars: Pillar[];
  nodes: SkillNode[];
  edges: Edge[];
  states: StudentNodeState[];
}

function node(
  id: UUID,
  pillar_id: UUID,
  concept_name: string,
  mastery_criteria: string,
  required: BloomLevel,
  size: 'major' | 'minor',
  icon: string,
  keywords: string[],
): SkillNode {
  return {
    id,
    tree_id: SEED_IDS.tree,
    pillar_id,
    concept_name,
    mastery_criteria,
    required_blooms_level: required,
    size,
    icon,
    keywords,
    position: null,
  };
}

const CLASSMATE_NAMES = [
  'Priya', 'Marcus', 'Sofia', 'Kenji', 'Amara', 'Diego', 'Lena', 'Omar',
  'Hannah', 'Wei', 'Tomas', 'Zara', 'Ethan', 'Nia', 'Rafael',
];

export function classmateId(i: number): UUID {
  return `66666666-6666-4666-8666-${String(i + 1).padStart(12, '0')}`;
}

/** Demo student's starting levels: foundations mastered, useEffect at L1 (active). */
const DEMO_STUDENT_LEVELS: Record<UUID, BloomLevel> = {
  [N.jsx]: 3,
  [N.props]: 3,
  [N.useState]: 4,
  [N.useEffect]: 1,
  [N.dataFetching]: 1,
  [N.customHooks]: 1,
  [N.context]: 2,
  [N.performance]: 1,
};

/** Fresh deep copy every call, so stores can mutate freely. */
export function buildSeed(): SeedData {
  const tree: Tree = {
    id: SEED_IDS.tree,
    educator_id: SEED_IDS.educator,
    title: 'React Fundamentals',
    source_ref: 'fixtures/demo-syllabus.md',
    created_at: SEED_TIME,
  };

  const pillars: Pillar[] = [
    { id: P.foundations, tree_id: tree.id, name: 'Foundations', order: 0 },
    { id: P.effects, tree_id: tree.id, name: 'Effects & Data', order: 1 },
    { id: P.apps, tree_id: tree.id, name: 'Building Apps', order: 2 },
  ];

  const nodes: SkillNode[] = [
    node(N.jsx, P.foundations, 'JSX & Components', 'Explain how JSX compiles to function calls and split a UI into reusable components', 3, 'major', 'code', ['jsx', 'component', 'components', 'render function']),
    node(N.props, P.foundations, 'Props', 'Pass data and callbacks down through props and explain one-way data flow', 3, 'minor', 'arrow-down', ['props', 'passing props', 'children prop', 'one-way data flow']),
    node(N.useState, P.foundations, 'State with useState', 'Use useState correctly, including functional updates and why state updates are async', 4, 'major', 'box', ['usestate', 'use state', 'setstate', 'state update', 'functional update']),
    node(N.useEffect, P.effects, 'React useEffect', 'Identify and prevent an infinite render loop caused by a missing or wrong dependency array', 4, 'major', 'refresh', ['useeffect', 'use effect', 'dependency array', 'infinite loop', 'render loop', 'side effect', 'cleanup function']),
    node(N.dataFetching, P.effects, 'Data Fetching', 'Fetch data in an effect with loading and error states and avoid race conditions', 3, 'minor', 'download', ['fetch', 'data fetching', 'api call', 'loading state', 'race condition']),
    node(N.customHooks, P.effects, 'Custom Hooks', 'Extract reusable stateful logic into a custom hook that follows the rules of hooks', 4, 'minor', 'hook', ['custom hook', 'rules of hooks', 'usesomething', 'reusable logic']),
    node(N.context, P.apps, 'Context API', 'Share state with createContext/useContext and explain when context beats prop drilling', 3, 'minor', 'share', ['context', 'usecontext', 'createcontext', 'provider', 'prop drilling']),
    node(N.performance, P.apps, 'Performance & Memoization', 'Use React.memo, useMemo and useCallback to stop unnecessary re-renders and justify each use', 4, 'major', 'zap', ['usememo', 'usecallback', 'react.memo', 'memoization', 'unnecessary re-render', 'performance']),
  ];

  const e = (parent: UUID, child: UUID): Edge => ({ tree_id: tree.id, parent_node_id: parent, child_node_id: child });
  const edges: Edge[] = [
    e(N.jsx, N.props),
    e(N.jsx, N.useState),
    e(N.useState, N.useEffect),
    e(N.useEffect, N.dataFetching),
    e(N.useEffect, N.customHooks),
    e(N.useState, N.context),
    e(N.customHooks, N.performance),
    e(N.context, N.performance),
  ];

  const users: User[] = [
    { id: SEED_IDS.educator, name: 'Prof. Rivera', role: 'educator', bypass_quota: 0, active_tree_id: tree.id, last_seen_at: null },
    { id: SEED_IDS.demoStudent, name: 'Alex Chen', role: 'student', bypass_quota: DEFAULT_BYPASS_QUOTA, active_tree_id: tree.id, last_seen_at: null },
    ...CLASSMATE_NAMES.map<User>((name, i) => ({
      id: classmateId(i),
      name,
      role: 'student',
      bypass_quota: DEFAULT_BYPASS_QUOTA - (i % 3 === 0 ? 1 : 0),
      active_tree_id: tree.id,
      last_seen_at: null,
    })),
  ];

  const states: StudentNodeState[] = [];
  for (const n of nodes) {
    states.push({
      student_id: SEED_IDS.demoStudent,
      node_id: n.id,
      current_blooms_level: DEMO_STUDENT_LEVELS[n.id] ?? 1,
      paused: false,
      updated_at: SEED_TIME,
    });
  }
  // Classmates: deterministic spread so the class heatmap looks realistic.
  CLASSMATE_NAMES.forEach((_, i) => {
    nodes.forEach((n, j) => {
      const progress = (i * 7 + 3) % 10; // 0..9 = how far along this student is
      const raw = progress - j + 2;
      states.push({
        student_id: classmateId(i),
        node_id: n.id,
        current_blooms_level: Math.max(1, Math.min(4, raw)) as BloomLevel,
        paused: false,
        updated_at: SEED_TIME,
      });
    });
  });

  return structuredClone({ users, trees: [tree], pillars, nodes, edges, states });
}
