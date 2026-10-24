import { createHash } from 'node:crypto';
import type { SkillNode } from '@friction/shared';

/** Private, optional context only. Retrieval never decides mastery or classification. */
export interface CurriculumRetriever {
  retrieve(prompt: string, nodes: SkillNode[]): Promise<string[]>;
}

export function curriculumFingerprint(nodes: SkillNode[]): string {
  const rows = nodes.map((n) => ({
    tree: n.tree_id, id: n.id, name: n.concept_name,
    criteria: n.mastery_criteria, keywords: [...n.keywords].sort(),
  })).sort((a, b) => a.tree.localeCompare(b.tree) || a.id.localeCompare(b.id));
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

/** A timeout stops waiting, not the SDK operation. The adapter bounds outstanding queries. */
export async function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work.catch(() => fallback),
      new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
