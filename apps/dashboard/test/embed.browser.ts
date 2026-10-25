/**
 * Extension side-panel map (/student/:id?embed=1). Run with the dashboard and a mock API already running; this resets demo data.
 * Checks narrow panel widths with a five-card row, the click detail card, no teacher chrome, error Retry,
 * and a live SSE mastery update (grade through the same backend the iframe uses, no reload).
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { computeDepths, createFrictionClient, DEMO_PROMPTS, SEED_IDS } from '@friction/shared';

const dashboardUrl = process.env.DASHBOARD_TEST_URL ?? 'http://127.0.0.1:5173';
const api = createFrictionClient(process.env.DASHBOARD_TEST_API ?? 'http://127.0.0.1:8788');
const artifacts = process.env.DASHBOARD_EVIDENCE_DIR ?? fileURLToPath(new URL('./artifacts/embed/', import.meta.url));
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : { channel: 'chrome' });
const errors: string[] = [];
const embedUrl = `${dashboardUrl}/student/${SEED_IDS.demoStudent}?embed=1`;
const useEffectCard = `[data-concept="${SEED_IDS.nodes.useEffect}"]`;
async function waitFor(page: Page, check: () => Promise<boolean>, description: string, ms = 15000) {
  for (let n = 0; n < ms / 100; n++) {
    if (await check()) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out: ${description}`);
}
try {
  const health = await api.health();
  assert.equal(health.mode.server, 'mock', 'embed.browser resets data: run it against a private mock');
  await mkdir(artifacts, { recursive: true });
  await api.demoReset({ full: true });
  // Widen the first row to five cards (new concepts with no prerequisites land on row 0).
  const bundle = await api.getTree(SEED_IDS.tree);
  const depths = computeDepths(bundle.nodes, bundle.edges);
  const roots = bundle.nodes.filter((n) => depths[n.id] === 0).length;
  for (let i = roots; i < 5; i++) await api.createNode(SEED_IDS.tree, { concept_name: `Wide row concept ${i + 1}`, pillar_id: bundle.pillars[0].id, mastery_criteria: 'Fixture card for the five-card row check' });
  const cards = bundle.nodes.length + Math.max(0, 5 - roots);

  for (const width of [360, 390, 420]) {
    const context = await browser.newContext({ viewport: { width, height: 760 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`${width}: ${error}`));
    await page.goto(embedUrl);
    await page.waitForSelector('[data-concept]');
    assert.equal(await page.locator('[data-concept]').count(), cards, `${width}: every card rendered`);
    assert.equal(await page.locator('.topbar, .viewer-select, [aria-label="Viewing as"]').count(), 0, `${width}: no TopBar/teacher controls`);
    // Every card's real bounds sit inside the panel (no horizontal navigation exists to reach clipped cards).
    for (const box of await page.locator('[data-concept] .concept-card').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
      assert.ok(box.left >= 0 && box.right <= width, `${width}: card ${Math.round(box.left)}..${Math.round(box.right)} fits`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}: no horizontal overflow`);
    // Detail card: opens on click, readable, fits, closes; focus returns to the card.
    await page.locator(useEffectCard).click();
    const detail = page.locator('.embed-detail');
    await detail.waitFor();
    assert.match(await detail.innerText(), /React useEffect/);
    const d = await detail.boundingBox();
    assert.ok(d && d.x >= 0 && d.x + d.width <= width, `${width}: detail card fits`);
    assert.ok(Number.parseFloat(await detail.locator('h2').evaluate((el) => getComputedStyle(el).fontSize)) >= 14, `${width}: readable title`);
    await page.screenshot({ path: `${artifacts}embed-${width}.png` });
    await page.keyboard.press('Escape');
    await detail.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-id')), SEED_IDS.nodes.useEffect, `${width}: focus back on the card`);
    await page.locator(useEffectCard).click();
    await page.getByRole('button', { name: 'Close' }).click();
    await detail.waitFor({ state: 'detached' });
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 760 }, reducedMotion: 'reduce' });
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(String(error))));
  // Full Student route is unchanged (TopBar present).
  const full = await context.newPage();
  await full.goto(`${dashboardUrl}/student/${SEED_IDS.demoStudent}`);
  await full.waitForSelector('.topbar');
  await full.close();
  // Unknown student: compact error with Retry.
  const unknown = await context.newPage();
  await unknown.goto(`${dashboardUrl}/student/00000000-0000-4000-8000-000000000000?embed=1`);
  await unknown.getByRole('button', { name: 'Try again' }).waitFor();
  await unknown.close();

  // Live mastery: the open panel turns the card gold over SSE, no reload.
  const page = await context.newPage();
  let loads = 0;
  page.on('load', () => loads++);
  await page.goto(embedUrl);
  await page.waitForSelector(useEffectCard);
  assert.equal(await page.locator(useEffectCard).getAttribute('data-status'), 'active');
  await page.locator(useEffectCard).click();
  await page.locator('.embed-detail').waitFor();
  const conversation_id = 'embed-browser-live';
  const first = await api.intercept({ student_id: SEED_IDS.demoStudent, raw_prompt: DEMO_PROMPTS.question, app_source: 'claude_web', conversation_id, previous_assistant_text: null });
  assert.equal(first.node_id, SEED_IDS.nodes.useEffect);
  await api.intercept({ student_id: SEED_IDS.demoStudent, raw_prompt: DEMO_PROMPTS.correctAnswer, app_source: 'claude_web', conversation_id, previous_assistant_text: 'Quick check: what does the dependency array tell React?' });
  await waitFor(page, async () => (await page.locator(useEffectCard).getAttribute('data-status')) === 'mastered', 'card turns gold live');
  await waitFor(page, async () => /Mastered · .* · 4\/4/.test(await page.locator('.embed-detail').innerText()), 'detail card shows Mastered 4/4');
  assert.equal(loads, 1, 'no reload');
  await page.screenshot({ path: `${artifacts}embed-live-mastered.png` });
  assert.deepEqual(errors, []);
  console.log(`PASS (${health.mode.server}): embed at 360/390/420 with a five-card row, detail card, no teacher chrome, Student route, Retry, live gold over SSE.`);
} finally {
  await api.demoReset({ full: true }).catch(() => {});
  await browser.close();
}
