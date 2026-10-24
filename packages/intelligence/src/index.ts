// OWNER: Agent B (Intelligence). See docs/agents/B-intelligence.md.
import type { Intelligence } from '@friction/shared';
import { chat } from './chat';
import { classifyTopic } from './classify';
import { makeConfig, type IntelligenceOptions } from './config';
import { evaluateExchange } from './evaluate';
import { parseSyllabus } from './parse';
import { buildFrictionPrompt } from './templates';

export { buildFrictionPrompt } from './templates';
export { keywordClassify } from './classify';
export { validateTree } from './validate';
export type { IntelligenceOptions } from './config';

export function createIntelligence(opts: IntelligenceOptions = {}): Intelligence {
  const cfg = makeConfig(opts);
  return {
    parseSyllabus: (input) => parseSyllabus(cfg, input),
    classifyTopic: (prompt, nodes) => classifyTopic(cfg, prompt, nodes),
    buildFrictionPrompt,
    evaluateExchange: (input) => evaluateExchange(cfg, input),
    chat: (messages, o) => chat(cfg, messages, o),
  };
}
