# A v4 re-integration (E)

Releases CP3's hold on A. Candidate: `integrate/a-v4` = main `d23cb63` + `agent/platform` `a999095`.

## What was held and why it is released

[CP3](CP3.md) held A's API READY `d6badeb` for one defect: a test assumed the bypass row was `items[0]` of the activity feed, but an intercept row and a bypass row can share a `created_at` millisecond. A's `a999095` now finds the bypass item and asserts exactly one, keeping the quota, state, pending-quiz and event assertions. No sleeps or fabricated timestamps were added, and no product code changed.

Ownership: `agent/platform` touches only `apps/api/**` and `docs/status/A-platform.md`. Merge into main was clean.

## Verification at `8fcc315` (clean clone, frozen install)

| Check | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS: shared 26, dashboard 9, intelligence 42, extension 35, api 72, scripts 12 (196) |
| API suite repeated | 72/72 on 4 consecutive runs (tie fix holds; still not reproducible on demand) |
| `verify-chat-abort.ts` | PASS |
| `verify-stream-failure.ts` | **PASS**. Was FAIL on main: "real HTTP reader rejects after partial text; partial saved and quiz closed." |
| `pnpm smoke --require-v4`, private API, fakes | **PASS 17/17**. Was FAIL on main (prompt bypass paused the concept). |
| `pnpm smoke --require-v4`, private API, real Claude | 4 of 5 runs passed, including **3 consecutive passes** (all grades `correct`). |

The one real-Claude failure was step 13 (sandbox answer → L4). Real Claude wrote its own quiz in the sandbox and graded the smoke's fixed `DEMO_PROMPTS.correctAnswer` as `partial`. The API correctly applied it (no promotion). That is **model grading variance (B's area)**, not an A defect; main's flow has the same exposure. Possible follow-up for B: make the sandbox quiz and the canned answer more tightly coupled, or loosen the smoke's real-mode expectation. E decides.

All servers used a private port (8797) and the clone's own store. No shared services or demo data were touched.

## Effect on other agents

- **C:** the real API now supports v4 one-prompt bypass. After this lands on main, set `VITE_PROMPT_BYPASS_API_READY_SHA` to the main merge SHA and verify the one-prompt resend against the real API (CP3 step 3).
- **D:** unchanged. The extension handoff deviation from FINAL-INTEGRATION-CHECK is still open.
- **Moss:** the same A work is merged into `moss-integration` (`cd0eb24`) and re-verified there; see [MOSS-integration.md](MOSS-integration.md).

## Still open for full acceptance

The whole-class syllabus assignment (CR-2), D's extension handoff, C's real-API prompt-bypass verification, rehearsals and the recording.
