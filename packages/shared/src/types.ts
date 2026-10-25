/** Domain types. DB rows and API payloads are snake_case and match these exactly. */

export type UUID = string;
export type ISODate = string;

/** PRD friction levels. Bloom mapping: 1 = Remember+Understand, 2 = Apply, 3 = Analyze+Evaluate, 4 = Create. */
export type BloomLevel = 1 | 2 | 3 | 4;
export type AppSource = 'claude_web' | 'chatgpt_web' | 'gemini_web' | 'sandbox';
export type Role = 'educator' | 'student';
export type NodeStatus = 'locked' | 'active' | 'mastered';
export type NodeSize = 'major' | 'minor';
export type Verdict = 'correct' | 'partial' | 'incorrect' | 'not_an_answer' | 'lazy';

export interface Position {
  x: number;
  y: number;
}

export interface User {
  id: UUID;
  name: string;
  role: Role;
  bypass_quota: number;
  active_tree_id: UUID | null;
  last_seen_at: ISODate | null;
}

export interface Tree {
  id: UUID;
  educator_id: UUID;
  title: string;
  source_ref: string | null;
  created_at: ISODate;
}

export interface Pillar {
  id: UUID;
  tree_id: UUID;
  name: string;
  order: number;
}

export interface SkillNode {
  id: UUID;
  tree_id: UUID;
  pillar_id: UUID;
  concept_name: string;
  mastery_criteria: string;
  required_blooms_level: BloomLevel;
  size: NodeSize;
  /** Icon keyword, e.g. "code", "refresh", "database". Dashboard maps it to an icon. */
  icon: string;
  /** Lowercase phrases used by keyword classification. */
  keywords: string[];
  /** null = dashboard auto-layouts it. */
  position: Position | null;
}

export interface Edge {
  tree_id: UUID;
  parent_node_id: UUID;
  child_node_id: UUID;
}

export interface StudentNodeState {
  student_id: UUID;
  node_id: UUID;
  current_blooms_level: BloomLevel;
  /** true after a bypass: level frozen, intercepts return L4. */
  paused: boolean;
  updated_at: ISODate;
}

export interface ChatLog {
  id: UUID;
  student_id: UUID;
  node_id: UUID;
  conversation_id: string | null;
  app_source: AppSource;
  level: BloomLevel;
  raw_prompt: string;
  injected_prompt: string;
  llm_response: string | null;
  /** true while this turn's quiz is waiting for an answer. */
  quiz_pending: boolean;
  /** Filled in when the student's NEXT message is graded as the answer to this turn's quiz. */
  verdict: Verdict | null;
  confidence: number | null;
  rationale: string | null;
  created_at: ISODate;
}

export interface BypassEvent {
  id: UUID;
  student_id: UUID;
  node_id: UUID;
  remaining_quota: number;
  created_at: ISODate;
}

export interface EvaluationResult {
  verdict: Verdict;
  /** 0..1 */
  confidence: number;
  /** Level after applying the progression rules (rules.ts computeNextLevel). */
  new_level: BloomLevel;
  rationale: string;
}
