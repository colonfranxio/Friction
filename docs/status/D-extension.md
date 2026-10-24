# Status: Agent D (extension, bonus surface)

**Owned by Agent D. Only this agent edits this file.**

- Contract version confirmed: **2** (read docs/contracts-CHANGELOG.md: v2 only adds an optional grading AbortSignal between A and B; no impact on the extension). My CP2 work is already on main via E's CP1 merge.
- Current checkpoint: **CP2** (CP1 closed: GO on live claude.ai)
- Last updated: 2026-10-24

## CP1 exit criteria
- [x] Simplified extension (message-box injection, no network interception) builds: `dist/` = content.js, background.js, popup.js, manifest.json, popup.html. One isolated content script, `storage` permission only.
- [x] Unit tests pass (34 at CP1; 35 now incl. 9 in-process integration tests): send interception on Enter and on the Send click; passthrough; fail-open on a thrown error, on a timeout, and when the composer can't be rewritten (original restored); Shift+Enter and Enter outside the composer ignored; no double send while in flight; empty composer; Enter fallback without a send button; composer rewrite in happy-dom; conversation id; last assistant text.
- [x] Background tests against the real mock (in-process HTTP) pass: status, L1 intercept, correct answer graded via `previous_assistant_text` → L4, passthrough, bypass + paused, concept kept after off-topic, consent off (zero fetches), offline fail-open.
- [x] **Human live try → GO.** On real claude.ai with the mock (8789), the useEffect question got a Socratic L1 reply: no code, asked the student to explain, one hint about the dependency array, ended with a check question. So the composer rewrite + send work on the live page.
- (moved to CP2) Full loop on claude.ai: answer → L4, new chat → full answer, badge text, block hidden in the user bubble.

## CP2 exit criteria
- [x] Popup: online status, consent toggle, concept + level chip, **Use a bypass (N left)** with the 409 message, settings (built in CP1; covered by the background tests for status/bypass/consent).
- [x] Badge: active level / no friction / offline / paused, plus **"Friction updated · reload this tab"** when the extension was reloaded and the open tab's content script is orphaned (previously shown as "offline").
- [x] Injected block hidden in rendered messages (`hide-injected.ts`, unit tested; never touches the composer).
- [ ] **Works against the real API on 8787.** BLOCKED on Agent A (no `agent/platform` branch on origin yet). Ready as one command: `pnpm --filter @friction/extension test:api` (runs the 9 service-worker integration tests against `http://127.0.0.1:8787`, after a demo reset). Verified working against a live mock on 8789.
- [ ] Human, ~3 min: on claude.ai, answer the check question (→ L4), then ask again in a new chat (→ full answer); report the badge text and whether your sent message shows the `⟦friction⟧` block. This also confirms the assistant-message selector (used as quiz text for grading).

## CP2 verification (independent agent, Sonnet 5.5, fresh clone)
Verdict: **CP2 PASS for everything Agent D controls**; the remaining items are legitimately blocked (Agent A's API; the human check). `test:api` confirmed against a live mock, including the clear error when DEMO_MODE is off. Fixed from its findings: popup bypass button disabled while in flight (no double bypass); popup shows "Offline" instead of hanging when the service worker is unavailable; `test:api` says "is the API running?" when it can't connect.

## CP1 verification (independent agent, Sonnet 5.5, fresh clone of the pushed branch)
Verdict: **CP1 code-complete PASS**. Ownership is clean, `src/lib` is tracked, typecheck/test/build pass in a fresh clone, no leftover network interception, consent-off makes zero API calls, Windows-safe. The live try is legitimately human-only.
Fixed from its findings:
- **M1:** pressing Enter while Claude is streaming (Stop button, send ignored) left the friction block in the composer. Now: after sending, confirm the composer emptied (≤600ms); if not, restore the original text (badge stays "ready").
- Text that already contains a friction block is never re-intercepted (no double injection).
- Wait up to 300ms for the Send button to be enabled after the rewrite (React lag), instead of a fixed 30ms.
- The badge shows the concept name on the first message (waits ≤400ms for the name map).
- Console logs which composer-rewrite strategy worked (paste / insertText / dom), to help the live test.
- Added tests: streaming/ignored send → original restored and nothing sent; already-injected text passes through untouched.

## Removed (per plan v5)
Page-level fetch patch, postMessage bridge, SSE parser, network fixtures, `/responses` calls.

## Lead-level fix made along the way (on main, commit 688d316)
The root `.gitignore` (a Python template) ignored every `lib/` folder, so `apps/*/src/lib/` would never be committed. That hit A, C and me. The Python patterns are now anchored to the repo root. My earlier pushes were missing `src/lib/*`; this push includes them.

## CP2 integration followups (from E's CP2 report) and session handover
- [x] Contract **v3** confirmed: only adds the optional `X-Friction-Quiz-Attached` header on sandbox `/chat`; no extension impact.
- [x] `handleBypass` refuses when consent is off (`{ok:false, code:'disabled'}`) with zero fetches, covering queued/programmatic messages too. Regression test added.
- Handover: a second Agent D session briefly worked in this worktree (commits 6137ea1 per-prompt bypass + badge Bypass button, a1e5731 strip pasted friction blocks, f6c75db per-chat conversation ids). Those were reviewed and kept by the current Agent D session. Its edit to E-owned `packages/shared` (682c085, fake grader treats a re-asked question as `not_an_answer`, human-approved) was **moved to branch `proposal/e-fake-grader`** for E to review/cherry-pick, and reverted here so this branch only touches D-owned paths.

## Change requests (contract)
1. **Per-prompt bypass (human/product decision, 2026-10-24).** A bypass should skip friction for **that one prompt only**, still use one quota and still notify the educator (with the concept). Today §7 sets `paused = true`, so every later intercept on the node returns L4 until `/demo/reset`.
   - Ask (A + E, additive): `POST /bypass` stops setting `paused` (or takes an optional `scope: 'prompt' | 'concept'`, default `'prompt'`). Keep: quota −1, 409 at 0, close the pending quiz, `BypassEvent`, `bypass` SSE event with `student_name` + `concept_name`.
   - Extension side is done: the badge's **Bypass** button (and the popup's **Bypass this message**) calls `/bypass` for the node of the last friction-ed message, then re-sends that exact prompt unmodified (no `/intercept` call). If the page doesn't take the re-send, the text stays in the composer and the next Send goes out unmodified once.
   - Until the API changes, the concept also stays paused server-side (later prompts on it get L4). Sandbox (C) should switch its bypass button to the same per-prompt behavior.

2. **Re-asking the question counts as a correct answer (found in live testing, 2026-10-24).** In the same chat, sending the original question again is graded as the answer to the check question. `fakeEvaluate` (packages/shared, E) marks any message containing one of the node's keywords as `correct`, and the question itself contains them ("useEffect", "infinite loop"), so in DEMO_MODE the student jumps L1 → L4. Repro: two `/intercept` calls with the same `raw_prompt` and a `previous_assistant_text` → 2nd returns `level: 4, graded.verdict: correct`.
   - **⚠ E, please review and merge: I edited a file you own (approved by the human, 2026-10-24).** `packages/shared/src/fakes.ts`: `fakeEvaluate` now returns `not_an_answer` when the student's message is a new question (starts with how/what/why/when/where/which/who/can/could/should/would/do/does/will **and** ends with `?`). "Is it the dependency array?" still counts as an answer. New test: `packages/shared/test/fake-grader.test.ts`. No type or contract change; full `pnpm typecheck` + `pnpm test` pass (shared 22, intelligence 22, api 47, dashboard 3, extension 51). It's in its own commit on `agent/extension` ("E-owned: fake grader…") so you can cherry-pick or revert it on its own.
   - Ask (B): the real grader prompt treats a repeated or re-phrased question as `not_an_answer`, never `correct`; add it to the harness.
   - Not fixable in the extension: the server grades whenever a quiz is pending.

3. **FYI (fixed in the extension, no change needed):** a new claude.ai chat has no uuid until the first message, so the extension used to send `conversation_id: null`. Under §4.1 that grades against the latest open quiz from *any* chat (10-min window), so the same question in a second new chat counted as an answer → L4. The extension now gives each new chat its own id at its first send and aliases the uuid claude.ai assigns afterwards (`src/lib/conversation.ts`). Other clients that send null still hit §4.1.

## Dependency changes
- `happy-dom` (dev, extension only).

## Blockers / needs from the human
1. Agent A's API (`agent/platform`), then run `pnpm --filter @friction/extension test:api`.
2. Human, ~3 min on claude.ai: answer the check question (→ L4), new chat same question (→ full answer); report the badge text and whether the sent message shows the block.

## How to run and verify my part
```
pnpm --filter @friction/extension test        # 35 tests
pnpm --filter @friction/extension test:api    # integration tests vs a running API (default :8787)
pnpm --filter @friction/extension typecheck
pnpm build:ext                                # → apps/extension/dist
pnpm dev:mock:ext                             # mock API on 8789
```
