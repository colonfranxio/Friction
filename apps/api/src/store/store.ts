import { buildSeed, type BypassEvent, type ChatLog, type SeedData } from '@friction/shared';

export interface DB extends SeedData {
  logs: ChatLog[];
  bypasses: BypassEvent[];
}

export function freshDb(): DB {
  return { ...buildSeed(), logs: [], bypasses: [] };
}

/**
 * Persistence boundary. Routes and services read `db` (always re-read it, `reset()` replaces
 * the object), mutate it in place, then call `save()`. A Supabase-backed store could implement
 * the same interface later.
 */
export interface Store {
  readonly db: DB;
  /** Schedule a write-through of the current state. Never throws. */
  save(): void;
  /** Replace everything with the seed (used by /demo/reset). */
  reset(): void;
  /** Resolves once pending writes have hit disk. */
  flush(): Promise<void>;
}
