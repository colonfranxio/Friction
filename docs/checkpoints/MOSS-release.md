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
