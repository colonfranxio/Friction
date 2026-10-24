import * as intelligence from '@friction/intelligence';
import { SEED_IDS, fakeIntelligence, type SkillNode } from '@friction/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadIntelligence } from '../src/intelligence';
import { MossRuntime, type CurriculumIndex, type RetrievalTrace } from '../src/services/moss-runtime';
import { createJsonStore } from '../src/store/json-store';
import { makeApp } from './helpers';

afterEach(() => vi.useRealTimers());
function index() {
  let prepared: SkillNode[] = [];
  return {
    prepare: vi.fn(async (nodes: SkillNode[]) => { prepared = structuredClone(nodes); return true; }),
    retrieve: vi.fn(async () => prepared.slice(0, 2).map((n) => n.id)),
    close: vi.fn(async () => {}),
  };
}
function setup(options: { createIndex?: () => CurriculumIndex; queryMs?: number; now?: () => number } = {}) {
  const store = createJsonStore(null);
  const traces: RetrievalTrace[] = [];
  const created: ReturnType<typeof index>[] = [];
  const runtime = new MossRuntime({ store, fingerprint: intelligence.curriculumFingerprint,
    createIndex: options.createIndex ?? (() => { const i = index(); created.push(i); return i; }),
    trace: (event) => traces.push(event), queryMs: options.queryMs, now: options.now });
  return { store, runtime, traces, created };
}

describe('Moss runtime wiring', () => {
  it('fake mode never loads intelligence or native SDK even with the flag and credentials', async () => {
    const load = vi.fn(async () => intelligence);
    const result = await loadIntelligence(false, { store: createJsonStore(null), load,
      env: { USE_MOSS_RETRIEVAL: '1', MOSS_PROJECT_ID: 'test', MOSS_PROJECT_KEY: 'test' } });
    result.start();
    expect(result.intel).toBe(fakeIntelligence);
    expect(load).not.toHaveBeenCalled();
    await result.close();
  });

  it.each([{}, { MOSS_PROJECT_ID: 'test', MOSS_PROJECT_KEY: 'test' }, { USE_MOSS_RETRIEVAL: '1' }])(
    'disabled or incomplete configuration never constructs a native adapter (%j)', async (env) => {
      const factory = vi.fn(intelligence.mossFromEnv);
      const create = vi.fn(() => fakeIntelligence);
      const result = await loadIntelligence(true, { store: createJsonStore(null), env, trace() {},
        load: async () => ({ ...intelligence, createIntelligence: create, mossFromEnv: factory }) });
      result.start();
      expect(factory).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith();
      await result.close();
    });

  it('cold calls fall back; background preparation makes canonical hints available', async () => {
    const t = setup();
    const nodes = t.store.db.nodes;
    expect(await t.runtime.retrieve('question', nodes)).toEqual([]);
    await t.runtime.refresh();
    expect(await t.runtime.retrieve('question', nodes)).toEqual(nodes.slice(0, 2).map((n) => n.id));
    expect(t.traces.some((e) => e.state === 'ready')).toBe(true);
    expect(t.traces.some((e) => e.state === 'retrieved' && e.candidates === 2)).toBe(true);
    expect(t.traces.find((e) => e.state === 'retrieved')?.ids).toEqual(nodes.slice(0, 2).map((n) => n.id));
    await t.runtime.close();
  });

  it('preparation failure backs off and baseline operation remains available', async () => {
    let now = 0;
    const i = index();
    i.prepare.mockRejectedValue(new Error('must not appear in trace'));
    const t = setup({ createIndex: () => i, now: () => now });
    await t.runtime.refresh();
    await t.runtime.refresh();
    expect(i.prepare).toHaveBeenCalledTimes(1);
    now = 1001;
    await t.runtime.refresh();
    expect(i.prepare).toHaveBeenCalledTimes(2);
    expect(await t.runtime.retrieve('private student prompt', t.store.db.nodes)).toEqual([]);
    expect(JSON.stringify(t.traces)).not.toMatch(/private student|must not appear/);
    await t.runtime.close();
  });

  it('starts preparation without blocking the API and clears the poll on close', async () => {
    vi.useFakeTimers();
    const i = index();
    let finish!: (v: boolean) => void;
    i.prepare.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const t = setup({ createIndex: () => i });
    t.runtime.start();
    expect(await makeApp({ store: t.store }).call('GET', '/health')).toMatchObject({ status: 200 });
    expect(await t.runtime.retrieve('question', t.store.db.nodes)).toEqual([]);
    finish(true);
    await t.runtime.refresh();
    await t.runtime.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('actual loader/API composition sends hints to Claude and preserves policy state', async () => {
    const store = createJsonStore(null);
    const traces: RetrievalTrace[] = [];
    const parse = vi.fn(async () => ({ stop_reason: 'end_turn', parsed_output: {
      concept: store.db.nodes.findIndex((n) => n.concept_name === 'Context API') + 1, confidence: 0.9,
    } }));
    const i = index();
    i.retrieve.mockImplementation(async () => [store.db.nodes.find((n) => n.concept_name === 'Context API')!.id]);
    const loaded = await loadIntelligence(true, { store,
      env: { USE_MOSS_RETRIEVAL: '1', MOSS_PROJECT_ID: 'test', MOSS_PROJECT_KEY: 'test' },
      trace: (e) => traces.push(e), load: async () => ({ ...intelligence,
        mossFromEnv: () => i as unknown as intelligence.MossCurriculumRetriever,
        createIntelligence: (opts) => intelligence.createIntelligence({ ...opts,
          client: { messages: { parse } } as unknown as NonNullable<intelligence.IntelligenceOptions['client']>, models: { classify: 'test-model' } }),
      }) });
    loaded.start();
    await vi.waitFor(() => expect(traces.some((e) => e.state === 'ready')).toBe(true));
    const app = makeApp({ store, intel: loaded.intel });
    const before = structuredClone(store.db.states);
    const r = await app.call('POST', '/intercept', { student_id: SEED_IDS.demoStudent,
      conversation_id: 'moss-live-path', app_source: 'sandbox', raw_prompt: 'How can I share the theme with distant descendants?' });
    expect(r.status).toBe(200);
    expect(r.body.node_id).toBe(store.db.nodes.find((n) => n.concept_name === 'Context API')!.id);
    expect(r.body.injected_prompt).toContain('Learning goal:');
    expect(store.db.states).toEqual(before);
    expect(JSON.stringify(parse.mock.calls)).toContain('Search suggests concepts');
    expect(traces.some((e) => e.state === 'retrieved')).toBe(true);
    await loaded.close();
  });
});

describe('Moss freshness, capacity and failures', () => {
  it('checks the authoritative store when an edit occurs during a snapshotted query', async () => {
    const t = setup();
    await t.runtime.refresh();
    const snapshot = structuredClone(t.store.db.nodes);
    let finish!: (ids: string[]) => void;
    t.created[0].retrieve.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const query = t.runtime.retrieve('question', snapshot);
    await Promise.resolve();
    t.store.db.nodes[0].mastery_criteria = 'New authoritative objective';
    finish([snapshot[0].id]);
    expect(await query).toEqual([]);
    expect(t.traces.at(-1)?.reason).toBe('cold_or_stale');
    await t.runtime.close();
  });
  it('rejects edited/deleted nodes immediately and rebuilds from actual educator routes', async () => {
    const t = setup();
    const app = makeApp({ store: t.store });
    await t.runtime.refresh();
    const original = t.store.db.nodes[0];
    await app.call('PATCH', `/nodes/${original.id}`, { mastery_criteria: 'New instructor objective' });
    expect(await t.runtime.retrieve('question', t.store.db.nodes)).toEqual([]);
    await t.runtime.refresh();
    expect(t.created[0].prepare.mock.calls.at(-1)![0][0].mastery_criteria).toBe('New instructor objective');
    expect(await t.runtime.retrieve('question', t.store.db.nodes)).not.toEqual([]);
    const added = await app.call('POST', `/trees/${SEED_IDS.tree}/nodes`, {
      concept_name: 'New skill', mastery_criteria: 'New goal', pillar_id: original.pillar_id, keywords: ['new skill'],
    });
    expect(added.status).toBe(200);
    expect(await t.runtime.retrieve('question', t.store.db.nodes)).toEqual([]);
    await t.runtime.refresh();
    expect(t.created[0].prepare.mock.calls.at(-1)![0].some((n) => n.id === added.body.id)).toBe(true);
    await app.call('DELETE', `/nodes/${original.id}`);
    expect(await t.runtime.retrieve('question', t.store.db.nodes)).toEqual([]);
    await t.runtime.refresh();
    t.created[0].retrieve.mockResolvedValueOnce([original.id, added.body.id]);
    expect(await t.runtime.retrieve('question', t.store.db.nodes)).toEqual([added.body.id]);
    await t.runtime.close();
  });

  it('discovers a newly ingested course and full reset without route hooks', async () => {
    const t = setup();
    const app = makeApp({ store: t.store, demoMatches: false });
    await t.runtime.refresh();
    const parsed = await app.call('POST', '/trees/parse', { kind: 'text', text: 'A different syllabus' });
    expect(parsed.status).toBe(200);
    const tree = parsed.body.tree_id;
    const nodes = t.store.db.nodes.filter((n) => n.tree_id === tree);
    expect(nodes.length).toBeGreaterThan(0);
    expect(await t.runtime.retrieve('question', nodes)).toEqual([]);
    await t.runtime.refresh();
    expect(t.created).toHaveLength(2);
    expect(await t.runtime.retrieve('question', nodes)).not.toEqual([]);
    await app.call('POST', '/demo/reset', { full: true });
    await t.runtime.refresh();
    expect(t.created[1].close).toHaveBeenCalledTimes(1);
    expect(await t.runtime.retrieve('question', nodes)).toEqual([]);
    expect(await t.runtime.retrieve('question', t.store.db.nodes)).not.toEqual([]);
    await t.runtime.close();
  });

  it('polls semantic edits but avoids rebuilding layout/state-only changes', async () => {
    vi.useFakeTimers();
    const t = setup();
    t.runtime.start();
    await t.runtime.refresh();
    t.store.db.states[0].current_blooms_level = 4;
    t.store.db.nodes[0].position = { x: 100, y: 200 };
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.created[0].prepare).toHaveBeenCalledTimes(1);
    t.store.db.nodes[0].keywords.push('changed objective');
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.created[0].prepare).toHaveBeenCalledTimes(2);
    await t.runtime.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a snapshot while warming and eventually prepares the latest edit', async () => {
    let now = 0;
    const i = index();
    let finish!: (ready: boolean) => void;
    i.prepare.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const t = setup({ createIndex: () => i, now: () => now });
    const firstName = t.store.db.nodes[0].concept_name;
    const preparing = t.runtime.refresh();
    t.store.db.nodes[0].concept_name = 'Latest edited concept';
    const queued = t.runtime.refresh();
    expect(i.prepare.mock.calls[0][0][0].concept_name).toBe(firstName);
    finish(true);
    await preparing;
    await queued;
    expect(await t.runtime.retrieve('question', t.store.db.nodes)).toEqual([]);
    now = 1001;
    await t.runtime.refresh();
    expect(i.prepare.mock.calls.at(-1)![0][0].concept_name).toBe('Latest edited concept');
    expect(await t.runtime.retrieve('question', t.store.db.nodes)).not.toEqual([]);
    await t.runtime.close();
  });

  it('counts still-closing handles against capacity and retains the newest course', async () => {
    const t = setup();
    const add = (id: string) => {
      t.store.db.nodes.push(...t.store.db.nodes.filter((n) => n.tree_id === SEED_IDS.tree)
        .map((n) => ({ ...n, id: `${id}-${n.id}`, tree_id: id })));
      t.store.db.users.find((u) => u.id === SEED_IDS.demoStudent)!.active_tree_id = id;
    };
    await t.runtime.refresh();
    add('course-a');
    await t.runtime.refresh();
    expect(t.created).toHaveLength(2);
    let finishClose!: () => void;
    t.created[1].close.mockImplementationOnce(() => new Promise((resolve) => { finishClose = resolve; }));
    add('course-b');
    const blocked = t.runtime.refresh();
    expect(t.created).toHaveLength(2);
    add('course-c');
    const latest = t.runtime.refresh();
    finishClose();
    await blocked;
    await latest;
    expect(t.created).toHaveLength(3);
    expect(t.created[2].prepare.mock.calls[0][0][0].tree_id).toBe('course-c');
    expect(await t.runtime.retrieve('question', t.store.db.nodes.filter((n) => n.tree_id === 'course-b'))).toEqual([]);
    await t.runtime.close();
  });

  it('bounds response time without multiplying native queries and safely disposes afterward', async () => {
    vi.useFakeTimers();
    const session = { addDocs: vi.fn(async () => ({})), query: vi.fn(async () => ({ docs: [] as { id: string }[] })), close: vi.fn(async () => {}) };
    const adapter = new intelligence.MossCurriculumRetriever(async () => session);
    const t = setup({ createIndex: () => adapter, queryMs: 20 });
    await t.runtime.refresh();
    let finish!: (v: { docs: { id: string }[] }) => void;
    session.query.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const query = t.runtime.retrieve('first', t.store.db.nodes);
    await vi.advanceTimersByTimeAsync(20);
    expect(await query).toEqual([]);
    expect(t.traces.at(-1)?.reason).toBe('timeout');
    expect(await t.runtime.retrieve('second', t.store.db.nodes)).toEqual([]);
    expect(session.query).toHaveBeenCalledTimes(2); // prewarm + one pending native query
    const closing = t.runtime.close();
    expect(t.runtime.close()).toBe(closing);
    expect(session.close).not.toHaveBeenCalled();
    finish({ docs: [] });
    await closing;
    expect(session.close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('missing SDK during warmup and thrown queries never reject application calls', async () => {
    const missing = new intelligence.MossCurriculumRetriever(async () => { throw new Error('Cannot load optional native SDK'); });
    const t = setup({ createIndex: () => missing });
    await t.runtime.refresh();
    expect(await t.runtime.retrieve('question', t.store.db.nodes)).toEqual([]);
    await t.runtime.close();
    const throwing = index();
    throwing.retrieve.mockRejectedValueOnce(new Error('private provider payload'));
    const other = setup({ createIndex: () => throwing });
    await other.runtime.refresh();
    expect(await other.runtime.retrieve('question', other.store.db.nodes)).toEqual([]);
    expect(other.traces.at(-1)?.reason).toBe('unavailable');
    expect(JSON.stringify(other.traces)).not.toContain('private provider payload');
    await other.runtime.close();
  });

  it('retries the latest revision after native preparation refuses an active query', async () => {
    let now = 0;
    const sessions: { addDocs: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }[] = [];
    const adapter = new intelligence.MossCurriculumRetriever(async () => {
      const s = { addDocs: vi.fn(async () => ({})), query: vi.fn(async () => ({ docs: [] as { id: string }[] })), close: vi.fn(async () => {}) };
      sessions.push(s);
      return s;
    });
    const t = setup({ createIndex: () => adapter, now: () => now });
    await t.runtime.refresh();
    let finish!: (v: { docs: { id: string }[] }) => void;
    sessions[0].query.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const query = t.runtime.retrieve('in flight', t.store.db.nodes);
    await Promise.resolve();
    t.store.db.nodes[0].mastery_criteria = 'Latest revision';
    await t.runtime.refresh(); // adapter.prepare refuses while native query is active
    expect(t.traces.at(-1)?.reason).toBe('unavailable');
    finish({ docs: [] });
    await query;
    now = 1001;
    await t.runtime.refresh();
    expect(sessions).toHaveLength(2);
    expect(sessions[1].addDocs.mock.calls[0][0][0].text).toContain('Latest revision');
    expect(t.traces.at(-1)?.state).toBe('ready');
    await t.runtime.close();
  });

  it('stops polling immediately but waits for pending warmup before closing handles', async () => {
    vi.useFakeTimers();
    const i = index();
    let finish!: (ready: boolean) => void;
    i.prepare.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const t = setup({ createIndex: () => i });
    t.runtime.start();
    const closing = t.runtime.close();
    expect(vi.getTimerCount()).toBe(0);
    expect(i.close).not.toHaveBeenCalled();
    finish(true);
    await closing;
    expect(i.close).toHaveBeenCalledTimes(1);
    expect(t.traces.some((e) => e.state === 'ready')).toBe(false);
    expect(t.traces.at(-1)?.state).toBe('closed');
  });
});

describe('Moss stall limitation (documented)', () => {
  it('a permanently hung native preparation never blocks requests or queues more work', async () => {
    const hung = index();
    hung.prepare.mockImplementation(() => new Promise<boolean>(() => {}));
    const t = setup({ createIndex: () => hung });
    const first = t.runtime.refresh();
    for (let i = 0; i < 5; i++) expect(t.runtime.refresh()).toBe(first);
    expect(hung.prepare).toHaveBeenCalledTimes(1);
    const context = t.store.db.nodes.find((n) => n.concept_name === 'Context API')!;
    const parse = vi.fn(async () => ({ stop_reason: 'end_turn', parsed_output: {
      concept: t.store.db.nodes.indexOf(context) + 1, confidence: 0.9 } }));
    const intel = intelligence.createIntelligence({ curriculumRetriever: t.runtime, models: { classify: 'test-model' },
      client: { messages: { parse } } as unknown as NonNullable<intelligence.IntelligenceOptions['client']> });
    const app = makeApp({ store: t.store, intel });
    const started = Date.now();
    const r = await app.call('POST', '/intercept', { student_id: SEED_IDS.demoStudent, conversation_id: 'moss-stall',
      app_source: 'sandbox', raw_prompt: 'How can I share the theme with distant descendants?' });
    expect(r.status).toBe(200);
    expect(r.body.node_id).toBe(context.id);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(JSON.stringify(parse.mock.calls)).not.toContain('Search suggests');
    expect(t.traces.at(-1)).toMatchObject({ state: 'fallback', reason: 'cold_or_stale' });
    // Disposal waits on the hung native call; apps/api/src/index.ts caps this at 2s after the store flush.
    const closed = vi.fn();
    void t.runtime.close().then(closed);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(closed).not.toHaveBeenCalled();
  });
});
