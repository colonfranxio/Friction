import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTRACT_VERSION,
  DEFAULT_BYPASS_QUOTA,
  DEMO_PROMPTS,
  FRICTION_OPEN,
  SEED_IDS,
  buildSeed,
  fakeEvaluate,
  fakeIntelligence,
  type EvaluateInput,
  type InterceptResponse,
  type Intelligence,
  type ParsedTree,
  type TreeBundle,
} from '@friction/shared';
import { createJsonStore } from '../src/store/json-store';
import { makeApp, sleep } from './helpers';

const S = SEED_IDS.demoStudent;
const N = SEED_IDS.nodes;
const intercept = (t: ReturnType<typeof makeApp>, raw: string, conv: string | null = 'c1') =>
  t.call<InterceptResponse>('POST', '/intercept', { student_id: S, raw_prompt: raw, app_source: 'claude_web', conversation_id: conv });
const level = (t: ReturnType<typeof makeApp>, node: string) =>
  t.store.db.states.find((s) => s.student_id === S && s.node_id === node)!.current_blooms_level;

describe('health', () => {
  it('reports contract version and mode', async () => {
    const t = makeApp();
    const r = await t.call('GET', '/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, contract_version: CONTRACT_VERSION, mode: { intelligence: 'fake', demo: true, server: 'api' } });
  });
});

describe('intercept', () => {
  it('happy path: L1 friction block + quiz, logged, activity event emitted', async () => {
    const t = makeApp();
    const r = await intercept(t, DEMO_PROMPTS.question);
    expect(r.status).toBe(200);
    expect(r.body.node_id).toBe(N.useEffect);
    expect(r.body.level).toBe(1);
    expect(r.body.quiz_attached).toBe(true);
    expect(r.body.graded).toBeNull();
    expect(r.body.injected_prompt.startsWith(DEMO_PROMPTS.question)).toBe(true);
    expect(r.body.injected_prompt).toContain(FRICTION_OPEN);
    expect(t.store.db.logs).toHaveLength(1);
    expect(t.store.db.logs[0].quiz_pending).toBe(true);
    expect(t.events.map((e) => e.type)).toEqual(['activity']);
  });

  it('pending-quiz precedence: the answer stays on the quiz node and is graded', async () => {
    const t = makeApp();
    await intercept(t, DEMO_PROMPTS.question);
    // Mentions "context" (a different node's keyword) but must still grade against useEffect.
    const r = await intercept(t, 'The dependency array lists what the effect depends on, not context or props.');
    expect(r.body.node_id).toBe(N.useEffect);
    expect(r.body.graded?.verdict).toBe('correct');
    expect(r.body.level).toBe(4); // DEMO_MODE jump
    expect(level(t, N.useEffect)).toBe(4);
    // intercept log, then (answer turn) graded → level change → graded activity, then this turn's own intercept log
    expect(t.events.map((e) => e.type)).toEqual(['activity', 'student_state', 'activity', 'activity']);
    expect(t.events.filter((e) => e.type === 'activity' && e.data.kind === 'graded')).toHaveLength(1);
  });

  it('conversation stickiness: a vague follow-up stays on the conversation\'s node', async () => {
    const t = makeApp();
    await intercept(t, DEMO_PROMPTS.question);
    await intercept(t, DEMO_PROMPTS.correctAnswer); // quiz resolved, node now L4
    const r = await intercept(t, 'explain it more please');
    expect(r.body.node_id).toBe(N.useEffect);
    expect(r.body.level).toBe(4);
    expect(r.body.injected_prompt).toBe('explain it more please');
    // A different conversation has no stickiness: no keyword match → passthrough.
    const other = await intercept(t, 'explain it more please', 'c2');
    expect(other.body.node_id).toBeNull();
  });

  it('passthrough: off-topic prompt, nothing logged, nothing emitted', async () => {
    const t = makeApp();
    const r = await intercept(t, 'Write me a haiku about the ocean');
    expect(r.body).toEqual({
      intercept_id: null, node_id: null, level: null, injected_prompt: 'Write me a haiku about the ocean', quiz_attached: false, graded: null,
    });
    expect(t.store.db.logs).toHaveLength(0);
    expect(t.events).toHaveLength(0);
  });

  it('new chat after mastery → L4 with the prompt unchanged', async () => {
    const t = makeApp();
    await intercept(t, DEMO_PROMPTS.question);
    await intercept(t, DEMO_PROMPTS.correctAnswer);
    const r = await intercept(t, DEMO_PROMPTS.question, 'c-new');
    expect(r.body.level).toBe(4);
    expect(r.body.injected_prompt).toBe(DEMO_PROMPTS.question);
  });

  it('lazy answer at L1 keeps the level and the quiz resolved', async () => {
    const t = makeApp();
    await intercept(t, DEMO_PROMPTS.question);
    const r = await intercept(t, DEMO_PROMPTS.lazyAnswer);
    expect(r.body.graded?.verdict).toBe('lazy');
    expect(level(t, N.useEffect)).toBe(1);
  });

  it('uses previous_assistant_text as the quiz when the log has no llm_response', async () => {
    const seen: EvaluateInput[] = [];
    const intel: Intelligence = { ...fakeIntelligence, evaluateExchange: async (i) => (seen.push(i), fakeEvaluate(i)) };
    const t = makeApp({ intel });
    await intercept(t, DEMO_PROMPTS.question);
    await t.call('POST', '/intercept', {
      student_id: S, raw_prompt: DEMO_PROMPTS.correctAnswer, app_source: 'claude_web', conversation_id: 'c1',
      previous_assistant_text: 'Quick check: what does the dependency array do?',
    });
    expect(seen[0].quiz_text).toBe('Quick check: what does the dependency array do?');
  });

  it('survives a classify failure (treated as no match)', async () => {
    const t = makeApp({ intel: { ...fakeIntelligence, classifyTopic: async () => { throw new Error('boom'); } } });
    const r = await intercept(t, DEMO_PROMPTS.question);
    expect(r.status).toBe(200);
    expect(r.body.node_id).toBeNull();
  });

  it('grade failure keeps the quiz pending and the level unchanged', async () => {
    const t = makeApp({ intel: { ...fakeIntelligence, evaluateExchange: async () => { throw new Error('boom'); } } });
    await intercept(t, DEMO_PROMPTS.question);
    const r = await intercept(t, DEMO_PROMPTS.correctAnswer);
    expect(r.status).toBe(200);
    expect(r.body.graded).toBeNull();
    expect(level(t, N.useEffect)).toBe(1);
    expect(t.store.db.logs[0].quiz_pending).toBe(true);
  });
});

describe('late grade and per-student mutex (rule 4.6)', () => {
  it('a grade that misses the budget still applies when it lands, and is pushed over SSE', async () => {
    const intel: Intelligence = {
      ...fakeIntelligence,
      evaluateExchange: async (i) => (await sleep(200), fakeEvaluate(i)),
    };
    const t = makeApp({ intel, config: { interceptBudgetMs: 40 } });
    await intercept(t, DEMO_PROMPTS.question);
    const r = await intercept(t, DEMO_PROMPTS.correctAnswer);
    expect(r.body.graded).toBeNull(); // missed the budget
    expect(r.body.level).toBe(1); // this turn still uses the current level
    expect(r.body.injected_prompt).not.toContain('Feedback:');
    expect(level(t, N.useEffect)).toBe(1);
    await sleep(350);
    expect(level(t, N.useEffect)).toBe(4);
    expect(t.events.map((e) => e.type)).toContain('student_state');
    const graded = t.events.filter((e) => e.type === 'activity' && e.data.kind === 'graded');
    expect(graded).toHaveLength(1);
    expect(t.store.db.logs[0].quiz_pending).toBe(false);
  });

  it('two concurrent intercepts never double-grade', async () => {
    let evaluations = 0;
    const intel: Intelligence = {
      ...fakeIntelligence,
      evaluateExchange: async (i) => (evaluations++, await sleep(30), fakeEvaluate(i)),
    };
    const t = makeApp({ intel });
    await intercept(t, DEMO_PROMPTS.question);
    const [a, b] = await Promise.all([intercept(t, DEMO_PROMPTS.correctAnswer), intercept(t, DEMO_PROMPTS.correctAnswer)]);
    expect(evaluations).toBe(1);
    expect([a.body.graded, b.body.graded].filter(Boolean)).toHaveLength(1);
  });
});

describe('reset while a grade is in flight', () => {
  const slowGrade: Intelligence = { ...fakeIntelligence, evaluateExchange: async (i) => (await sleep(150), fakeEvaluate(i)) };

  it.each([
    ['in-budget grade, per-student reset', 4000, { student_id: S }],
    ['in-budget grade, full reset', 4000, { full: true }],
    ['late grade, per-student reset', 40, { student_id: S }],
    ['late grade, full reset', 40, { full: true }],
  ])('%s: no stale events, level stays at the reset value', async (_name, budget, resetBody) => {
    const t = makeApp({ intel: slowGrade, config: { interceptBudgetMs: budget } });
    await intercept(t, DEMO_PROMPTS.question);
    const inflight = intercept(t, DEMO_PROMPTS.correctAnswer);
    await sleep(30);
    await t.call('POST', '/demo/reset', resetBody);
    t.events.length = 0;
    await inflight;
    await sleep(250);
    expect(t.events.filter((e) => e.type === 'student_state')).toHaveLength(0);
    expect(t.events.filter((e) => e.type === 'activity')).toHaveLength(0);
    expect(level(t, N.useEffect)).toBe(1);
  });
});

describe('SSE bus', () => {
  it('a reconnect does not lose its subscription when the old one unsubscribes late', () => {
    const t = makeApp();
    const baseline = t.ctx.bus.size; // the helper's own event collector
    const got: string[] = [];
    const first = t.ctx.bus.subscribe('tree-x', () => got.push('old'));
    first(); // old connection aborts...
    const second = t.ctx.bus.subscribe('tree-x', () => got.push('new')); // ...client reconnects
    first(); // ...and the old handler's cleanup runs again later
    t.ctx.bus.publish('tree-x', { type: 'tree_updated', data: { tree_id: 'tree-x' } });
    expect(got).toEqual(['new']);
    second();
    expect(t.ctx.bus.size).toBe(baseline);
  });

  it('GET /events streams named events and a connected comment', async () => {
    const t = makeApp();
    const baseline = t.ctx.bus.size;
    const res = await t.app.request(`/events?tree_id=${SEED_IDS.tree}`);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let text = dec.decode((await reader.read()).value);
    expect(text).toContain(': connected');
    t.ctx.bus.publish(SEED_IDS.tree, { type: 'tree_updated', data: { tree_id: SEED_IDS.tree } });
    text = dec.decode((await reader.read()).value);
    expect(text).toContain('event: tree_updated');
    expect(text).toContain(`"tree_id":"${SEED_IDS.tree}"`);
    expect(t.ctx.bus.size).toBe(baseline + 1);
    await reader.cancel();
    await sleep(20);
    expect(t.ctx.bus.size).toBe(baseline);
  });
});

describe('bypass', () => {
  it('closes a pending quiz on that node', async () => {
    const t = makeApp();
    await intercept(t, DEMO_PROMPTS.question);
    expect(t.store.db.logs[0].quiz_pending).toBe(true);
    await t.call('POST', '/bypass', { student_id: S, node_id: N.useEffect });
    expect(t.store.db.logs[0].quiz_pending).toBe(false);
  });

  it('decrements quota, pauses the node, emits events, and intercepts return L4', async () => {
    const t = makeApp();
    const r = await t.call('POST', '/bypass', { student_id: S, node_id: N.context });
    expect(r.body).toEqual({ remaining_quota: 2 });
    expect(t.events.map((e) => e.type)).toEqual(['student_state', 'bypass']);
    const i = await intercept(t, DEMO_PROMPTS.bypassQuestion, 'c3');
    expect(i.body.node_id).toBe(N.context);
    expect(i.body.level).toBe(4);
  });

  it('409 quota_exhausted after the quota is used up', async () => {
    const t = makeApp();
    for (let i = 0; i < 3; i++) expect((await t.call('POST', '/bypass', { student_id: S, node_id: N.context })).status).toBe(200);
    const r = await t.call('POST', '/bypass', { student_id: S, node_id: N.context });
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ error: { code: 'quota_exhausted', message: expect.any(String) } });
  });

  it('current concept-level behavior: the node stays paused for every later prompt, and a repeat bypass is not rejected', async () => {
    // Characterizes today's semantics so the planned explicit one-prompt bypass can't regress them silently.
    const t = makeApp();
    await t.call('POST', '/bypass', { student_id: S, node_id: N.context });
    for (const id of ['c4', 'c5']) expect((await intercept(t, DEMO_PROMPTS.bypassQuestion, id)).body.level).toBe(4);
    const again = await t.call('POST', '/bypass', { student_id: S, node_id: N.context });
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ remaining_quota: 1 });
  });

  it('shows up in the educator activity feed', async () => {
    const t = makeApp();
    await t.call('POST', '/bypass', { student_id: S, node_id: N.context });
    const r = await t.call('GET', `/trees/${SEED_IDS.tree}/activity`);
    expect(r.body.items[0]).toMatchObject({ kind: 'bypass', student_name: 'Alex Chen', concept_name: 'Context API' });
  });
});

describe('prompt-scoped bypass (contract v4)', () => {
  const Q = DEMO_PROMPTS.question;
  const CONV = 'sb-pb';
  const bypass = (t: ReturnType<typeof makeApp>, extra: Record<string, unknown> = {}, node: string = N.useEffect) =>
    t.call('POST', '/bypass', { student_id: S, node_id: node, ...extra });
  const issue = (t: ReturnType<typeof makeApp>, text = Q, conv = CONV) => bypass(t, { scope: 'prompt', raw_prompt: text, conversation_id: conv });
  const chatWith = (t: ReturnType<typeof makeApp>, token: unknown, over: Record<string, unknown> = {}) =>
    t.app.request('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        student_id: S,
        conversation_id: CONV,
        prompt_bypass_token: token,
        messages: [{ role: 'user', content: Q }],
        ...over,
      }),
    });
  /** An app whose model/grader calls are counted, so "400 before any model call" is checkable. */
  const counted = (clock?: () => number) => {
    const calls = { chat: 0, grade: 0 };
    const intel: Intelligence = {
      ...fakeIntelligence,
      chat: (m, o) => { calls.chat++; return fakeIntelligence.chat(m, o); },
      evaluateExchange: (i) => { calls.grade++; return fakeIntelligence.evaluateExchange(i); },
    };
    return { calls, t: makeApp({ intel, clock }) };
  };
  const quota = (t: ReturnType<typeof makeApp>) => t.store.db.users.find((u) => u.id === S)!.bypass_quota;
  const paused = (t: ReturnType<typeof makeApp>, node: string = N.useEffect) =>
    t.store.db.states.find((s) => s.student_id === S && s.node_id === node)!.paused;

  it('legacy: omitted and explicit "concept" scope both pause the node and charge every time, with no token', async () => {
    const t = makeApp();
    const a = await bypass(t, {}, N.context);
    const b = await bypass(t, { scope: 'concept' }, N.context);
    expect(a.body).toEqual({ remaining_quota: 2 });
    expect(b.body).toEqual({ remaining_quota: 1 });
    expect(paused(t, N.context)).toBe(true);
  });

  it('prompt scope: one quota, no pause, mastery untouched, pending quiz closed, educator events as before', async () => {
    const t = makeApp();
    await intercept(t, Q);
    expect(t.store.db.logs[0].quiz_pending).toBe(true);
    const before = level(t, N.useEffect);
    t.events.length = 0;
    const r = await bypass(t, { scope: 'prompt' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ remaining_quota: 2 }); // no binding, so no token
    expect(paused(t)).toBe(false);
    expect(level(t, N.useEffect)).toBe(before);
    expect(t.store.db.logs[0].quiz_pending).toBe(false);
    expect(t.events.map((e) => e.type)).toEqual(['student_state', 'bypass']);
    const feed = await t.call('GET', `/trees/${SEED_IDS.tree}/activity`);
    // The intercept and the bypass can share a created_at tick, so don't assume the feed's order.
    const bypassItem = feed.body.items.find((i: { kind: string }) => i.kind === 'bypass');
    expect(bypassItem).toMatchObject({ kind: 'bypass', student_name: 'Alex Chen', concept_name: 'React useEffect' });
    expect(feed.body.items.filter((i: { kind: string }) => i.kind === 'bypass')).toHaveLength(1);
  });

  it('prompt scope does not undo an existing concept pause', async () => {
    const t = makeApp();
    await bypass(t, { scope: 'concept' });
    expect(paused(t)).toBe(true);
    await bypass(t, { scope: 'prompt' });
    expect(paused(t)).toBe(true);
    expect(quota(t)).toBe(1);
  });

  it('bad scope or a half/unscoped binding is a 400 before anything is charged or changed; empty quota is 409 with no token', async () => {
    const t = makeApp();
    const bad: Array<Record<string, unknown>> = [
      { scope: 'forever' },
      { raw_prompt: Q, conversation_id: CONV }, // binding without prompt scope
      { scope: 'concept', raw_prompt: Q, conversation_id: CONV },
      { scope: 'prompt', raw_prompt: Q },
      { scope: 'prompt', conversation_id: CONV },
      { scope: 'prompt', raw_prompt: '  ', conversation_id: CONV },
      { scope: 'prompt', raw_prompt: Q, conversation_id: 7 },
    ];
    for (const extra of bad) {
      const r = await bypass(t, extra);
      expect([JSON.stringify(extra), r.status, r.body.error.code]).toEqual([JSON.stringify(extra), 400, 'bad_request']);
    }
    expect(quota(t)).toBe(3);
    expect(paused(t)).toBe(false);
    expect(t.store.db.bypasses).toHaveLength(0);
    for (let i = 0; i < 3; i++) await bypass(t, { scope: 'prompt' });
    const empty = await issue(t);
    expect(empty.status).toBe(409);
    expect(empty.body.prompt_bypass_token).toBeUndefined();
  });

  it('a token buys exactly one L4, no-quiz, ungraded turn; mastery and pause stay; the next ordinary turn has friction again', async () => {
    const { t, calls } = counted();
    await intercept(t, Q); // opens a pending quiz at L1
    const iss = await issue(t);
    expect(iss.body.remaining_quota).toBe(2);
    expect(typeof iss.body.prompt_bypass_token).toBe('string');
    expect(Object.keys(iss.body).sort()).toEqual(['prompt_bypass_token', 'remaining_quota']);
    const gradesBefore = calls.grade;
    const res = await chatWith(t, iss.body.prompt_bypass_token);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-friction-level')).toBe('4');
    expect(res.headers.get('x-friction-node-id')).toBe(N.useEffect);
    expect(res.headers.get('x-friction-quiz-attached')).toBe('false');
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
    expect(calls.grade).toBe(gradesBefore); // never graded
    expect(level(t, N.useEffect)).toBe(1);
    expect(paused(t)).toBe(false);
    expect(quota(t)).toBe(2); // charged at issue only, not at use
    const log = t.store.db.logs.find((l) => l.id === res.headers.get('x-friction-intercept-id'))!;
    expect(log).toMatchObject({ level: 4, quiz_pending: false, app_source: 'sandbox', raw_prompt: Q, injected_prompt: Q, llm_response: text });
    // A normal turn afterwards is back to level-1 friction with a quiz.
    const next = await chatWith(t, undefined, { prompt_bypass_token: undefined });
    expect(next.headers.get('x-friction-level')).toBe('1');
    expect(next.headers.get('x-friction-quiz-attached')).toBe('true');
    await next.text();
  });

  it('a spent token cannot be replayed: 400 before any model call, nothing re-charged', async () => {
    const { t, calls } = counted();
    const tok = (await issue(t)).body.prompt_bypass_token;
    await (await chatWith(t, tok)).text();
    const chatCalls = calls.chat;
    const again = await chatWith(t, tok);
    expect(again.status).toBe(400);
    expect((await again.json()).error.code).toBe('bad_request');
    expect(calls.chat).toBe(chatCalls);
    expect(quota(t)).toBe(2);
  });

  it('two concurrent requests with one token: exactly one wins, the model runs once', async () => {
    const { t, calls } = counted();
    const tok = (await issue(t)).body.prompt_bypass_token;
    const rs = await Promise.all([chatWith(t, tok), chatWith(t, tok)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 400]);
    await Promise.all(rs.map((r) => r.text()));
    expect(calls.chat).toBe(1);
  });

  it('a mismatch (other text, other chat, other student, unknown token) is a 400 and does NOT consume the valid token', async () => {
    const { t, calls } = counted();
    const tok = (await issue(t)).body.prompt_bypass_token;
    const other = t.store.db.users.find((u) => u.role === 'student' && u.id !== S)!;
    const wrong: Array<[string, Response]> = [
      ['text', await chatWith(t, tok, { messages: [{ role: 'user', content: Q + ' (edited)' }] })],
      ['conversation', await chatWith(t, tok, { conversation_id: 'another-chat' })],
      ['student', await chatWith(t, tok, { student_id: other.id })],
      ['unknown token', await chatWith(t, 'not-a-token')],
      ['non-string token', await chatWith(t, 123)],
    ];
    for (const [name, r] of wrong) expect([name, r.status]).toEqual([name, 400]);
    expect(calls.chat).toBe(0);
    const ok = await chatWith(t, tok);
    expect(ok.status).toBe(200);
    await ok.text();
  });

  it('expires after 120 seconds (injected clock) with a 400 and no model call', async () => {
    let now = 1_000_000;
    const { t, calls } = counted(() => now);
    const tok = (await issue(t)).body.prompt_bypass_token;
    now += 119_000;
    expect(t.ctx.promptTokens.size).toBe(1);
    now += 2_000; // 121s
    const r = await chatWith(t, tok);
    expect(r.status).toBe(400);
    expect(calls.chat).toBe(0);
    expect(quota(t)).toBe(2); // the expired token is not refunded
  });

  it('still valid just inside the window', async () => {
    let now = 5_000;
    const { t } = counted(() => now);
    const tok = (await issue(t)).body.prompt_bypass_token;
    now += 119_000;
    const r = await chatWith(t, tok);
    expect(r.status).toBe(200);
    await r.text();
  });

  it('a spent token is not re-armed by a failed model (502) or a client cancel', async () => {
    const failing: Intelligence = { ...fakeIntelligence, chat: () => (async function* () { throw new Error('down'); })() };
    const t = makeApp({ intel: failing });
    const tok = (await issue(t)).body.prompt_bypass_token;
    expect((await chatWith(t, tok)).status).toBe(502);
    expect((await chatWith(t, tok)).status).toBe(400);
    expect(quota(t)).toBe(2);
    // The ungraded L4 log must not leave a quiz pending.
    expect(t.store.db.logs.every((l) => !l.quiz_pending)).toBe(true);
  });

  it('reset and reparse invalidate tokens (full reset, per-student reset, demo-cache parse)', async () => {
    for (const how of ['full', 'student', 'parse'] as const) {
      const { t, calls } = counted();
      const tok = (await issue(t)).body.prompt_bypass_token;
      if (how === 'full') await t.call('POST', '/demo/reset', { full: true });
      else if (how === 'student') await t.call('POST', '/demo/reset', { student_id: S });
      else await t.call('POST', '/trees/parse', { kind: 'text', text: 'x', title: 't' });
      expect(t.ctx.promptTokens.size).toBe(0);
      const r = await chatWith(t, tok);
      expect([how, r.status]).toEqual([how, 400]);
      expect(calls.chat).toBe(0);
    }
  });

  it('a token is not invalidated by another student\'s reset', async () => {
    const t = makeApp();
    const tok = (await issue(t)).body.prompt_bypass_token;
    const other = t.store.db.users.find((u) => u.role === 'student' && u.id !== S)!;
    await t.call('POST', '/demo/reset', { student_id: other.id });
    const r = await chatWith(t, tok);
    expect(r.status).toBe(200);
    await r.text();
  });

  it('privacy: educator events and the activity feed carry neither the token nor the raw text', async () => {
    const t = makeApp();
    const tok = (await issue(t)).body.prompt_bypass_token;
    await (await chatWith(t, tok)).text();
    const feed = await t.call('GET', `/trees/${SEED_IDS.tree}/activity`);
    const blob = JSON.stringify([t.events, feed.body]);
    expect(blob).not.toContain(tok);
    expect(blob).not.toContain(Q);
    expect(t.events.some((e) => e.type === 'activity')).toBe(true);
  });

  it('the token turn is still a normal /chat on the wire: partial text saved, failure rejects the body', async () => {
    const intel: Intelligence = { ...fakeIntelligence, chat: () => (async function* () { yield 'a '; throw new Error('cut'); })() };
    const t = makeApp({ intel });
    const tok = (await issue(t)).body.prompt_bypass_token;
    const res = await chatWith(t, tok);
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    await expect((async () => { for (;;) if ((await reader.read()).done) return; })()).rejects.toThrow('cut');
    expect(t.store.db.logs.at(-1)!.llm_response).toBe('a ');
  });
});

describe('tree editing', () => {
  it('edge that would create a cycle → 409 cycle', async () => {
    const t = makeApp();
    // seed has jsx → props; props → jsx would close a loop
    const r = await t.call('POST', '/edges', { parent_node_id: N.props, child_node_id: N.jsx });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('cycle');
    expect((await t.call('POST', '/edges', { parent_node_id: N.jsx, child_node_id: N.jsx })).status).toBe(409);
  });

  it('creating an edge is idempotent and emits tree_updated', async () => {
    const t = makeApp();
    const a = await t.call('POST', '/edges', { parent_node_id: N.jsx, child_node_id: N.dataFetching });
    const b = await t.call('POST', '/edges', { parent_node_id: N.jsx, child_node_id: N.dataFetching });
    expect(a.body).toEqual(b.body);
    expect(t.events.filter((e) => e.type === 'tree_updated')).toHaveLength(1);
    const d = await t.call('DELETE', `/edges/${N.jsx}/${N.dataFetching}`);
    expect(d.status).toBe(204);
  });

  it('node create gives every student on the tree an L1 state; delete cascades', async () => {
    const t = makeApp();
    const bundle = await t.call<TreeBundle>('GET', `/trees/${SEED_IDS.tree}`);
    const created = await t.call('POST', `/trees/${SEED_IDS.tree}/nodes`, {
      pillar_id: bundle.body.pillars[0].id, concept_name: 'Refs', mastery_criteria: 'x', required_blooms_level: 3, size: 'minor', icon: 'box',
    });
    expect(created.status).toBe(200);
    const students = t.store.db.users.filter((u) => u.role === 'student').length;
    expect(t.store.db.states.filter((s) => s.node_id === created.body.id)).toHaveLength(students);
    const patched = await t.call('PATCH', `/nodes/${created.body.id}`, { concept_name: 'useRef', id: 'ignored', tree_id: 'ignored' });
    expect(patched.body).toMatchObject({ concept_name: 'useRef', tree_id: SEED_IDS.tree, id: created.body.id });
    expect((await t.call('DELETE', `/nodes/${created.body.id}`)).status).toBe(204);
    expect(t.store.db.states.some((s) => s.node_id === created.body.id)).toBe(false);
  });

  it('renames a pillar', async () => {
    const t = makeApp();
    const r = await t.call('PATCH', `/pillars/${SEED_IDS.pillars.foundations}`, { name: 'Basics' });
    expect(r.body.name).toBe('Basics');
  });
});

describe('educator privacy', () => {
  it('activity never contains prompts or replies', async () => {
    const t = makeApp();
    await intercept(t, DEMO_PROMPTS.question);
    const r = await t.call('GET', `/trees/${SEED_IDS.tree}/activity`);
    const json = JSON.stringify(r.body);
    expect(json).not.toContain('infinite loop');
    expect(json).not.toContain('raw_prompt');
    expect(json).not.toContain('llm_response');
  });
});

describe('demo reset', () => {
  it('full reset restores quota, states and drops logs; emits tree_updated', async () => {
    const t = makeApp();
    await t.call('POST', '/bypass', { student_id: S, node_id: N.context });
    await intercept(t, DEMO_PROMPTS.question);
    t.events.length = 0;
    const r = await t.call('POST', '/demo/reset', { full: true });
    expect(r.body).toEqual({ ok: true });
    expect(t.store.db.logs).toHaveLength(0);
    expect(t.store.db.users.find((u) => u.id === S)!.bypass_quota).toBe(3);
    expect(t.events.some((e) => e.type === 'tree_updated')).toBe(true);
  });

  it('per-student reset only touches that student', async () => {
    const t = makeApp();
    await intercept(t, DEMO_PROMPTS.question);
    await intercept(t, DEMO_PROMPTS.correctAnswer);
    expect(level(t, N.useEffect)).toBe(4);
    await t.call('POST', '/demo/reset', { student_id: S });
    expect(level(t, N.useEffect)).toBe(1);
    expect(t.store.db.logs).toHaveLength(0);
  });

  it('404 demo_only when DEMO_MODE is off', async () => {
    const t = makeApp({ config: { demo: false } });
    const r = await t.call('POST', '/demo/reset', { full: true });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('demo_only');
  });
});

describe('parse', () => {
  it('demo cache hit returns the seed tree and resets it', async () => {
    const t = makeApp({ demoMatches: true });
    await intercept(t, DEMO_PROMPTS.question);
    await intercept(t, DEMO_PROMPTS.correctAnswer);
    const r = await t.call('POST', '/trees/parse', { kind: 'text', text: 'anything' });
    expect(r.body).toEqual({ tree_id: SEED_IDS.tree, cached: true });
    expect(level(t, N.useEffect)).toBe(1);
  });

  it('per-student reset after a live upload keeps the uploaded course usable and leaves other students alone', async () => {
    const parsed: ParsedTree = {
      title: 'Algebra',
      pillars: ['Basics'],
      nodes: [
        { key: 'a', pillar: 'Basics', concept_name: 'Variables', mastery_criteria: 'm', required_blooms_level: 2, size: 'major', icon: 'function', keywords: ['variable'], depends_on: [] },
        { key: 'b', pillar: 'Basics', concept_name: 'Equations', mastery_criteria: 'm', required_blooms_level: 2, size: 'minor', icon: 'function', keywords: ['equation'], depends_on: ['a'] },
      ],
    };
    const t = makeApp({ demoMatches: false, intel: { ...fakeIntelligence, parseSyllabus: async () => parsed } });
    const tree = (await t.call('POST', '/trees/parse', { kind: 'text', text: 'my own syllabus', title: 'Algebra' })).body.tree_id;
    const nodes = t.store.db.nodes.filter((n) => n.tree_id === tree);
    const variables = nodes.find((n) => n.concept_name === 'Variables')!;
    // Progress on the uploaded course, plus a pause and a spent bypass, then a per-student reset.
    t.store.db.states.find((s) => s.student_id === S && s.node_id === variables.id)!.current_blooms_level = 3;
    t.store.db.states.find((s) => s.student_id === S && s.node_id === nodes[1].id)!.paused = true;
    const other = t.store.db.users.find((u) => u.role === 'student' && u.id !== S)!;
    const otherBefore = JSON.stringify(t.store.db.states.filter((s) => s.student_id === other.id));
    t.store.db.users.find((u) => u.id === S)!.bypass_quota = 0;
    const reset = await t.call('POST', '/demo/reset', { student_id: S });
    expect(reset.status).toBe(200);
    // Still on the uploaded course, every concept back at L1 and unpaused, quota restored.
    const student = await t.call('GET', `/students/${S}`);
    expect(student.body.tree_id).toBe(tree);
    const active = student.body.states.filter((s: any) => nodes.some((n) => n.id === s.node_id));
    expect(active).toHaveLength(2);
    expect(active.every((s: any) => s.current_blooms_level === 1 && !s.paused)).toBe(true);
    expect(student.body.user.bypass_quota).toBe(DEFAULT_BYPASS_QUOTA);
    // Seed-course states for the student are still the seed (unchanged contract), with no duplicates.
    const mine = t.store.db.states.filter((s) => s.student_id === S);
    expect(new Set(mine.map((s) => s.node_id)).size).toBe(mine.length);
    expect(mine.filter((s) => !nodes.some((n) => n.id === s.node_id))).toEqual(buildSeed().states.filter((s) => s.student_id === S));
    // Another student's progress is untouched.
    expect(JSON.stringify(t.store.db.states.filter((s) => s.student_id === other.id))).toBe(otherBefore);
    // Intercept on the uploaded course works after the reset.
    const r = await intercept(t, 'what is a variable in algebra?');
    expect(r.status).toBe(200);
    expect(r.body.node_id).toBe(variables.id);
    expect(r.body.level).toBe(1);
  });

  it('per-student reset on the seed course still restores the seed states', async () => {
    const t = makeApp({ demoMatches: true });
    await intercept(t, DEMO_PROMPTS.question);
    await intercept(t, DEMO_PROMPTS.correctAnswer);
    expect(level(t, N.useEffect)).toBe(4);
    await t.call('POST', '/demo/reset', { student_id: S });
    expect(t.store.db.states.filter((s) => s.student_id === S)).toEqual(buildSeed().states.filter((s) => s.student_id === S));
  });

  it('live path builds a validated tree, drops cyclic/dangling edges, and moves the demo student', async () => {
    const parsed: ParsedTree = {
      title: 'Algebra',
      pillars: ['Basics', 'Advanced'],
      nodes: [
        { key: 'a', pillar: 'Basics', concept_name: 'Variables', mastery_criteria: 'm', required_blooms_level: 2, size: 'major', icon: 'not-an-icon', keywords: ['Variable'], depends_on: [] },
        { key: 'b', pillar: 'Advanced', concept_name: 'Equations', mastery_criteria: 'm', required_blooms_level: 3, size: 'minor', icon: 'function', keywords: ['equation'], depends_on: ['a', 'nope', 'b'] },
        { key: 'a', pillar: 'Basics', concept_name: 'Duplicate key', mastery_criteria: 'm', required_blooms_level: 1, size: 'minor', icon: 'code', keywords: [], depends_on: [] },
        { key: 'c', pillar: 'Brand New Pillar', concept_name: 'Systems', mastery_criteria: 'm', required_blooms_level: 4, size: 'minor', icon: 'grid', keywords: [], depends_on: ['b'] },
      ],
    };
    // make 'a' depend on 'c' to create a cycle a→b→c→a that must be dropped
    parsed.nodes[0].depends_on = ['c'];
    const t = makeApp({ demoMatches: false, intel: { ...fakeIntelligence, parseSyllabus: async () => parsed } });
    const r = await t.call('POST', '/trees/parse', { kind: 'text', text: 'my own syllabus', title: 'My Algebra' });
    expect(r.status).toBe(200);
    expect(r.body.cached).toBe(false);
    const bundle = await t.call<TreeBundle>('GET', `/trees/${r.body.tree_id}`);
    expect(bundle.body.tree.title).toBe('My Algebra');
    expect(bundle.body.nodes.map((n) => n.concept_name).sort()).toEqual(['Equations', 'Systems', 'Variables']);
    expect(bundle.body.pillars.map((p) => p.name)).toEqual(['Basics', 'Advanced', 'Brand New Pillar']);
    expect(bundle.body.nodes.find((n) => n.concept_name === 'Variables')!.icon).toBe('circle');
    expect(bundle.body.edges).toHaveLength(2); // a→b, b→c; c→a (cycle) dropped
    const student = await t.call('GET', `/students/${S}`);
    expect(student.body.tree_id).toBe(r.body.tree_id);
    expect(student.body.states).toHaveLength(3);
    expect(student.body.states.every((s: any) => s.current_blooms_level === 1)).toBe(true);
  });

  it('LLM failure → 502 llm_error, timeout → 504 llm_timeout', async () => {
    const failing = makeApp({ demoMatches: false, intel: { ...fakeIntelligence, parseSyllabus: async () => { throw new Error('nope'); } } });
    const a = await failing.call('POST', '/trees/parse', { kind: 'text', text: 'x' });
    expect([a.status, a.body.error.code]).toEqual([502, 'llm_error']);
    const slow = makeApp({
      demoMatches: false,
      config: { parseTimeoutMs: 30 },
      intel: { ...fakeIntelligence, parseSyllabus: () => new Promise(() => {}) },
    });
    const b = await slow.call('POST', '/trees/parse', { kind: 'text', text: 'x' });
    expect([b.status, b.body.error.code]).toEqual([504, 'llm_timeout']);
  });

  it('400 on a bad parse request', async () => {
    const t = makeApp();
    expect((await t.call('POST', '/trees/parse', { kind: 'zip' })).status).toBe(400);
    expect((await t.call('POST', '/trees/parse', { kind: 'text' })).status).toBe(400);
  });
});

describe('chat (sandbox)', () => {
  const chat = (t: ReturnType<typeof makeApp>, content: string, conversation_id = 'sb-1') =>
    t.app.request('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ student_id: S, conversation_id, messages: [{ role: 'user', content }] }),
    });

  it('streams text/plain with X-Friction-* headers and saves llm_response', async () => {
    const t = makeApp();
    const res = await chat(t, DEMO_PROMPTS.question);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(res.headers.get('x-friction-node-id')).toBe(N.useEffect);
    expect(res.headers.get('x-friction-level')).toBe('1');
    const id = res.headers.get('x-friction-intercept-id')!;
    const text = await res.text();
    expect(text).toContain('Quick check');
    await sleep(20);
    expect(t.store.db.logs.find((l) => l.id === id)!.llm_response).toBe(text);
  });

  it('the saved reply is the quiz text when grading the next sandbox turn', async () => {
    const seen: EvaluateInput[] = [];
    const t = makeApp({ intel: { ...fakeIntelligence, evaluateExchange: async (i) => (seen.push(i), fakeEvaluate(i)) } });
    const first = await (await chat(t, DEMO_PROMPTS.question)).text();
    await sleep(20);
    const res = await chat(t, DEMO_PROMPTS.correctAnswer);
    await res.text();
    expect(seen[0].quiz_text).toBe(first);
    expect(res.headers.get('x-friction-level')).toBe('4');
  });

  it('passes the injected prompt (not the raw one) to the model, off-topic gets empty headers', async () => {
    const received: string[] = [];
    const intel: Intelligence = {
      ...fakeIntelligence,
      chat: async function* (messages) {
        received.push(messages[messages.length - 1].content);
        yield 'ok';
      },
    };
    const t = makeApp({ intel });
    await (await chat(t, DEMO_PROMPTS.question)).text();
    expect(received[0]).toContain(FRICTION_OPEN);
    const off = await chat(t, 'Write me a haiku about the ocean', 'sb-other'); // new conversation: no stickiness
    expect(off.headers.get('x-friction-node-id')).toBe('');
    expect(off.headers.get('x-friction-intercept-id')).toBe('');
    await off.text();
    expect(received[1]).toBe('Write me a haiku about the ocean');
  });

  it('model failing before the first token → 502 llm_error', async () => {
    const t = makeApp({ intel: { ...fakeIntelligence, chat: () => (async function* () { throw new Error('down'); })() } });
    const res = await chat(t, DEMO_PROMPTS.question);
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe('llm_error');
  });

  it('a quiz whose reply never arrived does not stay pending (failed, cut-off or empty reply)', async () => {
    const cases: Array<[string, Intelligence['chat']]> = [
      ['fails before the first token', () => (async function* () { throw new Error('down'); })()],
      ['fails mid-stream', () => (async function* () { yield 'partial reply '; throw new Error('cut'); })()],
      ['empty stream', () => (async function* () { /* nothing */ })()],
    ];
    for (const [name, chatFn] of cases) {
      const t = makeApp({ intel: { ...fakeIntelligence, chat: chatFn } });
      const res = await chat(t, DEMO_PROMPTS.question);
      await res.text().catch(() => '');
      await sleep(20);
      expect([name, t.store.db.logs[0].quiz_pending]).toEqual([name, false]);
    }
  });

  it('contract v4: a mid-stream model failure rejects the body reader after the delivered chunk; partial kept, quiz closed', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const t = makeApp({
      intel: { ...fakeIntelligence, chat: () => (async function* () { yield 'partial reply '; await gate; throw new Error('cut'); })() },
    });
    const res = await chat(t, DEMO_PROMPTS.question);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const reader = res.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe('partial reply '); // delivered before the failure
    release();
    await expect(reader.read()).rejects.toThrow('cut'); // not a clean EOF
    expect(t.store.db.logs[0].llm_response).toBe('partial reply ');
    expect(t.store.db.logs[0].quiz_pending).toBe(false);
  });
  it('client cancels mid-reply while the model ends quietly on abort (like B): partial kept, quiz closed', async () => {
    let sawAbort = false;
    const intel: Intelligence = {
      ...fakeIntelligence,
      // Same contract as packages/intelligence chat(): when the signal aborts, return without throwing.
      chat: async function* (_messages, opts) {
        yield 'Partial reply';
        await new Promise<void>((resolve) => {
          if (opts?.signal?.aborted) return resolve();
          opts?.signal?.addEventListener('abort', () => resolve(), { once: true });
        });
        sawAbort = !!opts?.signal?.aborted;
      },
    };
    const t = makeApp({ intel });
    const res = await chat(t, DEMO_PROMPTS.question);
    expect(t.store.db.logs[0].quiz_pending).toBe(true); // quiz attached, reply still streaming
    const reader = res.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('Partial reply');
    await reader.cancel();
    for (let i = 0; i < 100 && t.store.db.logs[0].quiz_pending; i++) await sleep(10);
    expect(sawAbort).toBe(true);
    expect(t.store.db.logs[0].llm_response).toBe('Partial reply');
    expect(t.store.db.logs[0].quiz_pending).toBe(false);
  });

  it('X-Friction-Quiz-Attached (contract v3): exact boolean string per turn, exposed via CORS', async () => {
    const t = makeApp();
    const q1 = await chat(t, DEMO_PROMPTS.question);
    expect(q1.headers.get('x-friction-quiz-attached')).toBe('true');
    expect(q1.headers.get('access-control-expose-headers')).toContain('X-Friction-Quiz-Attached');
    await q1.text();
    await sleep(20);
    const answer = await chat(t, DEMO_PROMPTS.correctAnswer); // graded correct → L4, no new quiz
    expect(answer.headers.get('x-friction-level')).toBe('4');
    expect(answer.headers.get('x-friction-quiz-attached')).toBe('false');
    await answer.text();
    const off = await chat(t, 'Write me a haiku about the ocean', 'sb-other'); // no node
    expect(off.headers.get('x-friction-node-id')).toBe('');
    expect(off.headers.get('x-friction-quiz-attached')).toBe('false');
    await off.text();
  });

  it('400 when there is no user message', async () => {
    const t = makeApp();
    const r = await t.call('POST', '/chat', { student_id: S, conversation_id: 'x', messages: [{ role: 'assistant', content: 'hi' }] });
    expect(r.status).toBe(400);
  });
});

describe('error shape and validation', () => {
  it('unknown route → 404 not_found in the standard body', async () => {
    const t = makeApp();
    const r = await t.call('GET', '/nope');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: { code: 'not_found', message: expect.any(String) } });
  });

  it('invalid JSON and missing fields → 400 bad_request', async () => {
    const t = makeApp();
    for (const [path, body] of [
      ['/intercept', '{bad'],
      ['/intercept', {}],
      ['/bypass', {}],
      ['/edges', {}],
      ['/responses', {}],
      ['/heartbeat', {}],
    ] as const) {
      const r = await t.call('POST', path, body);
      expect([path, r.status, r.body.error.code]).toEqual([path, 400, 'bad_request']);
    }
    expect((await t.call('GET', '/events')).status).toBe(400);
  });

  it('bad ids → 404 not_found', async () => {
    const t = makeApp();
    const missing = '99999999-9999-4999-8999-999999999999';
    for (const [method, path, body] of [
      ['GET', `/trees/${missing}`, undefined],
      ['GET', `/students/${missing}`, undefined],
      ['PATCH', `/nodes/${missing}`, {}],
      ['DELETE', `/nodes/${missing}`, undefined],
      ['DELETE', `/edges/${missing}/${missing}`, undefined],
      ['PATCH', `/pillars/${missing}`, { name: 'x' }],
      ['POST', '/intercept', { student_id: missing, raw_prompt: 'hi' }],
      ['POST', '/responses', { intercept_id: missing, llm_response: 'x' }],
      ['POST', '/bypass', { student_id: missing, node_id: missing }],
      ['POST', '/heartbeat', { student_id: missing }],
      ['POST', '/edges', { parent_node_id: missing, child_node_id: N.jsx }],
    ] as const) {
      const r = await t.call(method, path, body);
      expect([method, path, r.status, r.body.error.code]).toEqual([method, path, 404, 'not_found']);
    }
  });

  it('an unexpected exception becomes 500 internal, not a crash', async () => {
    const t = makeApp({ intel: { ...fakeIntelligence, buildFrictionPrompt: () => { throw new Error('kaboom'); } } });
    const r = await intercept(t, DEMO_PROMPTS.question);
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: { code: 'internal', message: 'kaboom' } });
  });

  it('CORS: `*` in DEMO_MODE, extension/dashboard origins otherwise, CHAT headers exposed', async () => {
    const demo = makeApp();
    const pre = await demo.app.request('/intercept', { method: 'OPTIONS', headers: { origin: 'chrome-extension://abc', 'access-control-request-method': 'POST' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
    const strict = makeApp({ config: { demo: false } });
    const ext = await strict.app.request('/health', { headers: { origin: 'chrome-extension://abc' } });
    expect(ext.headers.get('access-control-allow-origin')).toBe('chrome-extension://abc');
    const dash = await strict.app.request('/health', { headers: { origin: 'http://localhost:5173' } });
    expect(dash.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const evil = await strict.app.request('/health', { headers: { origin: 'https://evil.example' } });
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
    expect(ext.headers.get('access-control-expose-headers') ?? '').toContain('X-Friction-Level');
  });
});

describe('heartbeat', () => {
  it('updates last_seen_at and emits student_seen', async () => {
    const t = makeApp();
    const r = await t.call('POST', '/heartbeat', { student_id: S, extension_version: '1', enabled: true });
    expect(r.status).toBe(204);
    expect(t.store.db.users.find((u) => u.id === S)!.last_seen_at).not.toBeNull();
    expect(t.events.map((e) => e.type)).toEqual(['student_seen']);
  });
});

describe('JSON store', () => {
  it('seeds on first run and survives a restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'friction-store-'));
    try {
      const path = join(dir, 'nested', 'db.json');
      const first = makeApp({ store: createJsonStore(path) });
      await first.call('POST', '/bypass', { student_id: S, node_id: N.context });
      await intercept(first, DEMO_PROMPTS.question);
      await first.store.flush();

      const second = makeApp({ store: createJsonStore(path) });
      expect(second.store.db.users.find((u) => u.id === S)!.bypass_quota).toBe(2);
      expect(second.store.db.logs).toHaveLength(1);
      expect(second.store.db.bypasses).toHaveLength(1);
      expect(second.store.db.nodes.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('recovers from a corrupt file by reseeding', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'friction-store-'));
    try {
      const path = join(dir, 'db.json');
      const { writeFileSync } = await import('node:fs');
      writeFileSync(path, '{ not json');
      const store = createJsonStore(path);
      expect(store.db.trees).toHaveLength(1);
      await store.flush();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
