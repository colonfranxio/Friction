# Moss release to main (E)

**Decision (human, 2026-10-24):** merge the full Moss integration into `main` and make Moss **on by default**.

## What changed on main

`main` fast-forwards to `moss-integration`, which already contained main `831935d` (A v4). This adds:
- B's Moss retriever and the classifier hint path (`packages/intelligence`). Includes the per-instance, curriculum-fingerprinted classification cache, which also applies with Moss off.
- A's Moss runtime (`apps/api/src/services/moss-runtime.ts`), the loader and shutdown changes, and the `moss:live` harness.
- **Default on:** `loadIntelligence` enables Moss in real mode whenever `MOSS_PROJECT_ID`/`MOSS_PROJECT_KEY` are set. `USE_MOSS_RETRIEVAL=0` (or `false`) opts out. Fake mode never loads Moss. Missing credentials log `[moss] {"state":"disabled","reason":"credentials"}`, and the API runs without it.
- Elementary demo assets: `fixtures/elementary-syllabus.{md,pdf}`, [docs/demo-elementary.md](../demo-elementary.md).
- Dashboard: an inline favicon in `apps/dashboard/index.html`. This removes the only browser console error, a `/favicon.ico` 404.

## Verification

See the release section appended below. History: [MOSS-integration.md](MOSS-integration.md), [A-v4-reintegration.md](A-v4-reintegration.md).

## Known limitations (unchanged)

- No accuracy gain shown on the seed course.
- 2-course Moss pool.
- A hung native call pauses Moss preparation (the API keeps serving).
- `POST /demo/reset {student_id}` drops an uploaded course's progress (A bug, not on the dashboard path).
- L2/L3 teaching instructions are worded for code.
- Real-model grading variance (one `partial` in 5 real smoke runs).

## Release verification at `7b01b7c` (clean clone, frozen install)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` · `pnpm typecheck` | PASS · PASS |
| `pnpm test` | PASS: shared 26, dashboard 9, intelligence 65, extension 35, api 93, scripts 12 (240) |
| `pnpm build:ext` · dashboard build | PASS · PASS |
| `verify-chat-abort` · `verify-stream-failure` | PASS · PASS |
| `pnpm smoke --require-v4`, private API, fakes | PASS (no `[moss]` lines: fake mode never loads Moss) |
| same, real Claude, **`USE_MOSS_RETRIEVAL` unset (default)** | PASS; `[moss] ready` then `retrieved` |
| same, real Claude, `USE_MOSS_RETRIEVAL=0` | PASS; `[moss] {"state":"disabled","reason":"flag"}` |
| `pnpm --filter @friction/api moss:live` | PASS, all steps. Artifact `apps/api/harness/results/2026-10-25T00-32-07-163Z-7b01b7c/` (dirty=false, scanned) |
| Browser demo (Playwright + Chrome, real API, Moss on by default, [elementary runbook](../demo-elementary.md)) | 17/17 PASS: PDF upload parsed live in 15.8s; Moss routes the child's question to What a Fraction Is at L1; the answer turns it green live in educator, student and sandbox views and unlocks its 3 dependents; new chat gets L4; bypass reaches the teacher; no child text on teacher pages; **no browser console errors** |

## Independent verification (read-only, at `0507e1e`)

**PASS, no blocking issues.**
- **Confirmed:** fast-forward ancestry; typecheck; 240 tests; both stream tools pass.
- **Default-on gating:** fake mode returns before loading intelligence; opt-out and missing credentials are rejected before any adapter is built; enabled with credentials.
- **Failure handling:** native SDK import is background-only, a missing native module degrades to the normal classifier, and shutdown is capped.
- **Repo hygiene:** every path is within its owner's area, no secrets, and the result JSONs contain no student identifiers. The favicon is harmless, and the docs match the code.

Follow-ups applied before push:
- Superseded note on `docs/moss-implementation-handoff.md`.
- Stale comment in `packages/intelligence/src/config.ts`.
- Aligned re-index timing (0.5–2s).
- README now states what is sent to Moss and how to opt out.

Accepted as is:
- The opt-out accepts only `0`/`false`, as documented.
- A native-addon segfault can't be caught in JS.

**Behavior change to note:** anyone running real intelligence with `MOSS_*` in `.env` now uses Moss automatically, sending curriculum text (no student data) to Moss. The only signal is the `[moss]` log lines.

## What each agent does next

- **All builders:** merge the new `main` before continuing work. The API loader and classifier changed. Moss is on in real mode whenever `MOSS_*` is set, so use `USE_MOSS_RETRIEVAL=0` if you need baseline behavior.
- **A:**
  - Fix `POST /demo/reset {student_id}` for uploaded courses: recreate L1 states for the student's active non-seed tree instead of seed states.
  - Optional: the harness abstention check (MOSS-integration verifier note 1) and the three v4 notes in [A-v4-reintegration.md](A-v4-reintegration.md).
- **B:**
  - Optional: make the L2/L3 instructions subject-neutral ("outline with blanks", "worked example with one mistake").
  - Optional: reduce real-grading variance on the sandbox answer turn.
- **C:**
  - Optional: set `VITE_PROMPT_BYPASS_API_READY_SHA` to this release's main SHA to enable one-prompt bypass against the real API.
  - Optional: the "4/3" badge wording and the "CODE" label on non-code blocks.
- **D:** the existing extension handoff deviation (FINAL-INTEGRATION-CHECK) is unchanged. Merge `main`.
- **E:** if `claude-skill-tree` is combined, reconcile it on a dedicated candidate branch. Still open for full acceptance: CR-2, rehearsals and the recording ([demo-elementary.md](../demo-elementary.md)).
