/**
 * claude.ai: selectors + URL format. Shared DOM logic is in ./dom.ts. If claude.ai changes its markup,
 * this is the only file to touch (record findings in NOTES.md).
 */
import { makeAdapter } from './dom';

export const SELECTORS = {
  composer: ['div.ProseMirror[contenteditable="true"]', '[contenteditable="true"][role="textbox"]', 'fieldset [contenteditable="true"]'],
  send: ['button[aria-label*="Send" i]', 'fieldset button[type="submit"]'],
  assistant: ['[data-testid="assistant-message"]', '.font-claude-response', '.font-claude-message', '[data-is-streaming]'],
};

export const claude = makeAdapter({
  id: 'claude',
  app_source: 'claude_web',
  hosts: ['claude.ai'],
  selectors: SELECTORS,
  conversationIdFromPath(pathname) {
    const m = /\/chat\/([0-9a-fA-F-]{36})(?:[/?#]|$)/.exec(pathname);
    return m ? m[1] : null;
  },
});

// Named exports kept for existing callers and tests.
export const { findComposer, findSendButton, isInComposer, isOnSendButton, getComposerText, setComposerText, conversationIdFromPath, lastAssistantText } = claude;
