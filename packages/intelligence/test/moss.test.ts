import type Anthropic from '@anthropic-ai/sdk';
import { buildSeed, DEMO_PROMPTS } from '@friction/shared';
import { describe, expect, it, vi } from 'vitest';
import { createIntelligence } from '../src/index';
import { MossCurriculumRetriever, mossFromEnv, type MossSession } from '../src/moss';
import { curriculumFingerprint, within } from '../src/retrieval';

const nodes = buildSeed().nodes;
const response = { stop_reason: 'end_turn', parsed_output: { concept: 1, confidence: 0.8 } };
function client() {
  const parse = vi.fn(async () => response);
  return { parse, sdk: { messages: { parse } } as unknown as Anthropic };
}
function session() {
  return {
    addDocs: vi.fn(async () => ({ added: nodes.length, updated: 0 })),
    query: vi.fn(async () => ({ docs: [{ id: nodes[0].id }] })),
    close: vi.fn(async () => {}),
  };
}

describe('curriculum fingerprint', () => {
  it('is order-independent but detects edits, deletes and tree switches', () => {
    const original = curriculumFingerprint(nodes);
    expect(curriculumFingerprint([...nodes].reverse())).toBe(original);
    for (const patch of [
      { concept_name: 'Changed' }, { mastery_criteria: 'Changed' },
      { keywords: ['new phrase'] }, { tree_id: 'another-tree' },
    ]) {
      expect(curriculumFingerprint(nodes.map((n, i) => i ? n : { ...n, ...patch }))).not.toBe(original);
    }
    expect(curriculumFingerprint(nodes.slice(1))).not.toBe(original);
  });
});

describe('isolated Moss adapter', () => {
  it('needs both credentials and does not initialize without them', () => {
    expect(mossFromEnv({})).toBeNull();
    expect(mossFromEnv({ MOSS_PROJECT_ID: 'project' })).toBeNull();
    expect(mossFromEnv({ MOSS_PROJECT_KEY: 'key' })).toBeNull();
  });

  it('returns no candidates while cold and rejects mixed or duplicate scopes', async () => {
    const open = vi.fn(async () => session());
    const r = new MossCurriculumRetriever(open);
    expect(await r.retrieve('a paraphrase', nodes)).toEqual([]);
    expect(await r.prepare([])).toBe(false);
    expect(await r.prepare([...nodes, { ...nodes[0], id: 'new', tree_id: 'other' }])).toBe(false);
    expect(await r.prepare([...nodes, nodes[0]])).toBe(false);
    expect(open).not.toHaveBeenCalled();
    await r.close();
  });

  it('single-flights prewarm, stays local and validates canonical result IDs', async () => {
    const s = session();
    const open = vi.fn(async () => s);
    const r = new MossCurriculumRetriever(open);
    expect(await Promise.all([r.prepare(nodes), r.prepare(nodes)])).toEqual([true, true]);
    expect(open).toHaveBeenCalledTimes(1);
    expect(s.addDocs).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: nodes[0].id, metadata: { treeId: nodes[0].tree_id, revision: curriculumFingerprint(nodes) } }),
    ]));
    s.query.mockResolvedValueOnce({ docs: [{ id: 'foreign' }, { id: nodes[1].id }, { id: nodes[1].id }] });
    expect(await r.retrieve('a paraphrase', nodes)).toEqual([nodes[1].id]);
    expect(await r.prepare([...nodes].reverse())).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    await r.close();
    expect(s.close).toHaveBeenCalledTimes(1);
    expect(await r.retrieve('a paraphrase', nodes)).toEqual([]);
  });

  it('does not use stale indexes after same-ID edits or deletions', async () => {
    const s = session();
    const r = new MossCurriculumRetriever(async () => s);
    await r.prepare(nodes);
    const edited = nodes.map((n, i) => i ? n : { ...n, mastery_criteria: 'Different objective' });
    expect(await r.retrieve('a paraphrase', edited)).toEqual([]);
    expect(await r.retrieve('a paraphrase', nodes.slice(1))).toEqual([]);
    expect(s.query).toHaveBeenCalledTimes(1); // prewarm only
    await r.close();
  });

  it('bounds timed-out queries to one outstanding operation', async () => {
    const s = session();
    const r = new MossCurriculumRetriever(async () => s);
    await r.prepare(nodes);
    let finish!: (v: { docs: { id: string }[] }) => void;
    s.query.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    expect(await within(r.retrieve('first', nodes), 5, [] as string[])).toEqual([]);
    expect(await r.retrieve('second', nodes)).toEqual([]);
    expect(s.query).toHaveBeenCalledTimes(2); // prewarm + first query
    finish({ docs: [{ id: nodes[0].id }] });
    await Promise.resolve();
    await r.close();
  });

  it('rejects edits made while a query is in flight', async () => {
    const s = session();
    const r = new MossCurriculumRetriever(async () => s);
    const mutable = structuredClone(nodes);
    await r.prepare(mutable);
    let finish!: (v: { docs: { id: string }[] }) => void;
    s.query.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const result = r.retrieve('question', mutable);
    mutable[0].mastery_criteria = 'Edited';
    finish({ docs: [{ id: mutable[0].id }] });
    expect(await result).toEqual([]);
    await r.close();
  });

  it('waits for an outstanding query before releasing native handles and closes once', async () => {
    const s = session();
    const cleanup = vi.fn(async () => {});
    const r = new MossCurriculumRetriever(async () => s, cleanup);
    await r.prepare(nodes);
    let finish!: (v: { docs: { id: string }[] }) => void;
    s.query.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const query = r.retrieve('question', nodes);
    const closing = r.close();
    expect(r.close()).toBe(closing);
    await Promise.resolve();
    expect(s.close).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();
    finish({ docs: [{ id: nodes[0].id }] });
    expect(await query).toEqual([]);
    await closing;
    expect(s.close).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not report a different pending curriculum as prepared', async () => {
    const s = session();
    const r = new MossCurriculumRetriever(async () => s);
    const first = r.prepare(nodes);
    const other = r.prepare(nodes.slice(1));
    expect(await first).toBe(true);
    expect(await other).toBe(false);
    await r.close();
  });

  it('closes replaced sessions and failed preparations', async () => {
    const first = session();
    const second = session();
    second.addDocs.mockRejectedValueOnce(new Error('provider problem'));
    const open = vi.fn<() => Promise<MossSession>>().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const r = new MossCurriculumRetriever(open);
    expect(await r.prepare(nodes)).toBe(true);
    expect(await r.prepare(nodes.slice(1))).toBe(false);
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).toHaveBeenCalledTimes(1);
    expect(await r.retrieve('question', nodes)).toEqual([]);
    await r.close();
  });

  it('turns authentication and warm-query failures into an unavailable index', async () => {
    const r = new MossCurriculumRetriever(async () => { throw new Error('auth failed'); });
    expect(await r.prepare(nodes)).toBe(false);
    expect(await r.retrieve('question', nodes)).toEqual([]);
    await r.close();
    const s = session();
    s.query.mockRejectedValueOnce(new Error('embedding failed'));
    const failed = new MossCurriculumRetriever(async () => s);
    expect(await failed.prepare(nodes)).toBe(false);
    expect(s.close).toHaveBeenCalledTimes(1);
    await failed.close();
  });
});

describe('opt-in classification context', () => {
  it('keeps one semantic snapshot when an educator edits during retrieval', async () => {
    const c = client();
    const mutable = structuredClone(nodes);
    const previous = mutable[0].mastery_criteria;
    let finish!: (ids: string[]) => void;
    const intel = createIntelligence({ client: c.sdk, models: { classify: 'test-model' },
      curriculumRetriever: { retrieve: () => new Promise((resolve) => { finish = resolve; }) } });
    const result = intel.classifyTopic('a novel question', mutable);
    await Promise.resolve();
    mutable[0].mastery_criteria = 'Edited while the request was running';
    finish([mutable[0].id]);
    await result;
    const params = (c.parse.mock.calls as unknown[][])[0][0] as { messages: { content: string }[] };
    expect(params.messages[0].content).toContain(previous);
    expect(params.messages[0].content).not.toContain('Edited while');
  });
  it('preserves keyword routing without touching retrieval or Claude', async () => {
    const c = client();
    const retrieve = vi.fn(async () => [nodes[1].id]);
    const intel = createIntelligence({ client: c.sdk, curriculumRetriever: { retrieve } });
    expect((await intel.classifyTopic(DEMO_PROMPTS.question, nodes)).method).toBe('keyword');
    expect(retrieve).not.toHaveBeenCalled();
    expect(c.parse).not.toHaveBeenCalled();
  });

  it('keeps the complete catalog and makes Claude decide with validated hints', async () => {
    const c = client();
    const intel = createIntelligence({ client: c.sdk, models: { classify: 'test-model' },
      curriculumRetriever: { retrieve: async () => ['foreign', nodes[1].id] } });
    expect(await intel.classifyTopic('a novel question', nodes)).toEqual({ node_id: nodes[0].id, confidence: 0.8, method: 'llm' });
    const params = (c.parse.mock.calls as unknown[][])[0][0] as { messages: { content: string }[] };
    expect(params.messages[0].content).toContain('Search suggests concepts 2.');
    for (const n of nodes) expect(params.messages[0].content).toContain(n.mastery_criteria);
    expect(params.messages[0].content).not.toContain('foreign');
  });

  it.each(['empty', 'unknown', 'exception', 'timeout'])('uses the baseline prompt on %s retrieval', async (kind) => {
    const c = client();
    const retrieve = async (): Promise<string[]> => {
      if (kind === 'exception') throw new Error('provider problem');
      if (kind === 'timeout') return new Promise(() => {});
      return kind === 'unknown' ? ['foreign'] : [];
    };
    const intel = createIntelligence({ client: c.sdk, models: { classify: 'test-model' }, curriculumRetriever: { retrieve } });
    expect((await intel.classifyTopic('a novel question', nodes)).method).toBe('llm');
    const [params, opts] = (c.parse.mock.calls as unknown[][])[0] as [{ messages: { content: string }[] }, { timeout: number }];
    expect(params.messages[0].content).not.toContain('Search suggests');
    expect(opts.timeout).toBeLessThanOrEqual(kind === 'timeout' ? 2850 : 3000);
  });

  it('invalidates same-ID semantic edits and isolates baseline/experiment caches', async () => {
    const c = client();
    const baseline = createIntelligence({ client: c.sdk, models: { classify: 'test-model' } });
    const experimental = createIntelligence({ client: c.sdk, models: { classify: 'test-model' },
      curriculumRetriever: { retrieve: async () => [nodes[1].id] } });
    await baseline.classifyTopic('a novel question', nodes);
    await baseline.classifyTopic('a novel question', [...nodes].reverse());
    expect(c.parse).toHaveBeenCalledTimes(1);
    await experimental.classifyTopic('a novel question', nodes);
    expect(c.parse).toHaveBeenCalledTimes(2);
    await baseline.classifyTopic('a novel question', nodes.map((n, i) => i ? n : { ...n, mastery_criteria: 'New objective' }));
    expect(c.parse).toHaveBeenCalledTimes(3);
  });
});
