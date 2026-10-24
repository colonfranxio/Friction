# Status: Agent C (dashboard)

**Owned by Agent C. Only this agent edits this file.**

- Contract version confirmed: 4
- Plan confirmed: v5, latest remaining-work brief and CONTRACT READY v4 read; merged origin/main 836784c including a11c16a
- Current checkpoint: C READY v4, mock-backed correctness/acceptance complete; real API READY and E's exclusive live acceptance still pending
- Last updated: 2026-10-24

## CP1 (v5): verified
- [x] Shell, three routes, and working Live indicator.
- [x] Educator/student seed views: 3 pillars, 8 nodes, 8 edges, shared status rules, locks, and badges.
- [x] `pnpm smoke:mock`: all 11 steps pass. Chrome captured active to mastered to active with the same document marker.
- [x] Sandbox streams replies and displays concept, level, and available quiz context. New chat creates a new conversation ID and sends fresh history.
- [x] Root typecheck, dashboard build, and three dashboard unit tests pass.
- Verification agents: `verify_cp1` found icon and ignored-lib issues (fixed); `verify_v5_cp1` independently reviewed v5 streaming, reconnect, and contracts; TypeScript passed. Its stale active-tree finding was fixed with profile refresh on focus, reconnect, and tree_updated.

## CP2 (v5): dashboard ready on mock; real integration pending
- [x] 1280px sandbox split view with readable, live student map; resize refits the map.
- [x] Browser demo: L1 Socratic question, correct answer to L4 live in sandbox/student/educator, new chat to full assistance.
- [x] Bypass on selected turn's header node, live quota decrement, and educator toast. Quota exhaustion shows "No bypasses left".
- [x] Text upload parses and navigates; PDF transport verified byte-for-byte with prefix-free base64. Parse animation and failure/retry verified. PDF fixture tests transport against the mock, not real AI parsing.
- [x] Reset demo uses full:true and is hidden when health reports demo:false.
- [x] Mobile has no horizontal overflow. API-down retry, chat 502, and cancellation by New chat verified in Chrome.
- [ ] Independent real-Claude acceptance and three real smoke runs remain scheduled by E. API/intelligence code is integrated; v4 API READY is still pending A's new wire behavior.
- [x] Retained educator editing now passes its full browser workflow: create, badge override, pillar rename, inspector save, drag/reload persistence, connect, cycle toast, keyboard edge selection/deletion, and node deletion. Controlled edge selection was fixed so keyboard deletion persists through API/SSE.
- Independent verifier: `verify_v5_cp2` reviewed current-turn bypass, profile refresh, reset, and upload; no blocking source issue found.

## CP3 (v5): dashboard polish verified on mock
- User explicitly authorized continuing the next checkpoint on 2026-10-24 while real integration is pending. CP2 remains open; this does not claim a real-Claude pass.
- [x] Same-view progress transitions: spring lock exit, node pulse, circularly clipped confetti, and badge flip. Chrome verified no celebrations on initial fetch or viewing-as change.
- [x] Hover float and animated mastery tooltip; keyboard focus exposes the same tooltip.
- [x] Existing class counts remain covered by shared-rule unit tests; activity appears after grading and never shows the raw question. Existing loading/error paths pass browser regression.
- [x] Active-edge energy and new-edge drawing. Browser test exposed dropped React Flow measurements briefly unmounting edges; preserving measurements fixed the transition.
- [x] Reduced motion disables decorative effects while keeping live state and screen-reader announcements.
- [x] Typecheck, three unit tests, full demo browser test, error-recovery browser test, and new polish browser test pass. Independent verifier `verify_v5_cp3` reviewed source and passed dashboard TypeScript; confirmed edge-lifetime fix and absence of debug logging.
- [x] Lazy routes keep the entry chunk at 263 kB and shared canvas chunk at 350 kB (raw minified); production build passes with no large-chunk warning.
- Parallax cut to keep focus on mastery and the simpler demo. No new dependencies or contract changes for CP3.
- Integration/rehearsal freeze is NOT claimed: CP2 real-Claude verification and E's integrated rehearsals remain pending.

## C READY v4 followup
- Confirmed shared handoff `a11c16a1e7ead6f657ee71b9f627a4c3195ce3b6` and main `836784c`. No shared/API/mock/other-agent source was changed by C.
- [x] Exact `CHAT_HEADERS.quizAttached` is stored on each reply. Browser covers true, false at L1 with an existing quiz, L4, no match, historical turn selection, and absent-header approximate fallback. Never infer attachment from level.
- [x] Native HTTP body-read rejection keeps partial text as interrupted, excludes its pair from future history, and offers explicit edit-original recovery; no automatic resend of an unseen quiz answer. Structured pre-stream error and empty-stream handling remain separate.
- [x] Mock v4 prompt bypass binds exact raw text and conversation, sends returned token once, charges only issuance, leaves levels/pause unchanged, and returns to ordinary friction on the next turn. Original reply is visibly superseded.
- [x] Historical-turn, draft, busy, repeated attempt, session and synchronous expiry guards run before issuance/resend. Missing authorization never falls back to an unguarded resend. New chat cancels ordinary and bypass streams without resurrecting replies.
- [x] Older real-server fallback keeps the legacy concept pause, sends no prompt scope/token, and clearly describes its effect even if health reports v4.
- [x] Root `pnpm typecheck`, full `pnpm test` (181 tests: shared26, B42, C9, D35, A57, scripts12), and dashboard build passed. Browser editing, v4 acceptance, demo and resilience passed on C's mock; CP3 polish regression is rerun with separate evidence below.
- Independent `verify_c_ready_v4` found the click-time expiry and session-invalidation busy-state defects; both fixed. It independently passed C's 9 tests using the thread pool and found no blocking defect in the final review. Browser/service tests were parent-owned.
- Real prompt rollout is deliberately gated: only the reference mock enables it automatically. For a real endpoint, after A's API READY and E's approval, configure `VITE_PROMPT_BYPASS_API_READY_SHA` with A's exact 40-character ready SHA and restart Vite. Version/health alone is insufficient; no capability probe spends quota.
- Real semantic quality, valid-PDF intelligence, rehearsals/recording and CP3 freeze are not certified by these mock tests. The real API's clean-EOF failure defect remains A's implementation gate in the published handoff.

## Evidence
- `apps/dashboard/test/artifacts/CP1-educator.png`, `CP1-student-live.png` (original CP1).
- `apps/dashboard/test/artifacts/v5-CP1-sandbox-L1.png`.
- `apps/dashboard/test/artifacts/v5-CP2-sandbox-mastered.png`, `v5-CP2-educator-bypass.png`, `v5-CP2-mobile.png`.
- `apps/dashboard/test/artifacts/v5-CP3-mastery.png`, `v5-CP3-activity.png`.
- v4 run evidence: `apps/dashboard/test/artifacts/v4-acceptance/` (prompt bypass next turn and interrupted reply), `v4-demo/` (full flow), and `v4-polish/` (animation/activity). Existing screenshots are preserved rather than overwritten.

## Change requests (contract)
Contract v4 confirmed. Previous exact-quiz-header request was accepted in v3 and is now consumed by C. Prompt scope/token and rejected-body-read changes follow E's published v4 handoff. No new change request.

## Dependency changes
Playwright added only to dashboard devDependencies (lockfile updated, 19 additive lines). Browser tests use installed Chrome by default; `BROWSER_PATH` can select another installed Chromium executable. Existing root Vitest/tsx run dashboard scripts.

## Assumptions
Class badge uses the median level among students with the majority status. Fully mastered students have no focus count. Student Now learning follows ui-layouts section 3 (most recently updated active node); class focus uses lowest depth with update-time tie break.

## Blockers / needs from the human
API and intelligence are integrated. Waiting for A's v4 API READY SHA and E's exclusive final-API/browser window; do not enable prompt scope on the older real route or claim CP2/CP3 live acceptance from mock evidence. E owns final merge and human rehearsal/recording scheduling.

API key supplied by user is configured only in root git-ignored `.env` (UTF-8); no secret is committed or sent to the browser. This shell had no Node/pnpm on PATH; portable tools are in ignored dashboard node_modules/.tools for verification.

## How to run and verify my part
Run `pnpm dev:mock`, then `pnpm dev:dash:mock`. Open http://127.0.0.1:5173/sandbox. Use the suggested useEffect question, answer with the dependency-array explanation in `DEMO_PROMPTS.correctAnswer`, observe the map turn green, then New chat and repeat the question. Ask about Context and Use bypass; educator page receives a toast.

Select Alex or the Student route before `pnpm smoke:mock` to see his promotion (class majority may remain unchanged; smoke resets Alex at the end).

Checks: `pnpm typecheck`; `pnpm --filter @friction/dashboard test`; `pnpm --filter @friction/dashboard build`.

With mock/dashboard running: `pnpm --filter @friction/dashboard test:browser` and `pnpm --filter @friction/dashboard test:browser:resilience`. Run sequentially: these deliberately reset demo data. Demo script supports `DASHBOARD_TEST_URL` and `DASHBOARD_TEST_API` for real API verification once ready; resilience script uses a synthetic PDF transport fixture and is intended for the mock.

New gates: `pnpm --filter @friction/dashboard test:browser:v4` and `pnpm --filter @friction/dashboard test:browser:editing`. Both require the mock. Run all browser suites serially on C's backend. Demo and polish scripts refuse a non-mock backend unless `DASHBOARD_TEST_EXCLUSIVE=1` explicitly confirms E's scheduled window. `DASHBOARD_EVIDENCE_DIR` selects a unique evidence directory; defaults preserve prior screenshot files. Demo assertions use deterministic wording only in fake mode; real mode checks transport/metadata with a longer timeout and leaves semantic assessment/human acceptance separate.

CP3: `pnpm --filter @friction/dashboard test:browser:polish` checks normal and reduced-motion contexts, real SSE progress transitions, initial/view-switch suppression, keyboard tooltip, circular confetti bounds, cleanup, edge drawing and ticker, and educator activity privacy. It also resets demo data; run separately from other browser scripts.
