/**
 * Smoke test (lead-owned): the PRD §4 demo, played at the API level (this script acts as the extension).
 * claude.ai itself is covered by the human test in Chrome at each checkpoint.
 *
 *   pnpm smoke                                   # against the real API on 8787
 *   API_URL=http://localhost:8788 pnpm smoke     # against the mock
 *
 * Exits non-zero on the first failed step.
 */
import { readFileSync } from 'node:fs';
import {
  ApiError,
  DEFAULT_API_URL,
  DEMO_PROMPTS,
  FRICTION_OPEN,
  SEED_IDS,
  createFrictionClient,
} from '@friction/shared';

const api = createFrictionClient(process.env.API_URL ?? DEFAULT_API_URL);
const student = SEED_IDS.demoStudent;
let step = 0;

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    process.exit(1);
  }
}
async function run(name: string, fn: () => Promise<void>) {
  step += 1;
  const t = Date.now();
  try {
    await fn();
    console.log(`✓ ${step}. ${name} (${Date.now() - t}ms)`);
  } catch (e) {
    console.error(`✗ ${step}. ${name}: ${e instanceof ApiError ? `${e.status} ${e.code} ${e.message}` : e}`);
    process.exit(1);
  }
}

let treeId = '';
let useEffectId = '';
let contextId = '';
let firstInterceptId = '';

await run('health', async () => {
  const h = await api.health();
  console.log(`   server=${h.mode.server} intelligence=${h.mode.intelligence} demo=${h.mode.demo}`);
  check(h.mode.demo, 'smoke needs DEMO_MODE=1');
});

await run('full demo reset', async () => {
  await api.demoReset({ full: true });
});

await run('parse demo syllabus → tree contains "React useEffect"', async () => {
  const text = readFileSync(new URL('../fixtures/demo-syllabus.md', import.meta.url), 'utf8');
  const { tree_id } = await api.parseTree({ kind: 'text', text });
  treeId = tree_id;
  const bundle = await api.getTree(treeId);
  const ue = bundle.nodes.find((n) => n.concept_name === 'React useEffect');
  const ctx = bundle.nodes.find((n) => n.concept_name === 'Context API');
  check(ue && ctx, 'expected "React useEffect" and "Context API" nodes');
  useEffectId = ue.id;
  contextId = ctx.id;
  const s = await api.getStudent(student);
  check(s.tree_id === treeId, 'demo student should be on the parsed tree');
  check(s.states.find((x) => x.node_id === useEffectId)?.current_blooms_level === 1, 'useEffect should start at L1');
});

await run('L1: question gets friction + quiz', async () => {
  const r = await api.intercept({
    student_id: student, raw_prompt: DEMO_PROMPTS.question, app_source: 'claude_web', conversation_id: 'smoke-conv-1',
  });
  check(r.node_id === useEffectId, `expected useEffect node, got ${r.node_id}`);
  check(r.level === 1, `expected L1, got ${r.level}`);
  check(r.quiz_attached, 'expected quiz attached');
  check(r.injected_prompt.startsWith(DEMO_PROMPTS.question), 'injected prompt must start with the raw prompt');
  check(r.injected_prompt.includes(FRICTION_OPEN), 'injected prompt must contain the friction block');
  check(r.intercept_id, 'expected intercept_id');
  firstInterceptId = r.intercept_id;
});

await run('reply with quiz is captured', async () => {
  await api.responses({
    intercept_id: firstInterceptId,
    llm_response: "Before I hand you code: what decides when an effect re-runs?\n\nQuick check: what does the dependency array tell React?",
  });
});

await run('correct answer → L4 (DEMO_MODE jump)', async () => {
  const r = await api.intercept({
    student_id: student, raw_prompt: DEMO_PROMPTS.correctAnswer, app_source: 'claude_web', conversation_id: 'smoke-conv-1',
  });
  check(r.node_id === useEffectId, 'answer turn must stay on the quiz node (pending-quiz precedence)');
  check(r.graded?.verdict === 'correct', `expected correct, got ${r.graded?.verdict}`);
  const s = await api.getStudent(student);
  check(s.states.find((x) => x.node_id === useEffectId)?.current_blooms_level === 4, 'useEffect should now be L4');
});

await run('same question in a new chat → no friction', async () => {
  const r = await api.intercept({
    student_id: student, raw_prompt: DEMO_PROMPTS.question, app_source: 'claude_web', conversation_id: 'smoke-conv-2',
  });
  check(r.level === 4, `expected L4, got ${r.level}`);
  check(r.injected_prompt === DEMO_PROMPTS.question, 'L4 must pass the prompt through unchanged');
});

await run('bypass: quota 3→2, node paused, intercept returns L4', async () => {
  const b = await api.bypass({ student_id: student, node_id: contextId });
  check(b.remaining_quota === 2, `expected 2 left, got ${b.remaining_quota}`);
  const r = await api.intercept({
    student_id: student, raw_prompt: DEMO_PROMPTS.bypassQuestion, app_source: 'claude_web', conversation_id: 'smoke-conv-3',
  });
  check(r.node_id === contextId && r.level === 4, `expected Context API at L4, got ${r.node_id} L${r.level}`);
});

await run('bypass quota exhausted → 409', async () => {
  await api.bypass({ student_id: student, node_id: contextId });
  await api.bypass({ student_id: student, node_id: contextId });
  try {
    await api.bypass({ student_id: student, node_id: contextId });
    check(false, 'expected 409');
  } catch (e) {
    check(e instanceof ApiError && e.status === 409 && e.code === 'quota_exhausted', `expected 409 quota_exhausted, got ${e}`);
  }
});

await run('off-topic prompt passes through', async () => {
  const r = await api.intercept({
    student_id: student, raw_prompt: 'Write me a haiku about the ocean', app_source: 'claude_web', conversation_id: 'smoke-conv-4',
  });
  check(r.node_id === null && r.injected_prompt === 'Write me a haiku about the ocean', 'expected passthrough');
});

await run('reset demo student', async () => {
  await api.demoReset({ student_id: student });
});

console.log('\nSMOKE PASSED');
