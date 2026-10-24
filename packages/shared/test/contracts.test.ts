import { describe, expect, it } from 'vitest';
import {
  ApiError, DEMO_PROMPTS, FRICTION_CLOSE, FRICTION_OPEN, SEED_IDS,
  buildSeed, computeDepths, computeNextLevel, computeNodeStatuses,
  createFrictionClient, fakeIntelligence, hasInjected, readInjectedLevel,
  stripInjected, wouldCreateCycle, wrapInjected,
  type BloomLevel, type Verdict,
} from '../src/index';

describe('progression contract', () => {
  it.each([
    [1, 'correct', 0.69, true, 2], [1, 'correct', 0.7, true, 4],
    [1, 'correct', 0.99, false, 2], [4, 'correct', 1, false, 4],
    [2, 'lazy', 1, false, 2], [3, 'lazy', 1, false, 2],
    [4, 'lazy', 1, true, 3], [1, 'incorrect', 1, true, 1],
    [2, 'partial', 1, true, 2], [3, 'not_an_answer', 1, true, 3],
  ] as [BloomLevel, Verdict, number, boolean, BloomLevel][])(
    'L%i %s confidence=%s demo=%s → L%i', (current, verdict, confidence, demoMode, expected) => {
      expect(computeNextLevel({ current, verdict, confidence, demoMode })).toBe(expected);
    },
  );
});

describe('seed graph and mastery', () => {
  it('starts useEffect active and its dependents locked, then unlocks on mastery', () => {
    const { nodes, edges, states } = buildSeed();
    const levels = Object.fromEntries(states.filter(s => s.student_id === SEED_IDS.demoStudent)
      .map(s => [s.node_id, s.current_blooms_level]));
    const before = computeNodeStatuses(nodes, edges, levels);
    expect(before[SEED_IDS.nodes.useEffect]).toBe('active');
    expect(before[SEED_IDS.nodes.dataFetching]).toBe('locked');
    const after = computeNodeStatuses(nodes, edges, { ...levels, [SEED_IDS.nodes.useEffect]: 4 });
    expect(after[SEED_IDS.nodes.useEffect]).toBe('mastered');
    expect(after[SEED_IDS.nodes.dataFetching]).toBe('active');
    // Prerequisite locks take precedence over a node's own level.
    expect(computeNodeStatuses(nodes, edges, { [SEED_IDS.nodes.useEffect]: 4 })[SEED_IDS.nodes.useEffect]).toBe('locked');
  });

  it('rejects back edges and self loops, allows forward edges, and computes longest depth', () => {
    const { nodes, edges } = buildSeed();
    expect(wouldCreateCycle(edges, SEED_IDS.nodes.performance, SEED_IDS.nodes.jsx)).toBe(true);
    expect(wouldCreateCycle(edges, SEED_IDS.nodes.jsx, SEED_IDS.nodes.jsx)).toBe(true);
    expect(wouldCreateCycle(edges, SEED_IDS.nodes.props, SEED_IDS.nodes.performance)).toBe(false);
    const depths = computeDepths(nodes, edges);
    expect(depths[SEED_IDS.nodes.jsx]).toBe(0);
    expect(depths[SEED_IDS.nodes.performance]).toBe(4);
  });

  it('returns independent stores with exactly one state per student and node', () => {
    const a = buildSeed();
    const b = buildSeed();
    a.nodes[0].keywords.push('mutated');
    a.states[0].current_blooms_level = 1;
    expect(b.nodes[0].keywords).not.toContain('mutated');
    expect(b.states[0].current_blooms_level).toBe(3);
    for (const student of b.users.filter(u => u.role === 'student')) {
      const states = b.states.filter(s => s.student_id === student.id);
      expect(states).toHaveLength(b.nodes.length);
      expect(new Set(states.map(s => s.node_id)).size).toBe(b.nodes.length);
    }
  });
});

describe('prompt and fake intelligence contract', () => {
  it.each([
    [DEMO_PROMPTS.question, 'not_an_answer'],
    ['How can I prevent a useEffect render loop?', 'not_an_answer'],
    ['btw how does the dependency array work?', 'not_an_answer'],
    ['Explain the dependency array.', 'not_an_answer'],
    ['The dependency array', 'correct'],
    ['Is it the dependency array?', 'correct'],
    ['Could it be the dependency array?', 'correct'],
    [DEMO_PROMPTS.correctAnswer, 'correct'],
  ])('fake grading does not confuse a new question with an answer: %s', async (message, verdict) => {
    const node = buildSeed().nodes.find(n => n.id === SEED_IDS.nodes.useEffect)!;
    const result = await fakeIntelligence.evaluateExchange({ node, level: 1, quiz_text: 'Explain the dependency array.',
      student_message: message, demoMode: true });
    expect(result.verdict).toBe(verdict);
    expect(result.new_level).toBe(verdict === 'correct' ? 4 : 1);
  });

  it('preserves raw prompt before the block and hides every block for display', () => {
    const raw = 'Explain useEffect.\nKeep this line.';
    const injected = wrapInjected(raw, 'Level: 2 (Scaffolder)');
    expect(injected.startsWith(raw + '\n\n' + FRICTION_OPEN)).toBe(true);
    expect(readInjectedLevel(injected)).toBe(2);
    expect(hasInjected(injected)).toBe(true);
    expect(stripInjected(injected)).toBe(raw);
    expect(stripInjected(injected + '\n' + FRICTION_OPEN + '\nLevel: 1\n' + FRICTION_CLOSE)).toBe(raw);
    expect(readInjectedLevel(raw)).toBeNull();
  });

  it('passes L4 through and routes the demo prompts consistently', async () => {
    const { nodes } = buildSeed();
    const node = nodes.find(n => n.id === SEED_IDS.nodes.useEffect)!;
    expect(fakeIntelligence.buildFrictionPrompt({ raw_prompt: DEMO_PROMPTS.question, level: 4, node, includeQuiz: false }))
      .toBe(DEMO_PROMPTS.question);
    expect((await fakeIntelligence.classifyTopic(DEMO_PROMPTS.question, nodes)).node_id).toBe(node.id);
    expect((await fakeIntelligence.classifyTopic(DEMO_PROMPTS.bypassQuestion, nodes)).node_id).toBe(SEED_IDS.nodes.context);
    expect((await fakeIntelligence.classifyTopic('Write a haiku about the ocean', nodes)).node_id).toBeNull();
    expect(await fakeIntelligence.evaluateExchange({ node, level: 1, quiz_text: null,
      student_message: DEMO_PROMPTS.correctAnswer, demoMode: true })).toMatchObject({ verdict: 'correct', new_level: 4 });
  });
});

describe('HTTP client contract', () => {
  it('preserves API status, error code and message', async () => {
    const api = createFrictionClient('http://example.invalid', async () => new Response(
      JSON.stringify({ error: { code: 'quota_exhausted', message: 'no bypasses left' } }), { status: 409 }));
    const request = api.bypass({ student_id: SEED_IDS.demoStudent, node_id: SEED_IDS.nodes.context });
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 409, code: 'quota_exhausted', message: 'no bypasses left' });
  });

  it('handles 204 without parsing JSON', async () => {
    const api = createFrictionClient('http://example.invalid/', async (url, init) => {
      expect(url).toBe('http://example.invalid/nodes/node-id');
      expect(init?.method).toBe('DELETE');
      return new Response(null, { status: 204 });
    });
    await expect(api.deleteNode('node-id')).resolves.toBeUndefined();
  });

  it('returns the raw chat response with metadata and forwards cancellation', async () => {
    const controller = new AbortController();
    const response = new Response('streamed reply', { headers: { 'X-Friction-Level': '1' } });
    const api = createFrictionClient('http://example.invalid/', async (url, init) => {
      expect(url).toBe('http://example.invalid/chat');
      expect(init?.signal).toBe(controller.signal);
      expect(JSON.parse(init!.body as string).messages[0].content).toBe(DEMO_PROMPTS.question);
      return response;
    });
    const result = await api.chat({ student_id: SEED_IDS.demoStudent, conversation_id: 'test',
      messages: [{ role: 'user', content: DEMO_PROMPTS.question }] }, controller.signal);
    expect(result).toBe(response);
    expect(result.headers.get('X-Friction-Level')).toBe('1');
    expect(await result.text()).toBe('streamed reply');
  });
});
