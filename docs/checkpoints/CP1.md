# CP1 integration report (2026-10-24)

**CP1 passed on integrated `main`.** All four branches merged in the prescribed B → A → C → D order. No branch was skipped and no builder source or status file was edited by E.

Contract version: **v2**. Accepted B's additive optional `EvaluateInput.signal`; HTTP shapes and late-grade behavior are unchanged. C's exact quiz-attachment header is queued for coordinated CP2 implementation.

## Merges and ownership

| Agent | Source commit | Merge commit | CP1 exit criteria | Notes |
|---|---|---|---|---|
| B Intelligence | `01cb60e` | `098dbd1` | 4/4 | 22 unit tests pass; live grader latency evidence is B's report, not rerun by E |
| A Platform | `441fdf8` | `b905bf0` | 5/5 | 47 API tests pass; persistence/restart, SSE, late grading, mutex, stored chat reply and next-turn reuse covered |
| C Dashboard | `bbd45c7` | `e4e34ac` | 4/4 | 3 unit tests plus integrated browser demo pass; branch includes later mock-verified features, but CP2/CP3 integration gates remain open |
| D Extension | `cf6365d` | `b8495a4` | 3/3 | 35 tests pass; 9 background integration tests also pass against A's running API; live claude.ai GO evidence is D's/human's report |

E fetched narrow `agent/*` refs explicitly, read all four remote status files, and checked changed paths against ownership before merging. Each merge was followed by frozen-lockfile installation and full workspace/scripts typecheck. The lockfile merged automatically, preserving both dashboard Playwright and extension happy-dom dependencies; no conflict resolution was needed. Final ancestry and byte comparisons confirm every source tip is included and each builder's owned source/status matches that tip exactly.

## Validation on merged main

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile --store-dir /workspace/.cache/pnpm-store` | PASS after each merge |
| `pnpm typecheck` | PASS after each merge and after v2 addition |
| `pnpm test` | **128 passed**, 12 files; no empty/skipped suites: shared 18, intelligence 22, dashboard 3, extension 35, API 47, smoke tools 3 |
| `pnpm smoke` against API 8787 | **PASS, 16/16**; health `server=api`, `intelligence=fake`, `demo=true`, contract 2 |
| `pnpm --filter @friction/dashboard build` | PASS |
| `pnpm build:ext` | PASS; content/background/popup bundles, manifest and popup HTML produced |
| `pnpm --filter @friction/dashboard test:browser` against API 8787 | PASS using installed Chromium and dashboard 5174 |
| `pnpm --filter @friction/extension test:api` against API 8787 | **9/9 passed**; separate execution of background integration suite, not additional unique unit cases |

The smoke check exercises parse/reset, L1 interception and grading, bypass/quota/passthrough, three sandbox chat turns, exposed metadata headers, live parse/mastery/bypass/activity events and educator HTTP/SSE privacy. The fake grader cannot itself prove chat-reply persistence; A's endpoint tests independently verify saved `llm_response` and its reuse as the next grading input.

The browser test exercised upload, a streamed L1 Socratic reply, correct answer → live L4 on educator/student/sandbox views without reload, New chat → full answer, bypass quota and educator toast, quota exhaustion, full reset and mobile width. It observed no browser runtime errors. This used **fake intelligence through the real API** and does not claim real-Claude readiness.

Browser command environment: `DASHBOARD_TEST_URL=http://127.0.0.1:5174`, `DASHBOARD_TEST_API=http://127.0.0.1:8787`, `BROWSER_PATH=/usr/bin/chromium`. E ran the existing test unchanged. Current-run screenshots are retained locally under `/tmp/friction-cp1-evidence`; test-generated changes to C's tracked screenshots were restored to preserve C's tree.

## Independent verification

`verify_cp1_integration` ran on `gpt-6.1-sol` at medium effort, the accepted substitute for unavailable Sonnet 5.5. It independently passed all **128 tests**, verified source-tip preservation, merge order, ownership, combined lockfile, cross-platform package scripts/path operations, A↔B compatibility, dashboard chat/SSE, educator privacy, and A's saved-reply tests. It reviewed the v2 signal addition and found **no CP1 integration blockers**. No builder source changes were made by the verifier.

## Contract decisions and followups

- **Accepted B signal (v2):** optional input field; B already forwards it to the SDK. A's existing calls require no changes. Cancel only for explicit operation cancellation; do not cancel merely because the response budget expired, since late grades must still apply.
- **Deferred C quiz header:** implement and test together at CP2 in shared/mock (E), API (A) and dashboard (C); bump the contract at that checkpoint. For now the UI's documented level-based hint is retained.
- **D defensive consent followup:** independent review found `handleBypass` in `apps/extension/src/background.ts` lacks its own enabled check. The popup disables bypass when off and interception/status guards pass, but a queued/programmatic bypass message can still call the API. D should add the defensive guard and a no-fetch regression for CP2; E did not edit D's code.

## Messages to agents

- **A:** CP1 merged. Merge `main`, read changelog v2 and confirm in your status file. Begin CP2 real-intelligence integration with B; preserve late-grade semantics when using the optional signal. The new 16-step smoke and D's 9 background tests pass against your fake-backed API. Coordinate the exact quiz header with C/E for CP2.
- **B:** CP1 merged. Merge `main`, read changelog v2 and confirm in your status file. Your optional grading signal was accepted. Next: streaming chat, real parse, classify fallback and the real-Claude compliance harness. E reran your 22 mocked/unit tests; live latency was not rerun.
- **C:** CP1 merged, including your pushed later dashboard work. Merge `main`, read changelog v2 and confirm in your status file. Full browser demo now passes against A's real API with fake intelligence. Exact quiz-header request remains queued for CP2; real-Claude CP2 and rehearsal/freeze CP3 are still open.
- **D:** CP1 merged, including your pushed later extension work. Merge `main`, read changelog v2 and confirm in your status file. All 35 tests and the 9-case `test:api` run against A's API pass. Add the defensive consent guard/test described above, and complete the remaining live claude.ai loop with the human before claiming CP2.

## Remaining external and later gates

- No live Anthropic calls were made for CP1. CP2 requires B's real chat/parse/fallback, configured credentials, real-Claude smoke three times consecutively, all six visual must-haves and a rehearsal/runbook.
- Human: relay the agent messages above. Complete D's remaining live claude.ai answer → L4 → new-chat test, confirm badge/block hiding, and run Windows install/typecheck/mock smoke if the team uses Windows. Linux source/command review is not a Windows runtime result.
- CP3 still requires two rehearsals, backup recording and final freeze. Merging later feature commits here does not complete those gates.
