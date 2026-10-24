# Moss runtime checkpoints

Branch: `experiment/moss-retrieval`, based on merged main `544767f`.
Scope: user-authorized, opt-in sponsor integration; no accuracy improvement claimed.

## CP1 — backend wiring

- Opt-in `USE_MOSS_RETRIEVAL=1` requires real intelligence and both credentials.
- Store exists before runtime construction; serving never waits for background native preparation.
- Keyword-unmatched prompts use ready, scoped Moss candidate hints through the existing Claude classifier.
- Full canonical catalog, grading, policy, shared HTTP/types, dashboard and extension remain intact.
- Two-course pool counts preparing/closing handles; one unref'ed refresh timer, serialized preparation,
  retry backoff, fingerprint freshness checks and safe structured traces.
- Shutdown stops the poll immediately and limits application cleanup wait to two seconds.
- Independent verifier `verify_moss_runtime_cp1`: PASS on wiring/lifecycle/budget review.
- Workspace typecheck PASS, 72 API tests PASS (including 15 runtime tests), and 61 intelligence
  tests PASS. The remaining freshness/live checkpoints are recorded below as they complete.

## CP2 — freshness and failure verification

PASS. Tests exercise actual educator PATCH/add/delete, parse/new-course assignment, full reset,
polling, snapshots during warmup, hung-close capacity, query timeouts and missing native runtime.
- authoritative-store fingerprint is rechecked before and after each query (`fcce521`).
  Workspace typecheck PASS; 218 tests PASS (API 75, intelligence 61).

## CP3 — authenticated API demonstration

`pnpm --filter @friction/api moss:live` (2026-10-24): real Moss + Claude on a private ephemeral port with a memory-only store.

- /health served 200 during warmup; Moss index ready in 1515ms.
- Paraphrased prompt with no keyword match: Moss returned 3 candidates in 5ms. Claude chose "Context API"; L2 scaffold reply with an attached quiz; mastery unchanged.
- Injected Moss init failure: /intercept still resolved "Context API" via the baseline classifier, and the policy prompt was applied.
- Evidence: `apps/api/harness/results/moss-live.json` (scanned; no credentials).