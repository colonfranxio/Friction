# Status: Agent D (extension, bonus surface)

**Owned by Agent D. Only this agent edits this file.**

- Contract version confirmed: **2** (read docs/contracts-CHANGELOG.md: v2 only adds an optional grading AbortSignal between A and B; no impact on the extension). My CP2 work is already on main via E's CP1 merge.
- Current checkpoint: **D READY** (old-server gate resolved, see below). CP1/CP2 done; CP3 hardening done.
- Last updated: 2026-10-24

## Concept-card restyle (2026-10-24, at the human's direct request)
- Commits on `agent/extension`: `b3a2365` and the icon follow-up. Spec and handoff are in `docs/design/CONCEPT-CARDS.md` on branch `design/concept-cards`.
- **Restyled:**
  - Popup: the current concept is a card (learning, no friction, bypassed, or face-down) and the bypass is a teal ticket with a ×N stub.
  - claude.ai pill: the ◆ and dot are replaced by a card glyph (`badgeMark()`), and Bypass is a small teal ticket.
  - The side panel's messages.
- **New:** a toolbar icon (gold card, `icons/` 16/32/48/128px) in the manifest `icons` and `action.default_icon`; `build.mjs` copies it.
- **Unchanged:** all behaviour, gates and wording.
- **Verified:**
  - typecheck and 82 tests pass
  - loaded unpacked in Chrome for Testing: the service worker starts, the popup is "Online" against the real API, the icons are served, and the pill mounts on claude.ai
- **Not verified:** a live claude.ai conversation behind login.

## CP1 exit criteria
- [x] Simplified extension (message-box injection, no network interception) builds: `dist/` = content.js, background.js, popup.js, manifest.json, popup.html. One isolated content script, `storage` permission only.
- [x] Unit tests pass (34 at CP1; 82 now, incl. the in-process integration tests): send interception on Enter and on the Send click; passthrough; fail-open on a thrown error, on a timeout, and when the composer can't be rewritten (original restored); Shift+Enter and Enter outside the composer ignored; no double send while in flight; empty composer; Enter fallback without a send button; composer rewrite in happy-dom; conversation id; last assistant text.
- [x] Background tests against the real mock (in-process HTTP) pass: status, L1 intercept, correct answer graded via `previous_assistant_text` → L4, passthrough, bypass + paused, concept kept after off-topic, consent off (zero fetches), offline fail-open.
- [x] **Human live try → GO.** On real claude.ai with the mock (8789), the useEffect question got a Socratic L1 reply: no code, asked the student to explain, one hint about the dependency array, ended with a check question. So the composer rewrite + send work on the live page.
- (moved to CP2) Full loop on claude.ai: answer → L4, new chat → full answer, badge text, block hidden in the user bubble.

## CP2 exit criteria
- [x] Popup: online status, consent toggle, concept + level chip, **Use a bypass (N left)** with the 409 message, settings (built in CP1; covered by the background tests for status/bypass/consent).
- [x] Badge: active level / no friction / offline / paused, plus **"Friction updated · reload this tab"** when the extension was reloaded and the open tab's content script is orphaned (previously shown as "offline").
- [x] Injected block hidden in rendered messages (`hide-injected.ts`, unit tested; never touches the composer).
- [x] **Works against the real API on 8787 (fake intelligence).** E ran `test:api` against A's merged API at CP2: 9/9. Real-Claude run still pending an API key (see CP2.md). Ready as one command: `pnpm --filter @friction/extension test:api` (runs the 9 service-worker integration tests against `http://127.0.0.1:8787`, after a demo reset). Verified working against a live mock on 8789.
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
- [x] Fixes from the CP2-followup verification (fresh clone, PASS): the bypass target is dropped when you switch chats (it could charge the wrong concept and send an old prompt into another chat); a bypass is refused **before** spending quota if you have a different draft in the box or a send is in flight; the "send unmodified once" fallback expires after 2 minutes and on navigation; `cleanPrompt` repeats until stable so nested fragments can't rebuild a marker. Tests added.
- Handover: a second Agent D session briefly worked in this worktree (commits 6137ea1 per-prompt bypass + badge Bypass button, a1e5731 strip pasted friction blocks, f6c75db per-chat conversation ids). Those were reviewed and kept by the current Agent D session. Its edit to E-owned `packages/shared` (682c085, fake grader treats a re-asked question as `not_an_answer`, human-approved) was **moved to branch `proposal/e-fake-grader`** for E to review/cherry-pick, and reverted here so this branch only touches D-owned paths.

## Learning map side panel (brief "Requested addition") — built 2026-10-24 at the human's direct request
Started ahead of E's scheduling because the human (lead) asked for it directly; all changes stay in `apps/extension/**`. No contract change.
- [x] Manifest: permissions `storage` + **`sidePanel`** only (host_permissions unchanged); `side_panel.default_path = sidepanel.html`; version 0.3.0.
- [x] Popup: **Open learning map** button → `chrome.sidePanel.open({ windowId })` called directly in the click handler (user gesture kept; window resolved beforehand); clear messages for Chrome < 116, unknown window or a denied open. Toolbar popup action unchanged.
- [x] Popup Settings: **Dashboard URL** (default `http://127.0.0.1:5173`), separate from API URL. The panel also tries the other loopback name automatically (127.0.0.1 ⇄ localhost), since Vite binds only one on some machines (the human hit this).
- [x] Panel (`src/sidepanel.ts`, logic in `src/lib/learning-map.ts`): full-size iframe to `${dashboardUrl}/student/<encoded id>?embed=1` built with URL APIs; only localhost/127.0.0.1 (existing host access), with an explanation for other origins; no prompts/tokens/keys in the URL.
- [x] Consent: off → "Friction is off", no iframe and no request. Revoked while open → iframe removed immediately (stops its dashboard/API/SSE work), pending checks aborted, stale callbacks ignored. Storage changes (student/URL/consent) reload the panel.
- [x] Unreachable dashboard → short message + **Retry** (bounded no-cors readiness probe, 2.5s per address) instead of a broken frame. A live dashboard whose API is down shows C's own in-frame error/retry.
- [x] Verified by an independent agent (Sonnet 5.5, fresh clone): PASS. Fixed from its findings: http-only dashboard URLs (matches the manifest's host access), credentials stripped from the frame URL, dot-only student ids rejected, Open learning map button disabled until the window is known (no click-before-ready error).
- [x] Tests: `test/learning-map.test.ts` (16): URL building/encoding, invalid/unsupported URLs, consent-off no-load, storage-change reload, consent revoked while open, stale check after revoke, unreachable → retry, loopback fallback, timeout, dispose. Extension total **82/82**; typecheck/build OK.
- [x] Visual check (simulated, headless at 400px with storage stubbed): the panel frames the live Student page from the running dashboard (iframe allowed by Vite; mastered/learning/locked render).
- [ ] **Depends on C's EMBED READY** for the compact `?embed=1` view; until then the full Student page is shown (development scaffolding per the brief).
- [ ] **Human check:** reload the extension, open the panel on claude.ai, answer a check question → the node turns green live in the panel. Also confirm the dashboard's `VITE_API_URL` and the extension's API URL point at the same API (8787), or mastery won't update in the panel.

## D READY (2026-10-24) — code commit `9fe390131e20d9ace2abd4a2cbb6c1ace0adfd2f`
Responds to FINAL-INTEGRATION-CHECK "Required completion order" item 2.

**Old-server gate deviation: RESOLVED.** The extension now uses the same rule as C's sandbox (`apps/extension/src/lib/bypass-gate.ts`): `scope:'prompt'` is sent only when `/health` reports contract ≥ 4 **and** either `mode.server === 'mock'` or the popup setting **API READY SHA** holds an exact 40-hex SHA (set only after E approves A's API READY). Otherwise the bypass request is the **legacy payload with no `scope` field**, the result is `scope_applied:'concept'`, and the UI says so up front: the popup button reads "Bypass this concept" with a "pauses friction on this concept until reset" note; the badge says "concept bypassed". No capability probe spends quota; `/health` is read-only. The earlier send-and-detect logic (reading `paused` before/after) is removed.

**Preserved guards (all still tested):** consent off → zero API calls (intercept, status, bypass); bypass refused before spending quota if the target message belongs to another chat, a different draft is in the composer, or a send is in flight; armed "send unmodified once" expires after 2 min and on navigation; per-chat conversation ids; pasted friction blocks/markers stripped; fail-open sends (error/timeout/ignored send restores the original text).

**Evidence, by kind:**
| Kind | Result |
|---|---|
| Simulated (unit, happy-dom) | `pnpm --filter @friction/extension test`: **66/66** (8 files; incl. 5 gate rules, health-failure fallback, badge tooltip honesty, and send-interceptor/site/hide/badge/conversation) |
| In-process real HTTP vs reference mock | included above: 15 service-worker integration cases, incl. two gate cases that make the mock answer as `server:'api'` and inspect the actual `/bypass` body (no SHA → no `scope` field; valid SHA → `scope:'prompt'`, no binding fields) |
| Fake-backed API (separate process) | `test:api` vs D's v4 mock on 8789: **15/15** |
| Typecheck / build | extension typecheck clean; `pnpm build:ext` OK |
| Real API + real Claude (human laptop, earlier today) | extension on claude.ai against 8787: L1 friction confirmed by the human (CP1 GO); sandbox/real-Claude smoke 3/3 run by the human |

**D READY verification (independent, Sonnet 5.5, fresh clone): PASS.** Gate logic identical to C's; no `scope` key ever sent to an uncertified server (checked in code and via the body-inspecting test); guards preserved. Fixed from its findings: the claude.ai badge's Bypass tooltip now uses the gate (`status.prompt_bypass`) and defaults to the cautious concept-pause wording; the popup's pre-load wording is neutral; the `/health` timeout timer is cleared; a test pins the health-failure → legacy fallback.

**Pending live checks (not claimed):** v4 prompt-scoped bypass against A's merged real API (needs A's corrected API READY + E's approval, then set the SHA in the popup); the human claude.ai bypass check after that; Windows Chrome load check.

**Learning-map side panel:** built at the human's request (see section above); compact view waits on C's EMBED READY.

## v4 rollout (contract READY v4) — superseded by D READY above
- [x] Merged main (v4); `packages/shared` and `scripts/` identical to main.
- [x] Badge/popup bypass requests **`scope: 'prompt'`** (no binding fields), then the guarded direct resend to claude.ai (consent / current-chat / draft / busy guards and 2-min armed expiry unchanged). Future ordinary sends still get friction.
- [x] **Old-server honesty:** a pre-v4 server ignores `scope` and pauses the concept. After a prompt-scoped bypass the service worker reads the node's `paused` flag and returns `scope_applied: 'prompt' | 'concept'`; the badge says "concept bypassed" and the popup adds "(This server paused the whole concept until reset.)". Verified for real: run against a still-running v2 mock, the prompt-scope tests saw `concept`; against the v4 mock they see `prompt`.
- [x] Tests: 57 extension tests (incl. v4 prompt scope → no pause, concept scope → pause); `test:api` 13/13 against the v4 mock on 8789 (restarted to load v4).
- [x] (superseded: detection removed in D READY) Detection hardened (v4 verification, PASS): `paused` is read before and after with a 1.5s timeout; "concept" only on false → true; `scope_applied:'unknown'` (no claim in the UI) if either read fails.
- ~~Note for E (wording deviation)~~ → resolved by D READY (gate like C).
- [ ] Live use against the **real** API waits for A's **API READY** SHA (per E). Until then, a bypass against the real API degrades honestly to concept scope (see above).

## Change requests (contract)
1. **Per-prompt bypass: ACCEPTED in contract v4** (`scope:'prompt'`); the text below is the original request, **superseded** by the "v4 rollout" section. Original request (2026-10-24): A bypass should skip friction for **that one prompt only**, still use one quota and still notify the educator (with the concept). Today §7 sets `paused = true`, so every later intercept on the node returns L4 until `/demo/reset`.
   - Ask (A + E, additive): `POST /bypass` stops setting `paused` (or takes an optional `scope: 'prompt' | 'concept'`, default `'prompt'`). Keep: quota −1, 409 at 0, close the pending quiz, `BypassEvent`, `bypass` SSE event with `student_name` + `concept_name`.
   - Extension side is done: the badge's **Bypass** button (and the popup's **Bypass this message**) calls `/bypass` for the node of the last friction-ed message, then re-sends that exact prompt unmodified (no `/intercept` call). If the page doesn't take the re-send, the text stays in the composer and the next Send goes out unmodified once.
   - Until the API changes, the concept also stays paused server-side (later prompts on it get L4). Sandbox (C) should switch its bypass button to the same per-prompt behavior.

2. **Re-asking the question counts as a correct answer (found in live testing, 2026-10-24).** In the same chat, sending the original question again is graded as the answer to the check question. `fakeEvaluate` (packages/shared, E) marks any message containing one of the node's keywords as `correct`, and the question itself contains them ("useEffect", "infinite loop"), so in DEMO_MODE the student jumps L1 → L4. Repro: two `/intercept` calls with the same `raw_prompt` and a `previous_assistant_text` → 2nd returns `level: 4, graded.verdict: correct`.
   - **⚠ E, please review and merge: I edited a file you own (approved by the human, 2026-10-24).** `packages/shared/src/fakes.ts`: `fakeEvaluate` now returns `not_an_answer` when the student's message is a new question (starts with how/what/why/when/where/which/who/can/could/should/would/do/does/will **and** ends with `?`). "Is it the dependency array?" still counts as an answer. It comes with a new shared test. No type or contract change. **It lives on branch `proposal/e-fake-grader` (commit 682c085), not on `agent/extension`** (reverted there in c30565a so D's branch only touches D-owned paths): cherry-pick it if you accept it.
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
pnpm --filter @friction/extension test        # 82 tests
pnpm --filter @friction/extension test:api    # integration tests vs a running API (default :8787)
pnpm --filter @friction/extension typecheck
pnpm build:ext                                # → apps/extension/dist
pnpm dev:mock:ext                             # mock API on 8789
```
