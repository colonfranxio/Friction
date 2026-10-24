# Status: Agent C (dashboard)

**Owned by Agent C. Only this agent edits this file.**

- Contract version confirmed: 1
- Current checkpoint: CP1 verified; CP2 next
- Last updated: 2026-10-24

## Exit criteria for the current checkpoint
- [x] Shell, router, and Live indicator; headless Chrome navigated educator to student and connected SSE.
- [x] Seed tree renders 3 pillars, 8 nodes, 8 edges with shared status rules, locks, and badges; browser DOM checks and screenshot.
- [x] Student route renders Alex's own state, with read-only graph and progress panel.
- [x] Smoke changes useEffect active to mastered to active live with the same document marker; all 11 smoke steps pass.
- [x] `pnpm typecheck`, dashboard build, and dashboard tests (3) pass.
- Independent verifier `verify_cp1` reviewed contracts and implementation. Fixed unavailable Lucide Hook export and ignored src/lib files.
- Evidence: `apps/dashboard/test/artifacts/CP1-educator.png`, `CP1-student-live.png`.

## Change requests (contract)
None. Contract v1 confirmed, including Windows amendment.

## Dependency changes
No new dependencies. Added dashboard test script using existing root Vitest.

## Assumptions
Class badge uses the median level among students with the majority status. Fully mastered students have no focus count. Student Now learning follows ui-layouts section 3 (most recently updated active node); class focus uses lowest depth with update-time tie break.

## Blockers / needs from the human
Real API integration awaits Agent A and E's checkpoint merges. This machine had no Node/pnpm on PATH; portable tools installed in ignored dashboard node_modules/.tools for verification.

## How to run and verify my part
Run `pnpm dev:mock`, then `pnpm dev:dash:mock`. Open http://127.0.0.1:5173. Select Alex or the Student route before `pnpm smoke:mock` to see his promotion (class majority may remain unchanged; smoke resets Alex at the end).

Checks: `pnpm typecheck`; `pnpm --filter @friction/dashboard test`; `pnpm --filter @friction/dashboard build`.
