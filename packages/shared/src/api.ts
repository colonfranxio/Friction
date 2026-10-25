/**
 * HTTP contract between the API (A, port 8787; mock on 8788) and its clients
 * (dashboard C, extension D, smoke test). Every body is JSON unless noted.
 * Errors: non-2xx with body ApiErrorBody.
 */
import type { ChatMessage, SyllabusInput } from './intelligence';
import type {
  AppSource,
  BloomLevel,
  BypassEvent,
  Edge,
  ISODate,
  NodeSize,
  Pillar,
  Position,
  SkillNode,
  StudentNodeState,
  Tree,
  User,
  UUID,
  Verdict,
} from './types';

/** Method + path for every endpoint. `:param` segments are path params. */
export const ENDPOINTS = {
  health: 'GET /health',
  parseTree: 'POST /trees/parse',
  getTree: 'GET /trees/:treeId',
  createNode: 'POST /trees/:treeId/nodes',
  updateNode: 'PATCH /nodes/:nodeId',
  deleteNode: 'DELETE /nodes/:nodeId',
  createEdge: 'POST /edges',
  deleteEdge: 'DELETE /edges/:parentId/:childId',
  renamePillar: 'PATCH /pillars/:pillarId',
  treeStudents: 'GET /trees/:treeId/students',
  treeActivity: 'GET /trees/:treeId/activity',
  getStudent: 'GET /students/:studentId',
  intercept: 'POST /intercept',
  responses: 'POST /responses',
  bypass: 'POST /bypass',
  chat: 'POST /chat',
  heartbeat: 'POST /heartbeat',
  demoReset: 'POST /demo/reset',
  events: 'GET /events?tree_id=:treeId',
} as const;

export type ErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'quota_exhausted'
  | 'cycle'
  | 'llm_timeout'
  | 'llm_error'
  | 'demo_only'
  | 'internal';

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string };
}

// ---------- health ----------
export interface HealthResponse {
  ok: true;
  contract_version: number;
  mode: { intelligence: 'fake' | 'real'; demo: boolean; server: 'api' | 'mock' };
}

// ---------- trees ----------
/** PDF as base64 (no data: prefix) or plain text. */
export type ParseTreeRequest = SyllabusInput & { title?: string };
export interface ParseTreeResponse {
  tree_id: UUID;
  /** true when DEMO_MODE served the cached demo tree. */
  cached: boolean;
}

export interface TreeBundle {
  tree: Tree;
  pillars: Pillar[];
  nodes: SkillNode[];
  edges: Edge[];
}

export interface CreateNodeRequest {
  pillar_id: UUID;
  concept_name: string;
  mastery_criteria: string;
  required_blooms_level: BloomLevel;
  size: NodeSize;
  icon: string;
  keywords?: string[];
  position?: Position | null;
}
export type UpdateNodeRequest = Partial<Omit<SkillNode, 'id' | 'tree_id'>>;

export interface CreateEdgeRequest {
  parent_node_id: UUID;
  child_node_id: UUID;
}

export interface RenamePillarRequest {
  name: string;
}

export interface StudentSummary {
  user: User;
  states: StudentNodeState[];
}
export interface TreeStudentsResponse {
  students: StudentSummary[];
}

/** Educator-safe activity: no raw prompts or AI replies (privacy rule). */
export interface ActivityItem {
  id: UUID;
  kind: 'intercept' | 'graded' | 'bypass';
  student_id: UUID;
  student_name: string;
  node_id: UUID;
  concept_name: string;
  level: BloomLevel;
  verdict: Verdict | null;
  confidence: number | null;
  rationale: string | null;
  created_at: ISODate;
}
export interface TreeActivityResponse {
  items: ActivityItem[];
}

// ---------- students ----------
export interface StudentStateResponse {
  user: User;
  tree_id: UUID | null;
  states: StudentNodeState[];
}

// ---------- intercept (hot path) ----------
export interface InterceptRequest {
  student_id: UUID;
  raw_prompt: string;
  app_source: AppSource;
  /** From the site's completion URL. null if unknown. */
  conversation_id: string | null;
  /** Last assistant message text read from the page DOM. Fallback quiz source. */
  previous_assistant_text?: string | null;
}
export interface InterceptResponse {
  /** null when no node matched (then injected_prompt === raw_prompt and nothing is logged). */
  intercept_id: UUID | null;
  node_id: UUID | null;
  level: BloomLevel | null;
  /** Verbatim replacement for the whole prompt. */
  injected_prompt: string;
  quiz_attached: boolean;
  /** Set when this message was graded as a quiz answer within the budget. */
  graded: { verdict: Verdict; confidence: number; new_level: BloomLevel } | null;
}

export interface ResponsesRequest {
  intercept_id: UUID;
  llm_response: string;
}
export interface AcceptedResponse {
  ok: true;
}

// ---------- bypass ----------
export interface BypassRequest {
  student_id: UUID;
  node_id: UUID;
  /** Omitted/"concept": legacy pause until reset. "prompt": quota/event only; client resends one prompt without intercepting. */
  scope?: 'concept' | 'prompt';
  /** With prompt scope, supply both to obtain a one-use sandbox chat token bound to this exact resend. */
  raw_prompt?: string;
  conversation_id?: string;
}
export interface BypassResponse {
  remaining_quota: number;
  /** Issued only for prompt scope with an exact prompt/conversation binding. Expires in two minutes. */
  prompt_bypass_token?: string;
}

// ---------- sandbox chat ----------
/** Response is a text/plain stream of assistant text. See CHAT_HEADERS for metadata headers. */
export interface ChatRequest {
  student_id: UUID;
  /** Optional one-use authorization from prompt-scoped /bypass; never a global bypass flag. */
  prompt_bypass_token?: string;
  /** Stable per sandbox chat session (client generates a uuid). */
  conversation_id: string;
  /** Full history; last message must be role "user" (raw, not injected). */
  messages: ChatMessage[];
}

// ---------- heartbeat / demo ----------
export interface HeartbeatRequest {
  student_id: UUID;
  extension_version: string;
  enabled: boolean;
}

export interface DemoResetRequest {
  /** Reset this student: seed states restored, active uploaded-course states L1/unpaused. Omit with full=true to reset everything. */
  student_id?: UUID;
  /** Rebuild the whole store from the seed (drops parsed trees and logs). */
  full?: boolean;
}

// ---------- realtime (SSE on GET /events?tree_id=...) ----------
/** Each SSE message: `event: <type>` + `data: <JSON of data>`. Payloads are snake_case rows. */
export type ServerEvent =
  | { type: 'student_state'; data: StudentNodeState }
  | { type: 'bypass'; data: BypassEvent & { student_name: string; concept_name: string } }
  | { type: 'activity'; data: ActivityItem }
  | { type: 'tree_updated'; data: { tree_id: UUID } }
  | { type: 'student_seen'; data: { student_id: UUID; last_seen_at: ISODate; enabled: boolean } };

export type ServerEventType = ServerEvent['type'];
