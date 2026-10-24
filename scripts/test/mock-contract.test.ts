import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { ApiError, createFrictionClient, DEMO_PROMPTS, SEED_IDS } from '@friction/shared';
import { observeEvents } from '../smoke-events';

let child: ChildProcess;
let api: ReturnType<typeof createFrictionClient>;
const student_id = SEED_IDS.demoStudent;
const node_id = SEED_IDS.nodes.useEffect;
const request = { student_id, raw_prompt: DEMO_PROMPTS.question, app_source: 'sandbox' as const, conversation_id: 'mock-scope' };

beforeAll(async () => {
  child = spawn(process.execPath, ['--import', 'tsx', 'scripts/mock-api.ts', '--port', '0'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DEMO_MODE: '1' },
  });
  const url = await new Promise<string>((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Private mock startup timed out')), 10_000);
    child.stdout!.on('data', data => {
      output += String(data);
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    child.stderr!.on('data', () => {});
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Private mock exited ${code}`)); });
  });
  api = createFrictionClient(url);
}, 15_000);

afterAll(async () => {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
});
beforeEach(async () => { await api.demoReset({ full: true }); });

it('prompt bypass spends one quota, clears quiz, emits notification and leaves future friction active', async () => {
  await api.intercept(request);
  const live = await observeEvents(api.eventsUrl(SEED_IDS.tree));
  try {
    expect(await api.bypass({ student_id, node_id, scope: 'prompt' })).toEqual({ remaining_quota: 2 });
    await live.waitFor(e => e.type === 'bypass' && e.data.node_id === node_id && e.data.remaining_quota === 2, 'prompt bypass toast');
    const state = (await api.getStudent(student_id)).states.find(s => s.node_id === node_id)!;
    expect(state.paused).toBe(false);
    expect(state.current_blooms_level).toBe(1);
    expect(await api.intercept(request)).toMatchObject({ level: 1, quiz_attached: true, graded: null });
  } finally { await live.close(); }
});

it('omitted scope retains concept pause and repeat-bypass quota behavior', async () => {
  expect(await api.bypass({ student_id, node_id })).toEqual({ remaining_quota: 2 });
  expect(await api.intercept(request)).toMatchObject({ level: 4, quiz_attached: false });
  expect(await api.bypass({ student_id, node_id })).toEqual({ remaining_quota: 1 });
});

it('explicit concept scope retains legacy behavior', async () => {
  await api.bypass({ student_id, node_id, scope: 'concept' });
  expect((await api.getStudent(student_id)).states.find(s => s.node_id === node_id)?.paused).toBe(true);
});

it('invalid scope rejects before quota or state mutation', async () => {
  await expect(api.bypass({ student_id, node_id, scope: 'unknown' as never })).rejects.toMatchObject({ status: 400, code: 'bad_request' });
  expect((await api.getStudent(student_id)).user.bypass_quota).toBe(3);
});

it('prompt bypass quota still exhausts at zero with no concept pause', async () => {
  for (let n = 0; n < 3; n++) await api.bypass({ student_id, node_id, scope: 'prompt' });
  await expect(api.bypass({ student_id, node_id, scope: 'prompt' })).rejects.toBeInstanceOf(ApiError);
  await expect(api.bypass({ student_id, node_id, scope: 'prompt' })).rejects.toMatchObject({ status: 409, code: 'quota_exhausted' });
  expect((await api.getStudent(student_id)).states.find(s => s.node_id === node_id)?.paused).toBe(false);
});

it('client cancellation closes the unseen quiz before the next prompt', async () => {
  const response = await api.chat({ student_id, conversation_id: request.conversation_id,
    messages: [{ role: 'user', content: request.raw_prompt }] });
  const reader = response.body!.getReader();
  expect((await reader.read()).done).toBe(false);
  await reader.cancel();
  await delay(80); // Allow the server's socket-close callback to finish before sending a new turn.
  expect(await api.intercept(request)).toMatchObject({ level: 1, quiz_attached: true, graded: null });
});

it('sandbox prompt token authorizes exactly one bound L4 resend without promoting future turns', async () => {
  const bypass = await api.bypass({ student_id, node_id, scope: 'prompt', raw_prompt: request.raw_prompt, conversation_id: request.conversation_id });
  expect(bypass.prompt_bypass_token).toBeTruthy();
  const input = { student_id, conversation_id: request.conversation_id, prompt_bypass_token: bypass.prompt_bypass_token,
    messages: [{ role: 'user' as const, content: request.raw_prompt }] };
  const response = await api.chat(input);
  expect(response.headers.get('X-Friction-Level')).toBe('4');
  expect(response.headers.get('X-Friction-Quiz-Attached')).toBe('false');
  expect(await response.text()).toContain('dependency array');
  expect((await api.chat(input)).status).toBe(400);
  expect((await api.getStudent(student_id)).user.bypass_quota).toBe(2);
  expect(await api.intercept(request)).toMatchObject({ level: 1, quiz_attached: true, graded: null });
});

it('sandbox token rejects changed prompt/conversation without consuming the valid binding', async () => {
  const bypass = await api.bypass({ student_id, node_id, scope: 'prompt', raw_prompt: request.raw_prompt, conversation_id: request.conversation_id });
  const input = { student_id, conversation_id: request.conversation_id, prompt_bypass_token: bypass.prompt_bypass_token,
    messages: [{ role: 'user' as const, content: request.raw_prompt }] };
  expect((await api.chat({ ...input, conversation_id: 'different' })).status).toBe(400);
  expect((await api.chat({ ...input, messages: [{ role: 'user', content: 'different prompt' }] })).status).toBe(400);
  const valid = await api.chat(input);
  expect(valid.status).toBe(200);
  await valid.text();
});

it('reset invalidates sandbox authorization and partial binding rejects before spending quota', async () => {
  await expect(api.bypass({ student_id, node_id, scope: 'prompt', raw_prompt: request.raw_prompt }))
    .rejects.toMatchObject({ status: 400 });
  expect((await api.getStudent(student_id)).user.bypass_quota).toBe(3);
  const bypass = await api.bypass({ student_id, node_id, scope: 'prompt', raw_prompt: request.raw_prompt, conversation_id: request.conversation_id });
  await api.demoReset({ student_id });
  expect((await api.chat({ student_id, conversation_id: request.conversation_id, prompt_bypass_token: bypass.prompt_bypass_token,
    messages: [{ role: 'user', content: request.raw_prompt }] })).status).toBe(400);
});
