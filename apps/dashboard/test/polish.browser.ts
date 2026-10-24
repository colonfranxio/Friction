/** CP3: real SSE progress drives animations; initial loads and view changes do not. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createFrictionClient, DEMO_PROMPTS, SEED_IDS } from '@friction/shared';

const base = process.env.DASHBOARD_TEST_URL ?? 'http://127.0.0.1:5173';
const api = createFrictionClient(process.env.DASHBOARD_TEST_API ?? 'http://127.0.0.1:8788');
const artifacts = process.env.DASHBOARD_EVIDENCE_DIR ?? fileURLToPath(new URL('./artifacts/v4-polish/', import.meta.url));
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : { channel: 'chrome' });
const concept = (id: string) => `[data-concept="${id}"]`;
const promote = async () => {
  const conversation = crypto.randomUUID();
  const question = await api.intercept({ student_id: SEED_IDS.demoStudent, raw_prompt: DEMO_PROMPTS.question, app_source: 'sandbox', conversation_id: conversation });
  assert.ok(question.intercept_id);
  await api.responses({ intercept_id: question.intercept_id, llm_response: 'Quick check: what does the dependency array tell React?' });
  await api.intercept({ student_id: SEED_IDS.demoStudent, raw_prompt: DEMO_PROMPTS.correctAnswer, app_source: 'sandbox', conversation_id: conversation });
};
try {
  assert.ok((await api.health()).mode.server === 'mock' || process.env.DASHBOARD_TEST_EXCLUSIVE === '1', 'Schedule an exclusive API window before resetting its store.');
  await mkdir(artifacts, { recursive: true });
  await api.demoReset({ full: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const errors: string[] = [];
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(String(error))));
  const page = await context.newPage();
  await page.goto(`${base}/student/${SEED_IDS.demoStudent}`);
  await page.waitForSelector('.live-indicator.is-live');
  await page.waitForSelector(concept(SEED_IDS.nodes.useEffect));
  assert.ok(await page.locator('[data-edge-status="locked"]').count() > 0, 'locked edge status is available');
  assert.equal(await page.locator('[data-moment]').count(), 0, 'initial mastery should be quiet');
  assert.ok(await page.locator('.edge-energy').count() > 0);
  await page.locator(`${concept(SEED_IDS.nodes.useEffect)} .node-circle`).hover();
  await page.waitForFunction((selector) => {
    const element = document.querySelector(selector)!;
    return new DOMMatrix(getComputedStyle(element).transform).a > 1.02;
  }, `${concept(SEED_IDS.nodes.useEffect)} .node-circle`);
  await page.mouse.move(10, 10);
  await page.locator(`.react-flow__node[data-id="${SEED_IDS.nodes.useEffect}"]`).focus();
  await page.locator(`${concept(SEED_IDS.nodes.useEffect)} [role="tooltip"]`).waitFor({ state: 'visible' });
  await page.evaluate(() => {
    const audit = { mastery: false, unlock: false, draw: false, ticker: false };
    (window as unknown as { animationAudit: typeof audit }).animationAudit = audit;
    new MutationObserver(() => {
      audit.mastery ||= !!document.querySelector('[data-moment="mastery"] canvas');
      audit.unlock ||= !!document.querySelector('[data-moment="unlock"]');
      audit.draw ||= !!document.querySelector('.edge-unlock-draw');
      audit.ticker ||= !!document.querySelector('.badge-number[style*="rotateX"]');
    }).observe(document.body, { attributes: true, childList: true, subtree: true });
  });
  await page.mouse.click(10, 10);
  await promote();
  await page.waitForSelector(`${concept(SEED_IDS.nodes.useEffect)}[data-moment="mastery"]`);
  const bounds = await page.locator(`${concept(SEED_IDS.nodes.useEffect)} .mastery-particles`).evaluate((canvas) => {
    const circle = canvas.parentElement!;
    return { canvas: canvas.getBoundingClientRect().width, circle: circle.getBoundingClientRect().width, radius: getComputedStyle(canvas).borderRadius };
  });
  assert.ok(bounds.canvas <= bounds.circle);
  assert.equal(bounds.radius, '50%');
  await page.screenshot({ path: resolve(artifacts, 'v5-CP3-mastery.png'), fullPage: true });
  await page.waitForTimeout(1300);
  assert.equal(await page.locator('[data-moment]').count(), 0, 'celebration cleans up');
  const audit = await page.evaluate(() => (window as unknown as { animationAudit: { mastery: boolean; unlock: boolean; draw: boolean; ticker: boolean } }).animationAudit);
  assert.equal(audit.mastery, true, 'mastery canvas');
  assert.equal(audit.unlock, true, 'child unlock');
  assert.equal(audit.draw, true, 'new edge draws');
  assert.equal(audit.ticker, true, 'badge flips');
  await page.goto(`${base}/educator/${SEED_IDS.tree}`);
  await page.waitForSelector('.live-indicator.is-live');
  await page.getByRole('combobox', { name: 'Viewing as' }).selectOption(SEED_IDS.demoStudent);
  await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-moment]').count(), 0, 'switching student is not progress');
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await page.waitForSelector('.activity-item.graded');
  assert.equal(await page.locator('.activity-feed').getByText(DEMO_PROMPTS.question, { exact: false }).count(), 0, 'educator does not show raw chats');
  await page.screenshot({ path: resolve(artifacts, 'v5-CP3-activity.png'), fullPage: true });
  const reducedContext = await browser.newContext({ viewport: { width: 1000, height: 900 }, reducedMotion: 'reduce' });
  const reduced = await reducedContext.newPage();
  reduced.on('pageerror', (error) => errors.push(String(error)));
  await reduced.goto(`${base}/student/${SEED_IDS.demoStudent}`);
  await reduced.waitForSelector('.live-indicator.is-live');
  await api.demoReset({ student_id: SEED_IDS.demoStudent });
  await reduced.waitForSelector(`${concept(SEED_IDS.nodes.useEffect)}[data-status="active"]`);
  await promote();
  await reduced.waitForSelector(`${concept(SEED_IDS.nodes.useEffect)}[data-status="mastered"]`);
  assert.equal(await reduced.locator('.mastery-particles,.edge-energy,.edge-unlock-draw,[data-moment]').count(), 0, 'reduced motion keeps progress without animation');
  assert.deepEqual(errors, []);
  console.log('PASS: real progress animates mastery/unlock/ticker/edges, bounded particles, keyboard tooltip, cleanup, quiet initial loads/view switches, private activity, reduced motion.');
} finally { await api.demoReset({ full: true }); await browser.close(); }
