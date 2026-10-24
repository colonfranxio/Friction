/**
 * Pure rules everyone must agree on. A, B, C and the mock all import these
 * instead of re-implementing them.
 */
import { DEMO_JUMP_MIN_CONFIDENCE, FRICTION_CLOSE, FRICTION_OPEN } from './constants';
import type { BloomLevel, Edge, NodeStatus, SkillNode, UUID, Verdict } from './types';

export function clampLevel(n: number): BloomLevel {
  return Math.max(1, Math.min(4, Math.round(n))) as BloomLevel;
}

export function isMastered(level: BloomLevel, required: BloomLevel): boolean {
  return level >= required;
}

/**
 * Progression rules (docs/contracts.md "Progression"):
 * - correct: +1, or straight to L4 in demo mode when confidence >= DEMO_JUMP_MIN_CONFIDENCE
 * - lazy at L3+: -1
 * - everything else: unchanged
 * Paused nodes must not be passed here (callers skip grading for them).
 */
export function computeNextLevel(args: {
  current: BloomLevel;
  verdict: Verdict;
  confidence: number;
  demoMode: boolean;
}): BloomLevel {
  const { current, verdict, confidence, demoMode } = args;
  if (verdict === 'correct') {
    if (demoMode && confidence >= DEMO_JUMP_MIN_CONFIDENCE) return 4;
    return clampLevel(current + 1);
  }
  if (verdict === 'lazy' && current >= 3) return clampLevel(current - 1);
  return current;
}

/**
 * Locked: any prerequisite is not mastered. Mastered: level >= required. Active: otherwise.
 * `levels` maps node id -> the student's level (missing = 1).
 */
export function computeNodeStatuses(
  nodes: SkillNode[],
  edges: Edge[],
  levels: Record<UUID, BloomLevel>,
): Record<UUID, NodeStatus> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const lvl = (id: UUID): BloomLevel => levels[id] ?? 1;
  const mastered = (id: UUID) => {
    const n = byId.get(id);
    return n ? isMastered(lvl(id), n.required_blooms_level) : true;
  };
  const out: Record<UUID, NodeStatus> = {};
  for (const n of nodes) {
    const parents = edges.filter((e) => e.child_node_id === n.id).map((e) => e.parent_node_id);
    if (parents.some((p) => !mastered(p))) out[n.id] = 'locked';
    else if (mastered(n.id)) out[n.id] = 'mastered';
    else out[n.id] = 'active';
  }
  return out;
}

/** True if adding parent -> child would create a cycle (or is a self-loop). */
export function wouldCreateCycle(edges: Edge[], parent: UUID, child: UUID): boolean {
  if (parent === child) return true;
  const stack = [child];
  const seen = new Set<UUID>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === parent) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const e of edges) if (e.parent_node_id === cur) stack.push(e.child_node_id);
  }
  return false;
}

/** Longest-prerequisite-chain depth per node (roots = 0). Used for the pillar layout. */
export function computeDepths(nodes: SkillNode[], edges: Edge[]): Record<UUID, number> {
  const memo: Record<UUID, number> = {};
  const visiting = new Set<UUID>();
  const depth = (id: UUID): number => {
    if (memo[id] !== undefined) return memo[id];
    if (visiting.has(id)) return 0; // defensive: cycles should never exist
    visiting.add(id);
    const parents = edges.filter((e) => e.child_node_id === id).map((e) => e.parent_node_id);
    const d = parents.length ? 1 + Math.max(...parents.map(depth)) : 0;
    visiting.delete(id);
    return (memo[id] = d);
  };
  for (const n of nodes) depth(n.id);
  return memo;
}

/** Appends the hidden instruction block. The block body must contain a line "Level: N". */
export function wrapInjected(raw: string, body: string): string {
  return `${raw}\n\n${FRICTION_OPEN}\n${body.trim()}\n${FRICTION_CLOSE}`;
}

/** Removes any friction block (used to hide it in rendered chat bubbles and in tests). */
export function stripInjected(text: string): string {
  const open = escapeRe(FRICTION_OPEN);
  const close = escapeRe(FRICTION_CLOSE);
  return text.replace(new RegExp(`\\s*${open}[\\s\\S]*?${close}`, 'g'), '').trimEnd();
}

export function hasInjected(text: string): boolean {
  return text.includes(FRICTION_OPEN) && text.includes(FRICTION_CLOSE);
}

/** Reads the "Level: N" line from an injected block, or null. */
export function readInjectedLevel(text: string): BloomLevel | null {
  const m = /⟦friction⟧[\s\S]*?Level:\s*([1-4])/.exec(text);
  return m ? (Number(m[1]) as BloomLevel) : null;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
