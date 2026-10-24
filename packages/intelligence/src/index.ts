// OWNER: Agent B (Intelligence). See docs/agents/B-intelligence.md.
// Placeholder: returns the shared fakes so Agent A can import this package from day one.
// Replace with the real Claude-backed implementation; keep the same export.
import { fakeIntelligence, type Intelligence } from '@friction/shared';

export function createIntelligence(): Intelligence {
  return fakeIntelligence;
}
