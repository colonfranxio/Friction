/**
 * Smoke test (lead-owned): the PRD §4 demo, played at the API level (this script acts as the extension).
 * claude.ai itself is covered by the human test in Chrome at each checkpoint.
 *
 *   pnpm smoke              # against the real API on 8787
 *   pnpm smoke:mock         # against the mock on 8788
 *   pnpm smoke --url <url>  # anything else (works in PowerShell/cmd too; API_URL env also honored)
 *
 * Exits non-zero on the first failed step.
 */
import { readFileSync } from 'node:fs';
import { observeEvents } from './smoke-events';
import {
  ApiError,
  CHAT_HEADERS,
  CONTRACT_VERSION,
  DEFAULT_API_URL,
  DEMO_PROMPTS,
  FRICTION_OPEN,
  SEED_IDS,
  createFrictionClient,
  type ChatMessage,
} from '@friction/shared';

const urlFlag = process.argv.indexOf('--url');
const api = createFrictionClient((urlFlag >= 0 ? process.argv[urlFlag + 1] : undefined) ?? process.env.API_URL ?? DEFAULT_API_URL);
const student = SEED_IDS.demoStudent;
let step = 0;
let isMockServer = false;

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
  isMockServer = h.mode.server === 'mock';
  console.log(`   server=${h.mode.server} intelligence=${h.mode.intelligence} demo=${h.mode.demo}`);
  check(h.mode.demo, 'smoke needs DEMO_MODE=1');
  check(h.ok && h.contract_version === CONTRACT_VERSION, 'health must report the current contract');
});

await run('full demo reset', async () => {
  await api.demoReset({ full: true });
});

const live = await observeEvents(api.eventsUrl(SEED_IDS.tree));

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
  await live.waitFor(e => e.type === 'tree_updated' && e.data.tree_id === treeId, 'parse tree_updated');
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
  await live.waitFor(e => e.type === 'student_state' && e.data.student_id === student &&
    e.data.node_id === useEffectId && e.data.current_blooms_level === 4, 'live mastery promotion');
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
  await live.waitFor(e => e.type === 'bypass' && e.data.student_id === student &&
    e.data.node_id === contextId && e.data.remaining_quota === 2, 'educator bypass toast');
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

// The sandbox is the main demo surface. Do not call /responses here. This
// checks progression through /chat; A's endpoint tests must separately verify
// saved llm_response, since the fake grader also accepts quiz_text=null.
let history: ChatMessage[] = [{ role: 'user', content: DEMO_PROMPTS.question }];
let conversation = 'smoke-sandbox-1';
let lastChatInterceptId = '';

async function chatTurn(expectedLevel: number, expectedQuizAttached: boolean) {
  const response = await api.chat({ student_id: student, conversation_id: conversation, messages: history },
    AbortSignal.timeout(90_000));
  check(response.ok, `chat HTTP ${response.status}`);
  check(response.headers.get('content-type')?.includes('text/plain'), 'chat must stream text/plain');
  check(response.headers.get(CHAT_HEADERS.nodeId) === useEffectId, 'chat must identify the useEffect node');
  check(response.headers.get(CHAT_HEADERS.level) === String(expectedLevel), `chat must report L${expectedLevel}`);
  check(response.headers.get(CHAT_HEADERS.interceptId), 'chat must identify its intercept');
  lastChatInterceptId = response.headers.get(CHAT_HEADERS.interceptId)!;
  const quizAttached = response.headers.get(CHAT_HEADERS.quizAttached);
  // v3's exact quiz header is implemented in the mock first. A/C own the
  // real endpoint/UI rollout; absence there remains compatible during CP2.
  if (isMockServer || quizAttached !== null) {
    check(quizAttached === String(expectedQuizAttached), 'chat must report exact quiz attachment for this turn');
  }
  const exposed = (response.headers.get('access-control-expose-headers') ?? '').toLowerCase().split(',').map(h => h.trim());
  for (const header of Object.values(CHAT_HEADERS)) {
    if (header === CHAT_HEADERS.quizAttached && quizAttached === null && !isMockServer) continue;
    check(exposed.includes(header.toLowerCase()), `${header} must be exposed to the dashboard`);
  }
  check(response.body, 'chat must have a response stream');
  let reply = '';
  const decoder = new TextDecoder();
  for await (const chunk of response.body) reply += decoder.decode(chunk, { stream: true });
  reply += decoder.decode();
  check(reply.trim(), 'chat stream must contain an assistant reply');
  check(!reply.includes(FRICTION_OPEN), 'chat must not expose the hidden prompt block');
  history.push({ role: 'assistant', content: reply });
}

await run('sandbox L1: reply stream + metadata + CORS', async () => {
  await chatTurn(1, true);
});

await run('sandbox answer without /responses → L4', async () => {
  history.push({ role: 'user', content: DEMO_PROMPTS.correctAnswer });
  await chatTurn(4, false);
  const s = await api.getStudent(student);
  check(s.states.find(x => x.node_id === useEffectId)?.current_blooms_level === 4, 'sandbox answer must promote useEffect');
});

await run('sandbox new chat: same question at L4', async () => {
  conversation = 'smoke-sandbox-2';
  history = [{ role: 'user', content: DEMO_PROMPTS.question }];
  await chatTurn(4, false);
});

await run('educator HTTP + SSE privacy', async () => {
  await live.waitFor(e => e.type === 'activity' && e.data.id === lastChatInterceptId, 'sandbox intercept activity');
  await live.close();
  const students = await api.treeStudents(treeId);
  const activity = await api.treeActivity(treeId);
  check(students.students.length > 0 && activity.items.length > 0, 'privacy check needs populated educator data');
  for (const data of [students, activity, live.events]) {
    check(!/"(?:raw_prompt|injected_prompt|llm_response)"\s*:/.test(JSON.stringify(data)), 'educator data must not expose chat text fields');
  }
});

if (isMockServer || process.argv.includes('--require-v4')) {
  await run('v4 prompt bypass preserves future friction', async () => {
    await api.demoReset({ student_id: student });
    const input = { student_id: student, raw_prompt: DEMO_PROMPTS.question,
      app_source: 'sandbox' as const, conversation_id: 'smoke-prompt-bypass' };
    check((await api.intercept(input)).quiz_attached, 'first turn needs a quiz');
    check((await api.bypass({ student_id: student, node_id: useEffectId, scope: 'prompt' })).remaining_quota === 2, 'prompt bypass costs one quota');
    const state = (await api.getStudent(student)).states.find(s => s.node_id === useEffectId);
    check(state && !state.paused && state.current_blooms_level === 1, 'prompt bypass must not pause or promote');
    const next = await api.intercept(input);
    check(next.level === 1 && next.quiz_attached && next.graded === null, 'future prompt still has friction and previous quiz was cleared');
  });
}

await run('restore demo after sandbox verification', async () => {
  await api.demoReset({ student_id: student });
});

console.log('\nSMOKE PASSED');
