/**
 * The interface between A (Platform) and B (Intelligence).
 * B implements it with real Claude calls in packages/intelligence.
 * fakes.ts implements it deterministically, so A can build before B lands.
 * Implementations are pure: no database, no HTTP server, no global state except caches.
 */
import type { BloomLevel, EvaluationResult, NodeSize, SkillNode, UUID, Verdict } from './types';

export type SyllabusInput =
  | { kind: 'pdf'; base64: string; filename?: string }
  | { kind: 'text'; text: string };

export interface ParsedNode {
  /** Local key, unique within this parse (e.g. "n1"). A maps keys to UUIDs. */
  key: string;
  /** Must equal one of ParsedTree.pillars. */
  pillar: string;
  concept_name: string;
  mastery_criteria: string;
  required_blooms_level: BloomLevel;
  size: NodeSize;
  icon: string;
  keywords: string[];
  /** Keys of prerequisite nodes. No cycles, no dangling keys. */
  depends_on: string[];
}

export interface ParsedTree {
  title: string;
  /** Pillar names in display order (3-5). */
  pillars: string[];
  /** 6-15 nodes. */
  nodes: ParsedNode[];
}

export interface ClassifyResult {
  node_id: UUID | null;
  confidence: number;
  method: 'keyword' | 'llm' | 'none';
}

export interface FrictionPromptInput {
  raw_prompt: string;
  level: BloomLevel;
  node: SkillNode;
  /** Ask the AI to end its reply with one natural check-for-understanding question. */
  includeQuiz: boolean;
  /** Present on the turn right after a quiz answer was graded, so the AI can react to it. */
  feedback?: { verdict: Verdict } | null;
}

export interface EvaluateInput {
  /** Explicit operation cancellation; do not abort merely because an intercept's response budget elapsed. */
  signal?: AbortSignal;
  node: SkillNode;
  level: BloomLevel;
  /** The assistant reply that contained the quiz. null if it was never captured. */
  quiz_text: string | null;
  /** The student's message being graded as the answer. */
  student_message: string;
  demoMode: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Intelligence {
  parseSyllabus(input: SyllabusInput): Promise<ParsedTree>;
  classifyTopic(prompt: string, nodes: SkillNode[]): Promise<ClassifyResult>;
  /**
   * Returns the FULL replacement prompt: raw_prompt, then (unless level 4 with no feedback)
   * a block wrapped with wrapInjected() from rules.ts. Synchronous, no LLM call.
   */
  buildFrictionPrompt(input: FrictionPromptInput): string;
  evaluateExchange(input: EvaluateInput): Promise<EvaluationResult>;
  /** Streams assistant text for the sandbox chat. Last user message is already injected. */
  chat(messages: ChatMessage[], opts?: { signal?: AbortSignal }): AsyncIterable<string>;
}
