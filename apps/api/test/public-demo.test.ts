import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fakeIntelligence, SEED_IDS } from '@friction/shared';
import { loadConfig } from '../src/env';
import { createPublicDemo, PublicLedger } from '../src/public-demo';

const dirs: string[] = [];
const closes: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of closes.splice(0)) await close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function ledger() { const d = mkdtempSync(join(tmpdir(), 'friction-public-')); dirs.push(d); return join(d, 'usage.json'); }
async function setup(intel = fakeIntelligence) {
  let time = Date.now();
  const config = loadConfig({ ALLOWED_ORIGINS: 'https://judge.example', DEMO_MODE: '0' });
  config.parseDelayMs = 0;
  const service = await createPublicDemo(config, { ledger: new PublicLedger(ledger()), now: () => time, load: async () => ({ intel, start() {}, close: async () => {} }) });
  closes.push(service.close);
  const req = async (path: string, method = 'GET', body?: unknown) => {
    const res = await service.app.request(path, { method, headers: { origin: 'https://judge.example', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return new Response(await res.arrayBuffer(), { status: res.status, headers: res.headers });
  };
  const guest = async () => { const r = await req('/guest', 'POST'); expect(r.status).toBe(201); return (await r.json()).api_path as string; };
  return { req, guest, advance: () => { time += 31 * 60_000; } };
}
describe('public demo boundary', () => {
  it('requires a bearer URL and hides local/global routes', async () => {
    const { req } = await setup();
    expect((await req(`/students/${SEED_IDS.demoStudent}`)).status).toBe(404);
    expect((await req(`/g/unknown/students/${SEED_IDS.demoStudent}`)).status).toBe(401);
  });
  it('isolates mutations, reads, and reset permissions across two guests', async () => {
    const { req, guest } = await setup();
    const a = await guest(), b = await guest();
    const node = SEED_IDS.nodes.jsx;
    expect((await req(`${a}/nodes/${node}`, 'PATCH', { concept_name: 'private change' })).status).toBe(200);
    const bundleA = await (await req(`${a}/trees/${SEED_IDS.tree}`)).json();
    const bundleB = await (await req(`${b}/trees/${SEED_IDS.tree}`)).json();
    expect(bundleA.nodes.find((n: { id: string }) => n.id === node).concept_name).toBe('private change');
    expect(bundleB.nodes.find((n: { id: string }) => n.id === node).concept_name).not.toBe('private change');
    expect((await req(`${a}/demo/reset`, 'POST', {})).status).toBe(403);
    expect((await req(`${a}/chat`, 'POST', {})).status).toBe(403);
  });
  it('caps session count, input bytes, request count and expires bearer URLs', async () => {
    const { req, guest, advance } = await setup();
    const a = await guest(); await guest();
    expect((await req('/guest', 'POST')).status).toBe(429);
    expect((await req(`${a}/trees/parse`, 'POST', { kind: 'text', text: 'x'.repeat(70_000) })).status).toBe(413);
    for (let n = 0; n < 150; n++) await (await req(`${a}/health`)).text();
    expect((await req(`${a}/health`)).status).toBe(429);
    advance();
    expect((await req(`${a}/health`)).status).toBe(401);
  });
  it('allows only configured production origins', async () => {
    const { req, guest } = await setup(); const a = await guest();
    expect((await req(`${a}/health`)).headers.get('access-control-allow-origin')).toBe('https://judge.example');
  });
  it('persists global reservation caps across restarts', () => {
    const path = ledger(); const first = new PublicLedger(path);
    for (let n = 0; n < 60; n++) first.reserve('operations');
    expect(() => new PublicLedger(path).reserve('operations')).toThrow('Daily demo allowance');
  });
  it('stops paid parse work before invoking intelligence after the guest cap', async () => {
    let calls = 0;
    const { req, guest } = await setup({ ...fakeIntelligence, parseSyllabus: async (v) => { calls++; return fakeIntelligence.parseSyllabus(v); } });
    const a = await guest();
    for (let n = 0; n < 21; n++) await (await req(`${a}/trees/parse`, 'POST', { kind: 'text', text: 'small syllabus' })).text();
    expect(calls).toBe(20);
  });
  it('supports Render PORT and explicit API_PORT precedence', () => {
    expect(loadConfig({ PORT: '10000' }).port).toBe(10000);
    expect(loadConfig({ PORT: '10000', API_PORT: '8787' }).port).toBe(8787);
  });
  it('caps manual nodes too and bounds metadata edits', async () => {
    const { req, guest } = await setup(); const a = await guest();
    for (let n = 0; n < 24; n++) expect((await req(`${a}/trees/${SEED_IDS.tree}/nodes`, 'POST', { concept_name: `node${n}`, pillar_id: SEED_IDS.pillars.foundations })).status).toBe(200);
    expect((await req(`${a}/trees/${SEED_IDS.tree}/nodes`, 'POST', { concept_name: 'overflow', pillar_id: SEED_IDS.pillars.foundations })).status).toBe(413);
    expect((await req(`${a}/trees/${SEED_IDS.tree.replace('-', '%2D')}/nodes`, 'POST', { concept_name: 'encoded overflow', pillar_id: SEED_IDS.pillars.foundations })).status).toBe(413);
    expect((await req(`${a}/nodes/${SEED_IDS.nodes.jsx}`, 'PATCH', { concept_name: 'x'.repeat(5000) })).status).toBe(413);
  });
});
