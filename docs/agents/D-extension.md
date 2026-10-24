# Agent D: Extension (claude.ai bonus surface)

You are **Agent D**, one of four Claude Code agents building **Friction** for a hackathon. The main demo runs on our own sandbox chat (Agent C). **Your job is the bonus:** show the same friction on real claude.ai with a Chrome extension. Keep it simple, and never break claude.ai.

## 0. Read first
1. `AGENTS.md` (rules) and `PLAN.md` (the v5 simplified plan; your column in §5).
2. `docs/contracts.md` §4–5 (what `/intercept` returns and the prompt format) and §11 (consent).
3. `docs/ui-layouts.md` §5 (popup) and §6 (badge).
4. `packages/shared/src`: `createFrictionClient`, `InterceptResponse`, `stripInjected`, `EXTENSION_TIMEOUT_MS`, `SEED_IDS`, `LEVEL_LABELS`, `DEFAULT_API_URL`.

## 1. Ownership
You edit **only** `apps/extension/**` and `docs/status/D-extension.md`, on branch `agent/extension`. Push only that branch.

## 2. The approach (decided: message-box injection, no network interception)
We do **not** reverse-engineer claude.ai's network API. Everything happens in **one isolated content script** plus the service worker:

1. **Catch the send.** In the content script, listen in the **capture phase** for `keydown` Enter (without Shift and not during IME composition) in the composer, and for `click` on the send button. If the extension is disabled or the text is empty, do nothing.
2. **Hold it.** `preventDefault()` + `stopImmediatePropagation()`. Read the composer text. Read `previous_assistant_text`, the last assistant message's text from the page.
3. **Ask the API** through the service worker (`chrome.runtime.sendMessage`): `client.intercept({student_id, raw_prompt, app_source:'claude_web', conversation_id, previous_assistant_text})`. The conversation id is the UUID in `location.pathname` (`/chat/<uuid>`), or `null` on a brand-new chat.
4. **Rewrite and send.** If `injected_prompt !== raw_prompt`, replace the composer's content with `injected_prompt`: focus it, select all, then `document.execCommand('insertText', false, text)` (works with ProseMirror). Then re-trigger the send: click the send button, falling back to dispatching Enter. Set a one-shot flag so your own re-dispatched event isn't intercepted again.
5. **Fail open:** on any error, or after `EXTENSION_TIMEOUT_MS`, send the **original** text unchanged and set the badge to "Friction offline". Never leave the user unable to send.
6. **Hide the block:** a `MutationObserver` applies `stripInjected`-style removal of `⟦friction⟧…⟦/friction⟧` to rendered messages. It must never touch the composer.
7. **No reply capture.** Grading uses `previous_assistant_text` on the next turn. `POST /responses` is not needed.

Selectors (composer, send button, assistant messages) go in **one file** (`src/site/claude.ts`) with fallbacks, and are documented in `NOTES.md`. Find them by **testing against the live page with the human** (CP1). Expected starting points:
- composer: `div.ProseMirror[contenteditable="true"]`, `[contenteditable="true"][role="textbox"]`;
- send: `button[aria-label*="Send" i]`;
- assistant messages: `[data-testid="assistant-message"]`, `.font-claude-response`, `[data-is-streaming]`.

**Existing work on `agent/extension`:** an earlier version patched `window.fetch` through a page-level (MAIN-world) script. **Remove** `main-world.ts`, `lib/bridge.ts`, `lib/intercept-fetch.ts`, the MAIN-world manifest entry, and their tests. **Keep and reuse** `background.ts`, `popup.*`, `lib/storage.ts`, `lib/badge.ts`, `lib/hide-injected.ts`, `lib/messages.ts` (trim it) and their tests.

## 3. Files (target)
```
apps/extension/
  manifest.json          MV3: one isolated content script on https://claude.ai/* (document_idle), service worker, popup;
                         permissions ["storage"]; host_permissions claude.ai + http://localhost/* + http://127.0.0.1/*
  build.mjs              esbuild entries: content, background, popup; copies manifest + popup.html (node:path only)
  popup.html  NOTES.md
  src/content.ts         send interception, composer rewrite, badge, hide-injected
  src/site/claude.ts     all claude.ai selectors + getComposerText/setComposerText/clickSend/lastAssistantText/conversationId
  src/background.ts      settings, API calls (intercept, status, bypass), concept-name cache
  src/popup.ts           status, consent toggle, concept + level chip, bypass button, settings
  src/lib/ storage.ts badge.ts hide-injected.ts messages.ts send-guard.ts (pure: decide intercept / rewrite / fail-open)
  test/*.test.ts         happy-dom tests: send-guard logic, composer rewrite, hide-injected, badge, background vs the mock
```

## 4. Checkpoints

### CP1 (T+3h): GO / NO-GO
- [ ] Simplified extension builds (`pnpm build:ext`); unit tests pass (send-guard decisions, fail-open on timeout/error, rewrite with a fake ProseMirror-like contenteditable in happy-dom, re-dispatch doesn't loop)
- [ ] Background tests against the mock still pass (status, intercept, bypass, consent off, offline)
- [ ] **Human try:**
  1. Run `pnpm dev:mock:ext`.
  2. Load `apps/extension/dist`.
  3. Popup API URL = `http://127.0.0.1:8789`.
  4. Ask "How do I stop my useEffect from running in an infinite loop?"

  The reply is Socratic and ends with a question ⇒ **GO**. Record the working selectors in `NOTES.md`. If it's NO-GO after about an hour of selector fixes, stop and report; the demo doesn't depend on you.

### CP2 (T+9h)
- [ ] Popup: online status, consent toggle, concept + level chip, **Use a bypass (N left)** (409 → "No bypasses left"), settings
- [ ] Badge: active level / no friction / offline / paused
- [ ] The injected block is hidden in sent messages (including after a reload)
- [ ] Works against the real API on 8787

### CP3 (T+16h)
- [ ] New chat (no conversation id yet), several tabs, service worker asleep, API down: all handled; the full demo flow works on claude.ai 3× with the human

## 5. Verify
```
pnpm --filter @friction/extension test
pnpm --filter @friction/extension typecheck
pnpm build:ext            # human reloads the extension + the claude.ai tab after each build
pnpm dev:mock:ext         # your own mock on 8789 (C uses 8788)
```
Windows works the same (load `apps\extension\dist`).
