/**
 * When may the extension request a prompt-scoped bypass (contract v4)?
 * Same rule as C's sandbox (apps/dashboard SandboxPage): health v4 alone does NOT certify the real
 * endpoint's rollout. Only the reference mock, or a real API whose exact 40-char API READY SHA the
 * human/E configured, gets `scope: 'prompt'`. Everything else gets the legacy payload (no scope field)
 * and the UI says the concept is paused until reset. No capability probe ever spends quota.
 */
import type { HealthResponse } from '@friction/shared';

export const READY_SHA_RE = /^[a-f0-9]{40}$/i;

export function promptBypassEnabled(health: Pick<HealthResponse, 'contract_version' | 'mode'> | null, readySha: string): boolean {
  if (!health || health.contract_version < 4) return false;
  return health.mode.server === 'mock' || READY_SHA_RE.test(readySha.trim());
}
