// OWNER: Agent C. Fill in the makeAdapter spec below; do not edit other files (docs/multi-site/agents/C-gemini.md).
// STUB: empty composer selectors keep the extension off on Gemini until this is filled in.
import { makeAdapter } from './dom';

export const gemini = makeAdapter({
  id: 'gemini',
  app_source: 'gemini_web',
  hosts: ['gemini.google.com'],
  selectors: { composer: [], send: [], assistant: [] },
  conversationIdFromPath: () => null,
});
