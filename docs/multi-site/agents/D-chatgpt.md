# Agent D: ChatGPT adapter (multi-site)

You are **Agent D**. You built the claude.ai integration; now make the same extension work on **chatgpt.com** by filling in one adapter file. Never break claude.ai or the other sites.

## 0. Read first
1. `docs/multi-site/PLAN.md` §2 (the contract: `SiteAdapter`, `makeAdapter`, the fixture format) and §3 (ownership).
2. `apps/extension/src/site/claude.ts` (the reference adapter) and `apps/extension/NOTES.md` (how you found claude.ai's selectors).

## 1. Ownership
**Only:**
- the `makeAdapter({...})` spec inside `apps/extension/src/site/chatgpt.ts`;
- `test/site.chatgpt.test.ts`;
- `test/fixtures/sites/chatgpt.html`;
- `NOTES-chatgpt.md`;
- `docs/status/D-extension.md`.

Branch `ms/chatgpt` from `origin/feature/multi-site` after CP0. Found a bug elsewhere? File a **Change request → B** in your status file. Don't edit it.

## 2. Work

### D1. Live reconnaissance (T+0, before CP0 lands, no code)
Have the human run this in chatgpt.com's DevTools console, once on a **new chat** and once in an **existing chat**, and paste the output back to you:
```js
({
  composer: ['#prompt-textarea','div.ProseMirror[contenteditable="true"]','[contenteditable="true"][role="textbox"]'].map(s=>[s,document.querySelectorAll(s).length]),
  send: ['button[data-testid="send-button"]','#composer-submit-button','button[aria-label*="Send" i]'].map(s=>[s,document.querySelectorAll(s).length]),
  sendLabels: [...document.querySelectorAll('button[aria-label],button[data-testid]')].map(b=>b.getAttribute('aria-label')||b.dataset.testid).slice(0,30),
  assistant: ['[data-message-author-role="assistant"]','[data-message-author-role="assistant"] .markdown'].map(s=>[s,document.querySelectorAll(s).length]),
  composerTag: document.querySelector('#prompt-textarea')?.outerHTML.slice(0,200),
  path: location.pathname
})
```
Also ask the human to send one message in a new chat and report the path before and after (expected `/` → `/c/<uuid>`; project chats are `/g/<id>/c/<uuid>`).

Write `test/fixtures/sites/chatgpt.html` per PLAN §2.4: the real tag structure, placeholder text, `data-new-chat-path="/"`, `data-chat-path="/c/<a uuid>"`.

### D2. Adapter (CP1, T+0:45 to T+3h)
- [ ] Write the failing test `test/site.chatgpt.test.ts`, loading the fixture:
  - `conversationIdFromPath('/c/<uuid>')` and `('/g/g-p-abc/c/<uuid>')` return the uuid; `('/')`, `('/gpts')` and `('/c/')` return `null`
  - `siteFor('chatgpt.com') === chatgpt` and `siteFor('chat.openai.com') === chatgpt`
  - `findComposer` and `findSendButton` are non-null on the fixture
  - `lastAssistantText` returns the `Quick check: …` message, and returns `null` once that message contains `⟦friction⟧`
  - `setComposerText(doc, composer, 'line one\n\nline three')` resolves `true` and the old text is gone
- [ ] Fill in the spec in `chatgpt.ts`: the confirmed selectors first and the other candidates as fallbacks, with the regex `/\/c\/([0-9a-fA-F-]{36})(?:[/?#]|$)/`. If ChatGPT's editor rejects the shared paste/insertText strategies live, pass your own `setComposerText` to `makeAdapter`.
- [ ] Own tests + A's contract suite (`pnpm --filter @friction/extension test site.`) green. Typecheck, `pnpm build:ext`.
- [ ] Human live try on chatgpt.com with `pnpm dev:mock:ext` (§6 of PLAN, steps 1–3). Record the confirmed selectors in `NOTES-chatgpt.md`, including the probe and what to check if ChatGPT changes its page.
- [ ] Checker → push `ms/chatgpt` → "CP1 pushed".

### D3. CP2 (T+3h to T+5h)
Fix only your file from the live check results A records. Push again. If ChatGPT still fails at T+5h, say so; B turns it back into a stub and the other sites ship.
