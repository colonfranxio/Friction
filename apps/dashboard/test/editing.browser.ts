/** Agent C's serialized mock-backed full edit/persist/cycle-error acceptance. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createFrictionClient, SEED_IDS } from '@friction/shared';

const base = process.env.DASHBOARD_TEST_URL ?? 'http://127.0.0.1:5173';
const api = createFrictionClient(process.env.DASHBOARD_TEST_API ?? 'http://127.0.0.1:8788');
const browser = await chromium.launch(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : { channel: 'chrome' });
const tree = () => api.getTree(SEED_IDS.tree);
async function eventually(check: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 100; attempt++) { if (await check()) return; await new Promise((done) => setTimeout(done, 100)); }
  throw new Error('Editing did not persist');
}
try {
  assert.equal((await api.health()).mode.server, 'mock');
  await api.demoReset({ full: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${base}/educator/${SEED_IDS.tree}`); await page.waitForSelector('.live-indicator.is-live');
  await page.getByRole('button', { name: 'Edit mode' }).click();
  await page.getByRole('button', { name: 'Node', exact: true }).click();
  await page.getByLabel('Concept', { exact: true }).fill('Editing acceptance concept');
  await page.getByLabel('Mastery criteria', { exact: true }).fill('Explain persistence in your own words.');
  await page.getByRole('button', { name: 'Create node', exact: true }).click();
  await eventually(async () => (await tree()).nodes.length === 9);
  const added = (await tree()).nodes.find((node) => node.concept_name === 'Editing acceptance concept')!;
  const node = page.locator(`[data-concept="${added.id}"]`);
  await node.getByRole('combobox', { name: 'Required mastery level' }).selectOption('2');
  await eventually(async () => (await tree()).nodes.find((n) => n.id === added.id)?.required_blooms_level === 2);
  await page.getByRole('button', { name: 'Rename Foundations' }).click();
  await page.getByRole('textbox', { name: 'Pillar name' }).fill('Foundations revised');
  await page.getByRole('textbox', { name: 'Pillar name' }).press('Enter');
  await eventually(async () => (await tree()).pillars[0].name === 'Foundations revised');
  await node.locator('.node-circle').click();
  await page.getByLabel('Concept', { exact: true }).fill('Edited concept');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await eventually(async () => (await tree()).nodes.find((n) => n.id === added.id)?.concept_name === 'Edited concept');
  const bounds = await node.locator('.node-circle').boundingBox(); assert.ok(bounds);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 55, bounds.y + bounds.height / 2 + 25, { steps: 12 }); await page.mouse.up();
  await eventually(async () => (await tree()).nodes.find((n) => n.id === added.id)?.position !== null);
  const position = (await tree()).nodes.find((n) => n.id === added.id)!.position;
  await page.reload(); await page.waitForSelector('.live-indicator.is-live');
  assert.deepEqual((await tree()).nodes.find((n) => n.id === added.id)!.position, position);
  await page.getByRole('button', { name: 'Edit mode' }).click();
  const connect = async (source: string, target: string) => {
    const sourceHandle = page.locator(`[data-concept="${source}"] .react-flow__handle.source`);
    const targetHandle = page.locator(`[data-concept="${target}"] .react-flow__handle.target`);
    const from = await sourceHandle.boundingBox(); const to = await targetHandle.boundingBox(); assert.ok(from && to);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 16 }); await page.mouse.up();
  };
  await connect(added.id, SEED_IDS.nodes.useEffect);
  await eventually(async () => (await tree()).edges.some((edge) => edge.parent_node_id === added.id && edge.child_node_id === SEED_IDS.nodes.useEffect));
  await connect(SEED_IDS.nodes.useEffect, SEED_IDS.nodes.jsx);
  await page.getByRole('alert').filter({ hasText: 'That would create a loop' }).waitFor();
  assert.equal((await tree()).edges.length, 9);
  const edge = page.locator(`.react-flow__edge[data-id="${added.id}:${SEED_IDS.nodes.useEffect}"]`);
  await edge.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Backspace');
  await eventually(async () => !(await tree()).edges.some((item) => item.parent_node_id === added.id && item.child_node_id === SEED_IDS.nodes.useEffect));
  await node.locator('.node-circle').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete node', exact: true }).click();
  await eventually(async () => (await tree()).nodes.length === 8);
  assert.deepEqual(errors, []);
  console.log('PASS: create, required badge, pillar rename, inspector save, drag/reload persist, connect, cycle toast, keyboard edge delete, node delete.');
} finally { await api.demoReset({ full: true }); await browser.close(); }
