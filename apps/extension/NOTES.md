# claude.ai integration notes (Agent D)

**Approach (plan v5): message-box injection.** No network interception. On Enter/Send, the content script
holds the send, asks Friction for the injected prompt, rewrites the composer, then clicks Send. Any failure
or timeout (4.5s) sends the original text.

All site-specific code is in `src/site/claude.ts`. Selectors are tried in order; **confirmed** = seen working on the live page.

| What | Selectors (in order) | Confirmed? |
|---|---|---|
| Composer | `div.ProseMirror[contenteditable="true"]`, `[contenteditable="true"][role="textbox"]`, `fieldset [contenteditable="true"]` | ❌ pending live test |
| Send button | `button[aria-label*="Send" i]`, `fieldset button[type="submit"]` (fallback: synthetic Enter) | ❌ |
| Assistant messages | `[data-testid="assistant-message"]`, `.font-claude-response`, `.font-claude-message`, `[data-is-streaming]` | ❌ |
| Conversation id | UUID in `location.pathname` (`/chat/<uuid>`); `null` on a new chat | ❌ |
| Composer rewrite | synthetic paste → `execCommand('insertText')` → direct DOM write | ❌ |

## Live test (human, ~5 min)
1. `pnpm dev:mock:ext` (mock API on 8789; leave it running).
2. `pnpm build:ext`, then chrome://extensions → Developer mode → **Load unpacked** → `apps/extension/dist`.
3. Friction popup → Settings → API URL `http://127.0.0.1:8789` → Save.
4. Reload claude.ai, open a new chat, ask: **How do I stop my useEffect from running in an infinite loop?**
5. GO = Claude doesn't hand over code, asks you to explain, ends with a question; the badge says "L1 Socratic".

### If it doesn't work, paste this in the claude.ai DevTools console and send me the output
```js
({
  composer: ['div.ProseMirror[contenteditable="true"]','[contenteditable="true"][role="textbox"]','fieldset [contenteditable="true"]'].map(s=>[s,document.querySelectorAll(s).length]),
  send: ['button[aria-label*="Send" i]','fieldset button[type="submit"]'].map(s=>[s,document.querySelectorAll(s).length]),
  sendLabels: [...document.querySelectorAll('button[aria-label]')].map(b=>b.getAttribute('aria-label')).slice(0,30),
  assistant: ['[data-testid="assistant-message"]','.font-claude-response','.font-claude-message','[data-is-streaming]'].map(s=>[s,document.querySelectorAll(s).length]),
  path: location.pathname
})
```
After each rebuild: click the reload icon on the Friction card in chrome://extensions **and** reload the claude.ai tab.
