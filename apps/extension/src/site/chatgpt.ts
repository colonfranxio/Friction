// OWNER: Agent D. Fill in the makeAdapter spec below; do not edit other files (docs/multi-site/agents/D-chatgpt.md).
// STUB: empty composer selectors keep the extension off on ChatGPT until this is filled in.
import { makeAdapter } from './dom';

export const chatgpt = makeAdapter({
  id: 'chatgpt',
  app_source: 'chatgpt_web',
  hosts: ['chatgpt.com', 'chat.openai.com'],
  selectors: { composer: [], send: [], assistant: [] },
  conversationIdFromPath: () => null,
});
