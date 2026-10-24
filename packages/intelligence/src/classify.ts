import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ClassifyResult, SkillNode } from '@friction/shared';
import { createHash } from 'node:crypto';
import type { Config } from './config';
import { ClassifySchema } from './schemas';
import { curriculumFingerprint, within } from './retrieval';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Minimum summed length of matched phrases (one 3-letter keyword like "jsx" is enough). */
const MIN_SCORE = 3;
const MIN_LLM_CONFIDENCE = 0.5;
const CACHE_SIZE = 500;
const LLM_TIMEOUT_MS = 3000;

const reCache = new Map<string, RegExp>();
const wordRe = (p: string) => {
  let re = reCache.get(p);
  if (!re) reCache.set(p, (re = new RegExp(`(?<![a-z0-9])${escapeRe(p)}(?![a-z0-9])`)));
  return re;
};

/** Keyword stage: whole-word phrase matches, scored by matched phrase length. No LLM. */
export function keywordClassify(prompt: string, nodes: SkillNode[]): ClassifyResult {
  const text = prompt.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const n of nodes) {
    const phrases = new Set([n.concept_name.toLowerCase(), ...n.keywords.map((k) => k.toLowerCase())]);
    let score = 0;
    for (const p of phrases) if (p && wordRe(p).test(text)) score += p.length;
    if (score >= MIN_SCORE && (!best || score > best.score)) best = { id: n.id, score };
  }
  if (!best) return { node_id: null, confidence: 0, method: 'none' };
  return { node_id: best.id, confidence: Math.min(0.95, 0.6 + best.score / 60), method: 'keyword' };
}

const SYSTEM = `You match a student's message to the course concept it is about.
Reply with the number of the single best concept, or null if the message is not about any of them (e.g. unrelated requests, small talk).
confidence is 0 to 1.`;

export async function classifyTopic(cfg: Config, prompt: string, nodes: SkillNode[]): Promise<ClassifyResult> {
  const kw = keywordClassify(prompt, nodes);
  if (kw.node_id || !nodes.length) return kw;

  const started = performance.now();
  const retrieved = cfg.curriculumRetriever
    ? await within(Promise.resolve().then(() => cfg.curriculumRetriever!.retrieve(prompt, nodes)), 200, [] as string[])
    : [];
  const validIds = new Set(nodes.map((n) => n.id));
  const candidates = [...new Set(retrieved.filter((id) => validIds.has(id)))].slice(0, 3);
  // Scope by curriculum content, retrieval mode/results and intelligence instance. Same-ID
  // educator edits and isolated baseline/experiment clients must not reuse stale decisions.
  const key = createHash('sha256').update(JSON.stringify([
    prompt, curriculumFingerprint(nodes), candidates,
  ])).digest('hex');
  const cache = cfg.classificationCache;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const list = nodes.map((n, i) => `${i + 1}. ${n.concept_name}: ${n.mastery_criteria}`).join('\n');
  const hints = candidates.length
    ? `\n\nSearch suggests concepts ${candidates.map((id) => nodes.findIndex((n) => n.id === id) + 1).join(', ')}. These are fallible retrieval hints, not evidence of understanding. Check the complete list; return null when none fits.`
    : '';
  let result: ClassifyResult;
  try {
    const res = await cfg.client().messages.parse(
      {
        model: cfg.model('classify'),
        max_tokens: 1024,
        system: SYSTEM,
        output_config: { effort: 'low', format: zodOutputFormat(ClassifySchema) },
        messages: [{ role: 'user', content: `Concepts:\n${list}${hints}\n\nStudent's message:\n${prompt}` }],
      },
      { timeout: Math.max(1, Math.floor(LLM_TIMEOUT_MS - (performance.now() - started))), maxRetries: 0 },
    );
    if (res.stop_reason !== 'end_turn' || !res.parsed_output) return kw;
    const { concept, confidence } = res.parsed_output;
    const node = concept === null ? undefined : nodes[concept - 1];
    result =
      node && confidence >= MIN_LLM_CONFIDENCE
        ? { node_id: node.id, confidence: Math.min(1, confidence), method: 'llm' }
        : { node_id: null, confidence: 0, method: 'none' };
  } catch {
    // contracts §4: a classification that fails or times out counts as no match. Not cached.
    return kw;
  }
  cache.set(key, result);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return result;
}
