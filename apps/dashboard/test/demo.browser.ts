/** Run with the dashboard and mock API already running; this resets demo data. */
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import { createFrictionClient, DEMO_PROMPTS, SEED_IDS } from '@friction/shared';

const dashboardUrl = process.env.DASHBOARD_TEST_URL ?? 'http://127.0.0.1:5173';
const api = createFrictionClient(process.env.DASHBOARD_TEST_API ?? 'http://127.0.0.1:8788');
const artifacts = process.env.DASHBOARD_EVIDENCE_DIR ?? fileURLToPath(new URL('./artifacts/v4-demo/', import.meta.url));
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : { channel: 'chrome' });
const errors: string[] = [];
const useEffectSelector = `[data-concept="${SEED_IDS.nodes.useEffect}"]`;
let acceptanceTimeout = 15000;
async function waitFor(page: Page, check: () => Promise<boolean>, description: string) {
  for (let n = 0; n < acceptanceTimeout / 100; n++) {
    if (await check()) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out: ${description}`);
}
try {
  const health = await api.health();
  if (health.mode.intelligence === 'real') acceptanceTimeout = 120000;
  assert.ok(health.mode.server === 'mock' || process.env.DASHBOARD_TEST_EXCLUSIVE === '1', 'An exclusive API window must be scheduled before destructive real-API browser checks.');
  await mkdir(artifacts, { recursive: true });
  await api.demoReset({ full: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, reducedMotion: 'reduce' });
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(String(error))));
  const educator = await context.newPage();
  await educator.goto(`${dashboardUrl}/educator/${SEED_IDS.tree}`);
  await educator.waitForSelector('.live-indicator.is-live');
  await educator.waitForSelector('[data-concept]');
  assert.equal(await educator.locator('[data-concept]').count(), 8);
  assert.equal(await educator.locator('.react-flow__edge').count(), 8);
  await educator.getByRole('button', { name: 'Upload syllabus' }).click();
  const syllabus = await readFile(new URL('../../../fixtures/demo-syllabus.md', import.meta.url), 'utf8');
  await educator.getByRole('textbox', { name: 'Syllabus text' }).fill(syllabus);
  await educator.getByRole('button', { name: 'Generate tree', exact: true }).click();
  await educator.waitForSelector('.parsing-state');
  await educator.waitForSelector('.upload-dialog', { state: 'detached', timeout: 90000 });
  await educator.getByRole('combobox', { name: 'Viewing as' }).selectOption(SEED_IDS.demoStudent);
  await waitFor(educator, async () => (await educator.locator(useEffectSelector).getAttribute('data-status')) === 'active', 'initial educator state');
  const student = await context.newPage();
  await student.goto(`${dashboardUrl}/student/${SEED_IDS.demoStudent}`);
  await student.waitForSelector('.live-indicator.is-live');
  const sandbox = await context.newPage();
  await sandbox.goto(`${dashboardUrl}/sandbox`);
  await sandbox.waitForSelector('.live-indicator.is-live');
  const requests: { conversation_id: string; messages: unknown[] }[] = [];
  sandbox.on('request', (request) => { if (new URL(request.url()).pathname === '/chat') requests.push(request.postDataJSON()); });
  for (const page of [educator, student, sandbox]) await page.evaluate(() => { (window as unknown as { demoMarker: boolean }).demoMarker = true; });
  const send = async (question: string) => {
    await sandbox.getByRole('textbox', { name: 'Chat message' }).fill(question);
    await sandbox.getByRole('button', { name: 'Send message' }).click();
    await waitFor(sandbox, () => sandbox.getByRole('button', { name: 'Send message' }).isEnabled().then((value) => !value), 'stream started');
    await waitFor(sandbox, () => sandbox.getByRole('textbox', { name: 'Chat message' }).isEnabled(), 'reply completed');
    assert.equal(await sandbox.locator('.chat-bubble.assistant').last().getAttribute('data-reply-status'), 'complete');
  };
  await send(DEMO_PROMPTS.question);
  const firstReply = await sandbox.locator('.chat-bubble.assistant > div').last().innerText();
  assert.ok(firstReply.trim().length > 20);
  if (health.mode.intelligence === 'fake') assert.match(firstReply, /dependency array.*\?/s);
  assert.match(await sandbox.locator('.turn-context').innerText(), /L1 · Socratic/);
  assert.equal(await sandbox.locator('[data-quiz-attached]').getAttribute('data-quiz-attached'), 'true');
  await sandbox.screenshot({ path: resolve(artifacts, 'v5-CP1-sandbox-L1.png'), fullPage: true });
  await send(DEMO_PROMPTS.correctAnswer);
  for (const page of [educator, student, sandbox]) {
    await waitFor(page, async () => await page.locator(useEffectSelector).getAttribute('data-status') === 'mastered', 'live mastery');
    assert.equal(await page.evaluate(() => (window as unknown as { demoMarker: boolean }).demoMarker), true);
  }
  assert.match(await sandbox.locator('.turn-context').innerText(), /L4 · Normal/);
  await sandbox.screenshot({ path: resolve(artifacts, 'v5-CP2-sandbox-mastered.png'), fullPage: true });
  await sandbox.getByRole('button', { name: 'New chat' }).click();
  await send(DEMO_PROMPTS.question);
  assert.notEqual(requests[0].conversation_id, requests[2].conversation_id);
  assert.equal(requests[2].messages.length, 1);
  if (health.mode.intelligence === 'fake') assert.match(await sandbox.locator('.chat-bubble.assistant').innerText(), /useEffect\(\(\)/);
  else assert.ok((await sandbox.locator('.chat-bubble.assistant > div').innerText()).trim().length > 20);
  assert.match(await sandbox.locator('.turn-context').innerText(), /L4 · Normal/);
  await sandbox.getByRole('button', { name: 'New chat' }).click();
  await send(DEMO_PROMPTS.bypassQuestion);
  await sandbox.getByRole('button', { name: 'Use bypass (3 left)', exact: true }).click();
  await waitFor(sandbox, async () => (await sandbox.locator('.sandbox-bypass').innerText()).includes('2 left'), 'quota decrement');
  await educator.waitForSelector('.bypass-toast');
  await waitFor(sandbox, () => sandbox.getByRole('textbox', { name: 'Chat message' }).isEnabled(), 'bypass completed');
  const afterBypass = await api.getStudent(SEED_IDS.demoStudent);
  const promptScope = (await sandbox.locator('.sandbox-bypass').innerText()).includes('this prompt only');
  assert.equal(afterBypass.states.find((state) => state.node_id === SEED_IDS.nodes.context)?.paused, !promptScope);
  if (promptScope) {
    assert.match(await sandbox.locator('.turn-context').innerText(), /L4 · Normal/);
    assert.equal(await sandbox.locator('[data-quiz-attached]').getAttribute('data-quiz-attached'), 'false');
  }
  assert.match(await educator.locator('.bypass-toast').innerText(), /Alex Chen used a bypass.*Context API · 2 left/s);
  await educator.screenshot({ path: resolve(artifacts, 'v5-CP2-educator-bypass.png'), fullPage: true });
  await api.bypass({ student_id: SEED_IDS.demoStudent, node_id: SEED_IDS.nodes.jsx });
  await api.bypass({ student_id: SEED_IDS.demoStudent, node_id: SEED_IDS.nodes.props });
  await sandbox.getByRole('button', { name: 'New chat' }).click();
  await send('How do I use data fetching to avoid a race condition?');
  await sandbox.getByRole('button', { name: 'Use bypass (0 left)', exact: true }).click();
  await waitFor(sandbox, async () => (await sandbox.locator('.sandbox-bypass').innerText()).includes('No bypasses left'), '409 message');
  sandbox.once('dialog', (dialog) => dialog.accept());
  await sandbox.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await waitFor(sandbox, async () => await sandbox.locator(useEffectSelector).getAttribute('data-status') === 'active' && await sandbox.locator('.chat-bubble').count() === 0, 'reset');
  assert.equal((await api.getStudent(SEED_IDS.demoStudent)).user.bypass_quota, 3);
  await sandbox.setViewportSize({ width: 390, height: 844 });
  await sandbox.screenshot({ path: resolve(artifacts, 'v5-CP2-mobile.png'), fullPage: true });
  assert.equal(await sandbox.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'mobile horizontal overflow');
  assert.deepEqual(errors, [], 'browser runtime errors');
  console.log(`PASS (${health.mode.server}/${health.mode.intelligence}): upload, reply transport/metadata, live L4, new chat, bypass + toast, quota exhaustion, reset, mobile. Real-model semantic acceptance and human rehearsal remain separate.`);
} finally { await browser.close(); }
