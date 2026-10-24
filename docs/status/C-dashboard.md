# Status: Agent C (dashboard)

**Owned by Agent C. Only this agent edits this file.**

- Contract version confirmed: 1
- Plan confirmed: v5 simplified MVP, merged origin/main at 948a8c8; changelog v1 plan-v5 amendment read
- Current checkpoint: CP3 dashboard polish verified against mock; CP2 real API gate still pending
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
- [ ] Real API and real Claude smoke x3: blocked on A/B implementations merged by E (current main still contains placeholders).
- Optional educator editing was preserved from work begun before the v5 update; compiles, but has not been browser-verified as a full editing workflow. Class/activity panels are present. User subsequently authorized CP3 work while integration is pending (see below).
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

## Evidence
- `apps/dashboard/test/artifacts/CP1-educator.png`, `CP1-student-live.png` (original CP1).
- `apps/dashboard/test/artifacts/v5-CP1-sandbox-L1.png`.
- `apps/dashboard/test/artifacts/v5-CP2-sandbox-mastered.png`, `v5-CP2-educator-bypass.png`, `v5-CP2-mobile.png`.
- `apps/dashboard/test/artifacts/v5-CP3-mastery.png`, `v5-CP3-activity.png`.

## Change requests (contract)
Contract v1 confirmed, including Windows and plan-v5 amendments.

Add optional `CHAT_HEADERS.quizAttached` / `X-Friction-Quiz-Attached` (boolean string), emitted/exposed by both mock and real chat endpoints. The frozen chat headers currently contain only intercept ID, node ID, and level, so the UI cannot report exact quiz attachment per turn. Local workaround: lower levels say "See check question in reply"; L4 says "Not attached". No frozen files changed.

## Dependency changes
Playwright added only to dashboard devDependencies (lockfile updated, 19 additive lines). Browser tests use installed Chrome by default; `BROWSER_PATH` can select another installed Chromium executable. Existing root Vitest/tsx run dashboard scripts.

## Assumptions
Class badge uses the median level among students with the majority status. Fully mastered students have no focus count. Student Now learning follows ui-layouts section 3 (most recently updated active node); class focus uses lowest depth with update-time tie break.

## Blockers / needs from the human
Real API/Claude integration awaits A/B and E's checkpoint merges. No origin/agent/platform branch available at verification time; local API and intelligence entry points remain placeholders. Do not mark CP2 fully complete yet.

API key supplied by user is configured only in root git-ignored `.env` (UTF-8); no secret is committed or sent to the browser. This shell had no Node/pnpm on PATH; portable tools are in ignored dashboard node_modules/.tools for verification.

## How to run and verify my part
Run `pnpm dev:mock`, then `pnpm dev:dash:mock`. Open http://127.0.0.1:5173/sandbox. Use the suggested useEffect question, answer with the dependency-array explanation in `DEMO_PROMPTS.correctAnswer`, observe the map turn green, then New chat and repeat the question. Ask about Context and Use bypass; educator page receives a toast.

Select Alex or the Student route before `pnpm smoke:mock` to see his promotion (class majority may remain unchanged; smoke resets Alex at the end).

Checks: `pnpm typecheck`; `pnpm --filter @friction/dashboard test`; `pnpm --filter @friction/dashboard build`.

With mock/dashboard running: `pnpm --filter @friction/dashboard test:browser` and `pnpm --filter @friction/dashboard test:browser:resilience`. Run sequentially: these deliberately reset demo data. Demo script supports `DASHBOARD_TEST_URL` and `DASHBOARD_TEST_API` for real API verification once ready; resilience script uses a synthetic PDF transport fixture and is intended for the mock.

CP3: `pnpm --filter @friction/dashboard test:browser:polish` checks normal and reduced-motion contexts, real SSE progress transitions, initial/view-switch suppression, keyboard tooltip, circular confetti bounds, cleanup, edge drawing and ticker, and educator activity privacy. It also resets demo data; run separately from other browser scripts.
