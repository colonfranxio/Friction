/**
 * Frozen constants shared by every workstream.
 * Changes only at checkpoints, additive only. See docs/contracts.md.
 */
export const CONTRACT_VERSION = 3;

export const PORTS = { api: 8787, mock: 8788, dashboard: 5173 } as const;
/** 127.0.0.1, not localhost: on Windows, Node's fetch may resolve localhost to ::1 first and get refused. */
export const DEFAULT_API_URL = `http://127.0.0.1:${PORTS.api}`;

/** Delimiters around the hidden instruction block appended to a student's prompt. */
export const FRICTION_OPEN = '⟦friction⟧';
export const FRICTION_CLOSE = '⟦/friction⟧';

/** Server-side budget for the whole /intercept hot path. */
export const INTERCEPT_BUDGET_MS = 4000;
/** Extension gives up waiting for /intercept after this and sends the original prompt. */
export const EXTENSION_TIMEOUT_MS = 4500;
/** With no conversation id, a pending quiz counts for answers within this window. */
export const QUIZ_WINDOW_MS = 10 * 60 * 1000;
/** DEMO_MODE: a `correct` verdict at or above this confidence jumps the student to L4. */
export const DEMO_JUMP_MIN_CONFIDENCE = 0.7;
export const DEFAULT_BYPASS_QUOTA = 3;
/** DEMO_MODE: fake "parsing" delay so the UI animation is visible when the parse cache hits. */
export const DEMO_PARSE_DELAY_MS = 3000;

/** Response headers on POST /chat (sandbox). */
export const CHAT_HEADERS = {
  interceptId: 'X-Friction-Intercept-Id',
  nodeId: 'X-Friction-Node-Id',
  level: 'X-Friction-Level',
  /** Optional during rollout; exact boolean string for this turn, not inferred from level. */
  quizAttached: 'X-Friction-Quiz-Attached',
} as const;

/** Allowed SkillNode.icon keywords. B's parser must pick from this list; C maps each to an icon (fallback: circle). */
export const ICON_KEYWORDS = [
  'code', 'box', 'arrow-down', 'refresh', 'download', 'hook', 'share', 'zap', 'database', 'grid',
  'layers', 'lock', 'globe', 'cpu', 'terminal', 'book', 'puzzle', 'git-branch', 'server', 'shield',
  'chart', 'function', 'list', 'search', 'circle',
] as const;
export type IconKeyword = (typeof ICON_KEYWORDS)[number];

/** Display names per level (popup badge, sandbox chip, tooltips). */
export const LEVEL_LABELS = {
  1: { bloom: 'Remember / Understand', role: 'Socratic', friction: 'Max friction' },
  2: { bloom: 'Apply', role: 'Scaffolder', friction: 'Medium friction' },
  3: { bloom: 'Analyze / Evaluate', role: 'Challenger', friction: 'Reverse friction' },
  4: { bloom: 'Create', role: 'Normal', friction: 'No friction' },
} as const;
