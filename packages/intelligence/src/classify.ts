import type { ClassifyResult, SkillNode } from '@friction/shared';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Minimum summed length of matched phrases (one 3-letter keyword like "jsx" is enough). */
const MIN_SCORE = 3;

/** Keyword stage: whole-word phrase matches, scored by matched phrase length. No LLM. */
export function keywordClassify(prompt: string, nodes: SkillNode[]): ClassifyResult {
  const text = prompt.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const n of nodes) {
    const phrases = new Set([n.concept_name.toLowerCase(), ...n.keywords.map((k) => k.toLowerCase())]);
    let score = 0;
    for (const p of phrases) {
      if (p && new RegExp(`(?<![a-z0-9])${escapeRe(p)}(?![a-z0-9])`).test(text)) score += p.length;
    }
    if (score >= MIN_SCORE && (!best || score > best.score)) best = { id: n.id, score };
  }
  if (!best) return { node_id: null, confidence: 0, method: 'none' };
  return { node_id: best.id, confidence: Math.min(0.95, 0.6 + best.score / 60), method: 'keyword' };
}
