import { DEMO_PARSE_DELAY_MS, INTERCEPT_BUDGET_MS, PORTS } from '@friction/shared';

export interface Config {
  allowedOrigins?: string[];
  port: number;
  /** DEMO_MODE: cache for the demo syllabus, /demo/reset, `*` CORS, correct → L4 jump. */
  demo: boolean;
  useRealIntelligence: boolean;
  interceptBudgetMs: number;
  parseDelayMs: number;
  parseTimeoutMs: number;
  /** Max wait for the first token of /chat before answering 504. */
  chatFirstChunkTimeoutMs: number;
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) ? n : fallback;
}

/** `DEMO_MODE` defaults to on (matches the mock); `0`/`false` turns it off. */
function flag(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === '') return fallback;
  return !['0', 'false', 'off', 'no'].includes(v.toLowerCase());
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    port: num(env.API_PORT ?? env.PORT, PORTS.api),
    demo: flag(env.DEMO_MODE, true),
    useRealIntelligence: flag(env.USE_REAL_INTELLIGENCE, false),
    interceptBudgetMs: num(env.INTERCEPT_BUDGET_MS, INTERCEPT_BUDGET_MS),
    parseDelayMs: num(env.DEMO_PARSE_DELAY_MS, DEMO_PARSE_DELAY_MS),
    parseTimeoutMs: 90_000,
    chatFirstChunkTimeoutMs: 30_000,
  };
}
