import { fakeIntelligence, type Intelligence } from '@friction/shared';

/** USE_REAL_INTELLIGENCE=1 → Agent B's createIntelligence(); otherwise the shared deterministic fakes. */
export async function loadIntelligence(useReal: boolean): Promise<Intelligence> {
  if (!useReal) return fakeIntelligence;
  const { createIntelligence } = await import('@friction/intelligence');
  return createIntelligence();
}
