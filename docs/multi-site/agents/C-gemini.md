# Agent C: Gemini adapter (multi-site)

You are **Agent C**. Make the Friction extension work on **gemini.google.com** by filling in one adapter file. Never break claude.ai or the other sites. This is the riskiest site: Gemini's composer is a Quill editor inside a custom element, and it may ignore synthetic paste.

## 0. Read first
1. `docs/multi-site/PLAN.md` §2 (the contract: `SiteAdapter`, `makeAdapter`, the fixture format) and §3 (ownership).
2. `apps/extension/src/site/claude.ts` (the reference adapter), `apps/extension/NOTES.md` and `apps/extension/test/site.claude.test.ts` (the test style).

## 1. Ownership
**Only:**
- the `makeAdapter({...})` spec inside `apps/extension/src/site/gemini.ts`;
- `test/site.gemini.test.ts`;
- `test/fixtures/sites/gemini.html`;
- `NOTES-gemini.md`;
- `docs/status/C-dashboard.md`.

Branch `ms/gemini` from `origin/feature/multi-site` after CP0. Found a bug elsewhere? File a **Change request → B** in your status file. Don't edit it.

## 2. Work

### C1. Live reconnaissance (T+0, before CP0 lands, no code)
Have the human run this in gemini.google.com's DevTools console, on a **new chat** and in an **existing chat**:
```js
({
  composer: ['rich-textarea .ql-editor[contenteditable="true"]','.ql-editor[contenteditable="true"]','[contenteditable="true"][role="textbox"]'].map(s=>[s,document.querySelectorAll(s).length]),
  send: ['button[aria-label*="Send" i]','button.send-button','.send-button-container button'].map(s=>[s,document.querySelectorAll(s).length]),
  sendLabels: [...document.querySelectorAll('button[aria-label]')].map(b=>b.getAttribute('aria-label')).slice(0,30),
  assistant: ['model-response message-content','model-response','.model-response-text'].map(s=>[s,document.querySelectorAll(s).length]),
  composerTag: document.querySelector('.ql-editor')?.outerHTML.slice(0,200),
  path: location.pathname
})
```
Then have them test, in the same console with text typed in the box:
```js
const el=document.querySelector('.ql-editor'); el.focus(); document.getSelection().selectAllChildren(el);
const dt=new DataTransfer(); dt.setData('text/plain','probe one\nprobe two');
el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));
setTimeout(()=>console.log(JSON.stringify(el.innerText), document.querySelector('button[aria-label*="Send" i]')?.disabled),50);
```
Record whether the paste worked and whether Send became enabled. Report the path before and after the first message (expected `/app` → `/app/<hex>`; record the id length).

Write `test/fixtures/sites/gemini.html` per PLAN §2.4, with `data-new-chat-path="/app"` and `data-chat-path="/app/<hex>"`.

### C2. Adapter (CP1, T+0:45 to T+3h)
- [ ] Write the failing test `test/site.gemini.test.ts`, loading the fixture:
  - `conversationIdFromPath('/app/<hex>')` returns the hex; `('/app')`, `('/')` and `('/gem/x')` return `null`
  - `siteFor('gemini.google.com') === gemini`
  - `findComposer` and `findSendButton` are non-null on the fixture
  - `lastAssistantText` returns the `Quick check: …` message, returns `null` once it contains `⟦friction⟧`, and returns `null` on a page with no `model-response`
  - `setComposerText(doc, composer, 'line one\n\nline three')` resolves `true` and the old text is gone
- [ ] Fill in the spec in `gemini.ts`, with the regex `/\/app\/([0-9a-f]{12,})(?:[/?#]|$)/` adjusted to the length you observed. If the C1 paste probe failed, pass a `setComposerText` override to `makeAdapter`: write one `<p>` per line, dispatch `input`, then verify. Keep it in your file.
- [ ] Own tests + A's contract suite green. Typecheck, `pnpm build:ext`.
- [ ] Human live try on gemini.google.com with `pnpm dev:mock:ext` (PLAN §6, steps 1–3). Record the findings in `NOTES-gemini.md`.
- [ ] Checker → push `ms/gemini` → "CP1 pushed".

### C3. CP2 (T+3h to T+5h)
Fix only your file from the live check results A records. If Gemini still fails at T+5h, say so; B turns it back into a stub and the other sites ship.
