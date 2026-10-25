/** Visual acceptance captures real routes at demo, laptop, and mobile sizes. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createFrictionClient, DEMO_PROMPTS, SEED_IDS } from '@friction/shared';

const api = createFrictionClient('http://127.0.0.1:8788');
const base = 'http://127.0.0.1:5173';
const artifacts = fileURLToPath(new URL('./artifacts/ui-review/', import.meta.url));
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : { channel: 'chrome' });
try {
  assert.equal((await api.health()).mode.server, 'mock');
  await api.demoReset({ full: true }); await mkdir(artifacts, { recursive: true });
  const conversation = crypto.randomUUID();
  const question = await api.intercept({ student_id: SEED_IDS.demoStudent, raw_prompt: DEMO_PROMPTS.question, app_source: 'sandbox', conversation_id: conversation });
  await api.responses({ intercept_id: question.intercept_id!, llm_response: 'Quick check: what does the dependency array tell React?' });
  await api.intercept({ student_id: SEED_IDS.demoStudent, raw_prompt: DEMO_PROMPTS.correctAnswer, app_source: 'sandbox', conversation_id: conversation });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(String(error)));
  for (const size of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'laptop', width: 1280, height: 800 }, { name: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    for (const [name, route] of [['educator', `/educator/${SEED_IDS.tree}`], ['student', `/student/${SEED_IDS.demoStudent}`], ['sandbox', '/sandbox']]) {
      await page.goto(base + route); await page.waitForSelector('.live-indicator.is-live');
      await page.waitForSelector('[data-concept]'); await page.evaluate(() => document.fonts.ready);
      if (name === 'sandbox') {
        await page.getByRole('textbox', { name: 'Chat message' }).fill(DEMO_PROMPTS.question);
        await page.getByRole('button', { name: 'Send message' }).click();
        await page.waitForSelector('[data-reply-status="complete"]');
        await page.locator('.chat-content pre').waitFor();
        assert.equal(await page.locator('.chat-content pre').innerText().then((text) => text.includes('```')), false);
      }
      await page.mouse.move(1, 1); await page.waitForTimeout(300);
      if (name !== 'sandbox') {
        const centers = await page.evaluate(() => {
          const pane = document.querySelector('.react-flow')!.getBoundingClientRect();
          const node = document.querySelector('[data-concept="55555555-5555-4555-8555-000000000001"] .node-circle')!.getBoundingClientRect();
          return { heading: pane.x + pane.width / 2, node: node.x + node.width / 2 };
        });
        assert.ok(Math.abs(centers.heading - centers.node) < 4, `${name} tree is centred in its window`);
      } else {
        // The map opens on the frontier; the way back only appears once you scroll away from it.
        const back = page.getByRole('button', { name: 'Back to what you’re learning' });
        assert.equal(await back.count(), 0, 'no back button while the frontier is in view');
        await page.locator('.mini-tree .tree-scroll').evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
        await back.waitFor(); await back.click(); await back.waitFor({ state: 'detached' });
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${name} ${size.name} horizontal overflow`);
      if (name === 'sandbox' && size.name === 'laptop') assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 8), true, 'sandbox demo fits laptop height');
      await page.screenshot({ path: resolve(artifacts, `${name}-${size.name}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/educator/${SEED_IDS.tree}`); await page.waitForSelector('.live-indicator.is-live');
  await page.getByRole('button', { name: 'Upload syllabus' }).click();
  await page.screenshot({ path: resolve(artifacts, 'upload-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: desktop/laptop/mobile educator, student and sandbox; safe formatted code, no page overflow, mobile upload.');
} finally { await api.demoReset({ full: true }); await browser.close(); }
