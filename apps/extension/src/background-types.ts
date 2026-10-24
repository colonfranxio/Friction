import type { InterceptOutcome } from './lib/messages';

/** Reply from the service worker to content.ts for 'friction:intercept'. */
export interface InterceptRuntimeResult {
  outcome: InterceptOutcome;
  concept_name: string | null;
}
