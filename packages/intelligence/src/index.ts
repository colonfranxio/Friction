// OWNER: Agent B (Intelligence). See docs/agents/B-intelligence.md.
import { fakeIntelligence, type Intelligence } from '@friction/shared';
import { keywordClassify } from './classify';
import { makeConfig, type IntelligenceOptions } from './config';
import { evaluateExchange } from './evaluate';
import { buildFrictionPrompt } from './templates';

export { buildFrictionPrompt } from './templates';
export { keywordClassify } from './classify';
export type { EvaluateArgs } from './evaluate';
export type { IntelligenceOptions } from './config';

export function createIntelligence(opts: IntelligenceOptions = {}): Intelligence {
  const cfg = makeConfig(opts);
  return {
    // ponytail: parse + chat still use the shared fakes; real versions land at CP2.
    parseSyllabus: fakeIntelligence.parseSyllabus,
    // ponytail: keyword stage only; LLM fallback + cache land at CP2.
    classifyTopic: async (prompt, nodes) => keywordClassify(prompt, nodes),
    buildFrictionPrompt,
    evaluateExchange: (input) => evaluateExchange(cfg, input),
    chat: fakeIntelligence.chat,
  };
}
