# Contract changelog

Additive changes only. Each entry: version, date, what changed, who asked.

## v3 implementation followup (CP2, 2026-10-24)
- Merged A's PR #1 (`d757427`): real `/chat` now emits the exact quiz-attachment header and exposes it through the existing CORS list. True/false/no-match and pending-quiz cases were verified. C's UI consumption remains pending; no new contract version or shape change.
- A's aborted-stream completion fix and quiet-abort regression resolve E's standalone cancellation failure. Partial replies remain saved, unseen quizzes are closed, and late grading semantics are unchanged.

## v3 (CP2 integration, 2026-10-24)
- Accepted C's additive optional `CHAT_HEADERS.quizAttached` / `X-Friction-Quiz-Attached`, with the exact `quiz_attached` boolean string for each chat turn. E implemented the shared constant, mock emission, CORS exposure and smoke checks. No existing HTTP fields or headers changed.
- The mock must emit the header; the real API may omit it during rollout. Smoke validates the value and CORS exposure whenever present and requires it for the mock. A owns adding it to real `/chat` and endpoint tests; C owns consuming it with fallback when absent. E did not edit builder code.
- Contract v2's explicit grading cancellation semantics and required late-grade behavior are unchanged.

## v2 (CP1, 2026-10-24)
- B requested optional `EvaluateInput.signal?: AbortSignal`; accepted as an additive interface change. B's implementation already forwards this field to its SDK request. A's current callers remain compatible without passing it. The mock/shared fake accepts the extended input without network work.
- Cancellation means explicit operation cancellation, never automatic cancellation when the intercept response budget expires: late-grade behavior remains required. No HTTP shape, progression rule or prompt format changed.
- C's requested exact quiz-attachment chat header is deferred to coordinated CP2 work in shared/mock (E), API (A) and dashboard (C). The current UI workaround remains supported; no unsupported header is advertised.

## v1 verification amendment (E, pre-CP1, 2026-10-24): no shape changes
- Fixed the reference mock's parse path to emit the already-required `tree_updated` SSE event after restoring the seed tree (contracts §8–9).
- Extended the smoke gate to observe parse, mastery and bypass SSE events, exercise the sandbox's three-turn chat flow, check chat metadata/CORS, and check educator HTTP/SSE privacy.
- Added shared regression tests for progression boundaries, graph/mastery rules, independent seed stores, prompt delimiters, demo fakes, and client errors/streaming/cancellation forwarding.
- Requested by E's gate preparation; contract version remains 1. B's optional grading signal and C's exact quiz-header requests remain pending checkpoint review.

## v1 (CP0, 2026-10-24)
- Initial freeze: `packages/shared` (constants, types, api, intelligence, rules, client, seed, fakes), `scripts/mock-api.ts`, `scripts/smoke.ts`, `docs/contracts.md`, `docs/ui-layouts.md`.

## v1 amendment (pre-kickoff, 2026-10-24): Windows compatibility, no shape changes
- `DEFAULT_API_URL` and `.env.example` URLs use `127.0.0.1` instead of `localhost` (Node on Windows may resolve localhost to `::1`).
- New cross-platform scripts: `dev:mock:ext` (8789), `dev:dash:mock` (`vite --mode mock` + committed `.env.mock`), `smoke:mock`, `smoke --url`, `setup:worktrees` (Node; replaces the bash script).
- `.gitattributes` forces LF on every OS.

## v1, plan v5 (2026-10-24): simplification, no shape changes
- Sandbox chat is the main demo surface; the claude.ai extension is a bonus and uses message-box injection (no network interception, no `/responses` from the extension; grading uses `previous_assistant_text`).
- 3 checkpoints (CP1 T+3h, CP2 T+9h, CP3 T+16h freeze). Heartbeat cut from the MVP.
