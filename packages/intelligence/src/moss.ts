import type { SkillNode } from '@friction/shared';
import { curriculumFingerprint, type CurriculumRetriever } from './retrieval';

type Document = { id: string; text: string; metadata: Record<string, string> };
export interface MossSession {
  addDocs(docs: Document[]): Promise<unknown>;
  query(text: string, options: { topK: number; alpha: number }): Promise<{ docs: { id: string }[] }>;
  close(): Promise<void>;
}

/** One resident curriculum, one preparation, and at most one outstanding native query. */
export class MossCurriculumRetriever implements CurriculumRetriever {
  private session?: MossSession;
  private fingerprint = '';
  private preparing?: Promise<boolean>;
  private querying = false;
  private queryDone?: Promise<void>;
  private closed = false;
  private closing?: Promise<void>;

  constructor(private readonly open: (name: string) => Promise<MossSession>, private readonly cleanup = async () => {}) {}

  /** Explicit prewarm only. API requests never create sessions or download models. */
  prepare(nodes: SkillNode[]): Promise<boolean> {
    if (this.closed || this.querying) return Promise.resolve(false);
    if (!nodes.length || new Set(nodes.map((n) => n.tree_id)).size !== 1 ||
        new Set(nodes.map((n) => n.id)).size !== nodes.length) return Promise.resolve(false);
    const fingerprint = curriculumFingerprint(nodes);
    if (this.preparing) return this.preparing.then((ready) => ready && this.fingerprint === fingerprint);
    if (this.session && this.fingerprint === fingerprint) return Promise.resolve(true);
    const docs = nodes.map((n) => ({
      id: n.id,
      text: `${n.concept_name}\n${n.mastery_criteria}\n${n.keywords.join(', ')}`,
      metadata: { treeId: n.tree_id, revision: fingerprint },
    }));
    this.preparing = this.build(fingerprint, docs).finally(() => { this.preparing = undefined; });
    return this.preparing;
  }

  private async build(fingerprint: string, docs: Document[]): Promise<boolean> {
    let next: MossSession | undefined;
    const old = this.session;
    this.session = undefined;
    this.fingerprint = '';
    try {
      await old?.close();
      next = await this.open(`friction-trial-${fingerprint.slice(0, 24)}`);
      await next.addDocs(docs);
      // Warm embedding/runtime separately from measured requests. No cloud index writes.
      await next.query('course learning objectives', { topK: 1, alpha: 0.6 });
      if (this.closed) return false;
      this.session = next;
      this.fingerprint = fingerprint;
      next = undefined;
      return true;
    } catch {
      // Never log SDK errors: providers may include credentials or document content.
      return false;
    } finally {
      await next?.close().catch(() => {});
    }
  }

  async retrieve(prompt: string, nodes: SkillNode[]): Promise<string[]> {
    const session = this.session;
    const fingerprint = curriculumFingerprint(nodes);
    if (this.closed || !session || this.preparing || this.querying || !prompt.trim() ||
        fingerprint !== this.fingerprint) return [];
    this.querying = true;
    let settled!: () => void;
    this.queryDone = new Promise<void>((resolve) => { settled = resolve; });
    try {
      const result = await session.query(prompt, { topK: 3, alpha: 0.6 });
      if (this.closed || this.session !== session || curriculumFingerprint(nodes) !== fingerprint) return [];
      const valid = new Set(nodes.map((n) => n.id));
      return [...new Set(result.docs.map((d) => d.id).filter((id) => valid.has(id)))].slice(0, 3);
    } catch {
      return [];
    } finally {
      this.querying = false;
      settled();
      this.queryDone = undefined;
    }
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    return (this.closing = this.dispose());
  }

  private async dispose(): Promise<void> {
    await this.preparing;
    // A response timeout cannot cancel a native operation. Do not free its handles early.
    await this.queryDone;
    await this.session?.close().catch(() => {});
    this.session = undefined;
    await this.cleanup().catch(() => {});
  }
}

/** Not called by normal API startup. Missing keys never import the optional native SDK. */
export function mossFromEnv(env: NodeJS.ProcessEnv = process.env): MossCurriculumRetriever | null {
  const projectId = env.MOSS_PROJECT_ID;
  const projectKey = env.MOSS_PROJECT_KEY;
  if (!projectId || !projectKey) return null;
  let client: import('@moss-js/moss').MossClient | undefined;
  return new MossCurriculumRetriever(async (name) => {
    if (!client) {
      const { MossClient } = await import('@moss-js/moss');
      client = new MossClient(projectId, projectKey);
    }
    return client.session(name);
  }, async () => { await client?.close(); });
}
