# Agent D: Extension (claude.ai bonus surface)

**Read first: [DEMO-READINESS-TASKS](../DEMO-READINESS-TASKS.md).** Execute your named assignment there; it supersedes stale ownership, branch, demo-order and dependency instructions below. Report your READY handoff with a pushed SHA and evidence.

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

## work left to do

### Moss sponsor-track handoff

Read [the detailed execution plan](../moss-implementation-handoff.md). Moss requires no new extension integration or credentials in the browser. Continue your separate learning-map branch and consent/chat safety work. A later combined demo must target the same backend as C's dashboard; no feature branches are automatically merged together.


Current shared handoff: [CONTRACT READY v4](../checkpoints/CONTRACT-READY-v4.md). Follow its owner checklist; shared readiness does not mean the real API is API READY.

This section updates the remaining-work assignment after CP2. Own only `apps/extension/**` and your status file on `agent/extension`. Your newer hardening at `56a5183` is pushed but not integrated. Review and preserve completed fixes rather than rebuilding them. The extension remains a bonus surface; it must not block the main sandbox demo.

### Start now, in parallel

- Merge current `main`, confirm the v4 handoff and keep the consent guard/no-fetch regression, per-chat conversation IDs, pasted-marker cleaning, draft protection, correct-chat bypass targeting and expiry/navigation cleanup passing. A's cancellation fix and real quiz header are already merged.
- Verify new chat before a site UUID exists, UUID aliasing, navigation, multiple tabs, sleeping/reloaded service worker, offline/timeout and ignored Send behavior. Consent off must prevent every API action, including queued/programmatic bypass messages. Never overwrite a new draft or spend quota when a bypass cannot safely target/send the intended prompt.
- Keep your branch restricted to D-owned paths. The fake-grader proposal belongs on `proposal/e-fake-grader` for E's review; do not reintroduce shared-code edits or independently tune B's grader.
- Document the one-prompt bypass work as awaiting API alignment. Current `/bypass` still pauses the concept until reset; your client-side one-shot resend does not change that server behavior. Do not claim one-prompt semantics end-to-end yet.

### Dependencies and order

1. Consent, chat isolation, composer safety and robustness tests proceed alongside A/B/C/E immediately. Use your private mock, not C's.
2. **Wait for E's `CONTRACT READY` handoff** specifying bypass scope and compatibility. Do not assume the API default changed or invent shared request fields. Merge the published contract and adapt your owned client code/tests against E's updated mock.
3. Wait for A's `API READY` handoff before asserting real endpoint compatibility. Run `test:api` in a coordinated window; it resets the target backend. Push `D READY` with SHA, tests and a clear list of pending live-site checks. E integrates B → A → C → D and independently verifies the checkpoint.
4. With the human, reload the final extension/tab and run the full live claude.ai flow three times: L1, answer to L4, new chat, bypass, badge and hidden block, including multi-tab/offline recovery. If the site remains NO-GO, cut the bonus beat and keep the sandbox demo; do not silently mark it passed.

### Parallel safety and exit criteria

- Use your own existing isolated environment/checkout. Never switch branches or install dependencies in another agent's working directory; no new worktrees unless explicitly requested.
- Your private mock is 8789 (`pnpm dev:mock:ext`); C owns mock 8788. Use injected/in-process tests where possible. Only use shared API 8787 after its owner grants a test window; never reset it during someone else's demo or stop another agent's process.
- Add dependencies only in your package; E reconciles combined lockfiles. Do not publish `main`, shared files or another agent's status.
- Deliver extension tests/typecheck/build, API integration against the intended mode and human GO/NO-GO evidence. Distinguish simulated tests, fake-backed API checks and actual claude.ai/real-model results. Refresh stale status blockers that A's merged implementation already resolved.

## Requested addition: learning map beside claude.ai (human request, 2026-10-24)

**Latest ownership handoff:** full learning-map development, including required integration/safety fixes, is B's job on `feature/learning-map`. Stop feature edits and send findings to B. This supersedes any older instruction below to implement the embed/panel or fix its delivery blockers yourself. Coordinate shared-file changes before editing B's feature paths. E retains combined review/integration on `claude-skill-tree`, D-source then B-feature, with main isolated.


> **REASSIGNED to B (human decision, 2026-10-24).** B now owns this whole feature on branch `feature/learning-map` (see B's brief, "Reassigned: learning-map panel"). D's side-panel shell already on `agent/extension` (`src/lib/learning-map.ts`, `src/sidepanel.ts`, `sidepanel.html`, popup button, Dashboard URL setting, `test/learning-map.test.ts`) is accepted as the base and ships with D's normal merge. **D: make no further panel changes.** Report any panel bugs to B through your status file; follow-up edits to those panel files come from B.

This reassignment supersedes the branch instruction and C/D execution split below. E integrates the existing D shell/hardening into `claude-skill-tree` before B's `feature/learning-map`. D retains non-panel extension ownership; coordinate shared popup/storage edits with B. No feature merge to main is authorized by this reassignment.

**Why:** in a real test the human found that, on claude.ai, students can't see their skill tree, so they don't know which concept to steer the conversation toward next. The badge shows the level for one turn, not the map. Show the student's live map in Chrome's built-in side panel next to claude.ai. Don't draw anything inside claude.ai's page; that stays as fragile-free as today.

**Priority:** bonus feature, after must-haves, acceptance gates and your existing hardening (PLAN.md rule). E schedules it. **No contract change.** It depends on C's `/student/:id?embed=1` (see C's brief, same heading); until that lands, frame the full `/student/:id` page.

**D's task: Chrome side panel**
- **Manifest:**
  - add the `"sidePanel"` permission and `"side_panel": { "default_path": "sidepanel.html" }`;
  - `build.mjs` copies/builds `sidepanel.html` (plus a small `src/sidepanel.ts` if needed).
- **Opening:** add an **Open learning map** button in the popup that calls `chrome.sidePanel.open({ windowId })`. It needs the click as a user gesture. Keep the popup as the toolbar action.
- **Panel content:** a full-size iframe to `${dashboardUrl}/student/${studentId}?embed=1`.
  - `studentId` comes from existing storage.
  - Add a **Dashboard URL** setting next to API URL in popup Settings. Default to `http://127.0.0.1:5173` per the repository's cross-platform rule. Keep it editable: the human reported that `http://localhost:5173` worked where 127.0.0.1 was refused, so document that override and use the address the dashboard actually binds to; do not assume Vite binds identically on every machine. Keep the API URL separate.
  - React to storage changes (student or URL) by reloading the iframe.
  - Confirm the dashboard's independently configured `VITE_API_URL` points to the same intended API/store as the extension's API URL. The panel's Dashboard URL does not configure the dashboard's backend; mismatched 8788/8789 servers will not share live mastery. Arrange a private integration window with C/E before any resetting checks.
- **Consent:** if `Settings.enabled` (the consent toggle) is false, the panel shows "Friction is off" and loads nothing, with no request to the dashboard.
- Revoking consent while the panel is open must remove the iframe and stop its ongoing dashboard/API/SSE work. Cancel pending readiness checks and ignore stale storage/load callbacks so they cannot reload it. Do not prefetch the dashboard while disabled.
- Validate the configured Dashboard URL as HTTP(S), and construct the route with URL APIs and an encoded student ID. Keep existing host access; do not add broad host permissions for configurable URLs. Explain an unsupported origin rather than silently requesting extra access. Do not put prompts, tokens or API keys in the iframe URL.
- **Unreachable dashboard:** show a short message with a Retry button rather than a broken frame. Use bounded readiness diagnostics; cross-origin iframe `onerror`/`onload` alone cannot reliably distinguish an unreachable page or a live page with its API down. Agree any UI-only readiness/error signal with C and validate message origin/source. Keep C's in-frame API error/retry state usable. Do not loosen unrelated site security headers.
- Preserve Chrome's user gesture when opening: resolve/cache the target window before the click where needed, then call `chrome.sidePanel.open` directly from the button handler. Handle unsupported Chrome versions or denied opens with a visible explanation; do not replace the toolbar popup action.
- **Verify:**
  - unit tests for the URL built from storage, the consent-off no-load path and the storage-change reload;
  - consent revoked while open, invalid URL, stale load/ready callbacks, unreachable dashboard, API-down frame and open failure;
  - the manifest keeps its current permissions plus `sidePanel` only;
  - extension build and typecheck pass;
  - **human check:** open the panel on claude.ai, answer a check question, and the node turns green live in the panel.

**Execution order and parallel safety (E review):** accepted backlog scope; existing hardening and acceptance gates retain priority. Once E schedules it, build D's shell/settings/tests in parallel with C's embed page in separate existing checkouts, using D's private mock 8789 and the separately configured C dashboard. Until C publishes **EMBED READY** with SHA and iframe/error behavior, a full Student view is development scaffolding, not final compact-panel acceptance. Merge C's ready implementation through E before final D integration; keep all D changes within `apps/extension/**` and D's status file. E verifies the combined feature, then the human checks live Chrome. No new A/B endpoint or shared contract is required.


## Concept-card integration handoff

Merge the published main into your branch before further work, then read [CONCEPT-CARDS](../design/CONCEPT-CARDS.md), [design.md](../../design.md), [UI layouts §2/§5/§6](../ui-layouts.md) and the concept-card integration report. Preserve centered prerequisite cards, vertical scrolling/frontier navigation, no drag/module rename, gold/violet/slate/teal styling, narrow-screen fitting below 0.5 when needed, and the integrated B safety fixes. C must not restore deleted PillarHeader or CanvasActions.move/rename; D must preserve card icons, ticket counts, Copy question and the new consent/composer guards when merging. Extension-first demo: teacher tree creation, then student/extension views.
