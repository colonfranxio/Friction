# Agent D: Extension (interception on claude.ai)

You are **Agent D**, one of four Claude Code agents building **Friction** in parallel for a hackathon. You own the riskiest and most important part: a Chrome MV3 extension that quietly rewrites a student's prompt on **claude.ai** just before it's sent, then captures the AI's reply. If interception fails, the demo falls back to a sandbox page, so **find out fast whether it works** and report it.

## 0. Read first (in this order)
1. `AGENTS.md`: ownership and working rules (binding).
2. `PLAN.md`: the whole plan; your row in §5 and §6; risks in §8.
3. `docs/contracts.md`: §4 (what `/intercept` returns), **§5 (prompt format)**, §7 (bypass), §11 (privacy: the consent toggle).
4. `docs/ui-layouts.md` §5 (popup) and §6 (on-page badge).
5. `packages/shared/src/*`: `createFrictionClient`, `InterceptRequest/Response`, `stripInjected`, `hasInjected`, `EXTENSION_TIMEOUT_MS`, `SEED_IDS`, `LEVEL_LABELS`, `DEFAULT_API_URL`.

## 1. Your mission
Build `apps/extension` so that on claude.ai:
1. When the student sends a message, the extension calls `POST /intercept` and replaces the outgoing prompt with `injected_prompt`.
2. It captures the full streamed reply and posts it to `POST /responses`.
3. It shows the current level in an on-page badge and a popup (with a bypass button).
4. It **never breaks claude.ai**: on any error or timeout, the original prompt goes through unchanged.

## 2. Ownership
- **You edit only:** `apps/extension/**` and `docs/status/D-extension.md`.
- **Never edit:** `packages/**`, other `apps/*`, `scripts/**`, `fixtures/**`, root config, other docs.
- **Branch:** `agent/extension`. Push only that branch.

## 3. What's already there
- `package.json` (deps: `@friction/shared`; dev: `esbuild`, `@types/chrome`; vitest at the root). Scripts: `build` (`node build.mjs`), `watch`, `typecheck`, `test`.
- `build.mjs`: bundles `src/{main-world,content,background,popup}.ts` as IIFEs into `dist/`. **Extend it** to copy `manifest.json`, `popup.html` (and icons) into `dist/`.
- `src/background.ts`: a placeholder.
- The human loads `apps/extension/dist` via chrome://extensions → Developer mode → Load unpacked, and reloads it after each build. Ask for this in your status file when you need a live test.

## 4. Target file layout (create these)
```
apps/extension/
  manifest.json            MV3 (spec below)
  popup.html               popup shell (styles inline; tokens from ui-layouts)
  NOTES.md                 what you learned about claude.ai: endpoint URL pattern, body field names, DOM selectors, date checked
  build.mjs                (extend) copy static files into dist/
  src/main-world.ts        MAIN world, document_start: wraps window.fetch
  src/content.ts           ISOLATED world: bridge ⇄ background, DOM reads, badge, hide-injected
  src/background.ts        service worker: settings, API calls, last-intercept state
  src/popup.ts             popup UI logic
  src/adapters/types.ts    SiteAdapter interface
  src/adapters/claude.ts   matchRequest(url, init) → {conversationId} | null; readPrompt(body); writePrompt(body, text); parseStream(text) → assistant text
  src/adapters/chatgpt.ts  (stretch, after CP3)
  src/lib/bridge.ts        postMessage request/response with nonce + timeout (EXTENSION_TIMEOUT_MS)
  src/lib/sse.ts           generic SSE text → events parser
  src/lib/storage.ts       chrome.storage.local typed settings {studentId, apiUrl, enabled}
  src/lib/badge.ts         shadow-DOM pill (ui-layouts §6)
  src/lib/hide-injected.ts MutationObserver that applies stripInjected to rendered user bubbles
  test/fixtures/claude/    recorded, SANITIZED request bodies + SSE responses
  test/adapter.claude.test.ts  sse.test.ts  bridge.test.ts
```

## 5. Network path (decided; this is why it's built this way)
1. **`main-world.ts`** runs in the page's own JS world (`"world": "MAIN"`, `"run_at": "document_start"`) so it can wrap `window.fetch` before claude.ai uses it. It **cannot** call our API: claude.ai's CSP and Chrome's localhost blocking prevent it.
2. For a matching send request (the claude adapter's `matchRequest`, e.g. `POST …/chat_conversations/{uuid}/completion`; confirm in NOTES.md), it reads the prompt from the JSON body and sends `{type:'friction:intercept', nonce, raw_prompt, conversation_id}` via `window.postMessage`.
3. **`content.ts`** (isolated world) validates the message (`event.source === window` + channel tag + nonce). It adds `previous_assistant_text` (the last assistant message's text from the DOM; selector in NOTES.md) and forwards the message with `chrome.runtime.sendMessage`.
4. **`background.ts`** (service worker) reads its settings. **If disabled, it answers passthrough without calling the API.** Otherwise it calls `client.intercept(...)` with `app_source:'claude_web'`, stores `{node_id, level, intercept_id, concept_name}` as the last intercept, and replies.
5. `main-world.ts` gets `injected_prompt`, rewrites the body (`writePrompt`), and calls the **original** fetch.
6. It returns the real `Response` to the page untouched, and reads a `response.clone()` stream to the end **in the background**. It parses it with `adapter.parseStream` and sends `{intercept_id, llm_response}` through the same bridge to `client.responses(...)`. Skip this when `intercept_id` is null.
7. **Fail open everywhere:** if any step throws, or the round trip takes longer than `EXTENSION_TIMEOUT_MS`, send the original request unchanged and set the badge to "Friction offline". Never `await` anything that could hang the page's fetch beyond the timeout.

`manifest.json` essentials:
```json
{
  "manifest_version": 3,
  "name": "Friction",
  "version": "0.1.0",
  "permissions": ["storage", "alarms"],
  "host_permissions": ["https://claude.ai/*", "http://localhost/*", "http://127.0.0.1/*"],
  "background": { "service_worker": "background.js" },
  "action": { "default_popup": "popup.html" },
  "content_scripts": [
    { "matches": ["https://claude.ai/*"], "js": ["main-world.js"], "world": "MAIN", "run_at": "document_start" },
    { "matches": ["https://claude.ai/*"], "js": ["content.js"], "run_at": "document_start" }
  ]
}
```
Settings defaults: `studentId = SEED_IDS.demoStudent`, `apiUrl = DEFAULT_API_URL` (8787; use `http://127.0.0.1:8789` while developing against **your own** mock: `pnpm dev:mock:ext`. Agent C uses the mock on 8788, and its smoke runs reset that mock's state), `enabled = true`.
For concept names (badge/popup), the background fetches `client.getStudent(id)` → `client.getTree(tree_id)` once and caches `node_id → concept_name`. Refresh it when the intercept returns an unknown `node_id`.

## 6. First hour: capture real traffic (blocks everything else)
You need the real request and response shapes. **Don't rely on memory**; claude.ai changes often.
- **If you have Claude in Chrome tools** (`mcp__claude-in-chrome__*`): use the user's logged-in Chrome. Open claude.ai in a new tab. With `javascript_tool`, install a temporary logging wrapper on `window.fetch` that saves the URL, method and body of each POST, plus the full text of `response.clone()`, into `window.__frictionCapture`. Send a short test message ("say hi in 3 words"), then a follow-up in the same chat, and read `window.__frictionCapture` back. Also record the DOM selector of the last assistant message and of the user message bubbles.
- **Otherwise:** ask the human in your status file under Blockers. They should copy, from DevTools → Network, the `completion` request (Copy → Copy as fetch) and its response body, for a first message and a follow-up.
- **Sanitize before committing:** strip cookies, auth headers, org/user identifiers (replace them with fake UUIDs), and anything personal. Save the files to `test/fixtures/claude/`. Write the findings to `NOTES.md` with today's date.

## 7. Tasks and exit criteria

### CP1 (target T+3h): interception proven
- [ ] Fixtures captured and sanitized; `NOTES.md` written
- [ ] `adapters/claude.ts` + `lib/sse.ts` unit tests pass against the fixtures (match the URL, extract `conversation_id`, read/write the prompt, parse the streamed text)
- [ ] Bridge with nonce + timeout, unit tested
- [ ] **Live test (human loads the extension, API = your mock on 8789):** a claude.ai prompt about useEffect reaches Claude with the friction block (verify the reply is Socratic or ends with a question), and the mock received `/responses`. **Report GO / NO-GO in your status file.**
- [ ] If NO-GO: implement the fallback, which writes the injected text into the composer before submit (`execCommand('insertText')` on the ProseMirror editor). Report which approach works.

### CP2 (target T+8h)
- [ ] Popup per ui-layouts §5: online status (`/health`), consent toggle, current concept + level chip, **Use a bypass (N left)** → `client.bypass` (409 shows "No bypasses left"), settings (student ID, API URL)
- [ ] On-page badge per ui-layouts §6 (active / no friction / offline)
- [ ] Works end to end against the **real API on 8787**

### CP3 (target T+14h)
- [ ] `hide-injected.ts`: the friction block never shows in rendered user bubbles, including after a reload
- [ ] Robust to: a brand-new chat (conversation id only exists in the completion URL), several claude.ai tabs, the service worker going to sleep (MV3; keep state in `chrome.storage`), the API being down (offline badge, prompt unchanged)
- [ ] Full demo on claude.ai 3× in a row with the human

### CP4 (target T+20h)
- [ ] Heartbeat every 60s via `chrome.alarms` → `client.heartbeat({student_id, extension_version, enabled})`
- [ ] Stretch: `adapters/chatgpt.ts` (capture fixtures the same way first)

## 8. How to verify
```
pnpm --filter @friction/extension test
pnpm build:ext                 # → apps/extension/dist (human: Load unpacked / reload)
pnpm dev:mock:ext              # your own mock on 8789 for live testing (popup API URL: http://127.0.0.1:8789)
pnpm typecheck
```

Windows: identical steps. Load unpacked from `apps\extension\dist`. `build.mjs` must use `node:path`/`node:fs` (no shell `cp`), so the build works in PowerShell.

## 9. Interfaces with the other agents
- You depend only on the HTTP API (A) via the shared client. The mock behaves exactly like the real API.
- You never parse or build friction prompts yourself. Use `injected_prompt` verbatim and `stripInjected` for display.
- New data needs → change request in your status file.
