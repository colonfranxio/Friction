import { SEED_IDS, type SkillNode } from '@friction/shared';
import type { CurriculumRetriever } from '@friction/intelligence';
import type { Store } from '../store/store';

export interface CurriculumIndex extends CurriculumRetriever {
  prepare(nodes: SkillNode[]): Promise<boolean>;
  close(): Promise<void>;
}
export interface RetrievalTrace {
  state: 'disabled' | 'warming' | 'ready' | 'retrieved' | 'fallback' | 'closed';
  reason?: 'flag' | 'credentials' | 'cold_or_stale' | 'unavailable' | 'timeout' | 'empty';
  revision?: string;
  candidates?: number;
  ms?: number;
}
interface Entry {
  index: CurriculumIndex;
  revision: string;
  failures: number;
  retryAt: number;
}
interface Options {
  store: Store;
  createIndex(): CurriculumIndex;
  fingerprint(nodes: SkillNode[]): string;
  trace(event: RetrievalTrace): void;
  refreshMs?: number;
  queryMs?: number;
  now?: () => number;
}

/** Backend-only pool. Closing/preparing handles still occupy one of its two slots. */
export class MossRuntime implements CurriculumRetriever {
  private readonly entries = new Map<string, Entry>();
  private wanted = new Map<string, SkillNode[]>();
  private timer?: ReturnType<typeof setInterval>;
  private work?: Promise<void>;
  private closing?: Promise<void>;
  private stopped = false;
  private readonly now: () => number;

  constructor(private readonly opts: Options) { this.now = opts.now ?? Date.now; }

  private emit(event: RetrievalTrace) {
    try { this.opts.trace(event); } catch { /* diagnostics must not break requests */ }
  }

  start(): void {
    if (this.stopped || this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => { void this.refresh(); }, this.opts.refreshMs ?? 1000);
    this.timer.unref();
  }

  /** Safe to call after mutations in tests; the production poll discovers new courses too. */
  refresh(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    const db = this.opts.store.db;
    const demo = db.users.find((u) => u.id === SEED_IDS.demoStudent);
    const trees = [...new Set([demo?.active_tree_id, ...db.users.map((u) => u.active_tree_id)].filter((id): id is string => !!id))].slice(0, 2);
    this.wanted = new Map();
    for (const tree of trees) {
      const nodes = db.nodes.filter((n) => n.tree_id === tree).map((n) => ({ ...n, keywords: [...n.keywords] }));
      if (nodes.length) this.wanted.set(tree, nodes);
    }
    // Always update wanted, including while an older revision is warming.
    if (this.work) return this.work;
    this.work = this.reconcile().catch(() => {
      this.emit({ state: 'fallback', reason: 'unavailable' });
    }).finally(() => { this.work = undefined; });
    return this.work;
  }

  private async reconcile(): Promise<void> {
    for (const [tree, entry] of this.entries) {
      if (this.stopped) return;
      if (!this.wanted.has(tree)) {
        // Retain the slot until disposal finishes, even if native work is stuck.
        await entry.index.close();
        this.entries.delete(tree);
      }
    }
    for (const [tree, nodes] of this.wanted) {
      if (this.stopped) return;
      let entry = this.entries.get(tree);
      if (!entry) {
        if (this.entries.size >= 2) continue;
        entry = { index: this.opts.createIndex(), revision: '', failures: 0, retryAt: 0 };
        this.entries.set(tree, entry);
      }
      const revision = this.opts.fingerprint(nodes);
      if (entry.revision === revision || this.now() < entry.retryAt) continue;
      const started = this.now();
      this.emit({ state: 'warming', revision: revision.slice(0, 12) });
      let ready = false;
      try { ready = await entry.index.prepare(nodes); } catch { /* safe fallback */ }
      if (this.stopped) return;
      const latest = this.wanted.get(tree);
      if (ready && latest && this.opts.fingerprint(latest) === revision) {
        entry.revision = revision;
        entry.failures = 0;
        entry.retryAt = 0;
        this.emit({ state: 'ready', revision: revision.slice(0, 12), ms: this.now() - started });
      } else {
        entry.revision = '';
        entry.failures++;
        entry.retryAt = this.now() + Math.min(30_000, 1000 * 2 ** Math.min(entry.failures - 1, 5));
        this.emit({ state: 'fallback', reason: ready ? 'cold_or_stale' : 'unavailable', revision: revision.slice(0, 12) });
      }
    }
  }

  async retrieve(prompt: string, nodes: SkillNode[]): Promise<string[]> {
    const started = this.now();
    const revision = this.opts.fingerprint(nodes);
    const tree = nodes[0]?.tree_id;
    const entry = tree ? this.entries.get(tree) : undefined;
    if (this.stopped || !entry || !this.wanted.has(tree!) || nodes.some((n) => n.tree_id !== tree) || entry.revision !== revision) {
      this.emit({ state: 'fallback', reason: 'cold_or_stale', revision: revision.slice(0, 12) });
      return [];
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => entry.index.retrieve(prompt, nodes)).then((ids) => ({ ids, reason: undefined }),
          () => ({ ids: [] as string[], reason: 'unavailable' as const })),
        new Promise<{ ids: string[]; reason: 'timeout' }>((resolve) => {
          timer = setTimeout(() => resolve({ ids: [], reason: 'timeout' }), this.opts.queryMs ?? 180);
        }),
      ]);
      const valid = new Set(nodes.map((n) => n.id));
      const ids = this.stopped || this.entries.get(tree!) !== entry || entry.revision !== revision
        ? [] : [...new Set(result.ids.filter((id) => valid.has(id)))].slice(0, 3);
      this.emit({ state: ids.length ? 'retrieved' : 'fallback', reason: ids.length ? undefined : result.reason ?? 'empty',
        revision: revision.slice(0, 12), candidates: ids.length, ms: this.now() - started });
      return ids;
    } finally { clearTimeout(timer); }
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.stopped = true;
    clearInterval(this.timer);
    return (this.closing = (async () => {
      await this.work;
      await Promise.allSettled([...this.entries.values()].map((e) => e.index.close()));
      this.entries.clear();
      this.emit({ state: 'closed' });
    })());
  }
}
