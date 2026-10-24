# Moss experiment: feasibility and acceptance gates

Base: `origin/main` at `544767f`. Trial branch: `experiment/moss-retrieval`.

## Independent study, before implementation

`verify_moss_feasibility` independently reviewed the merged code and official SDK documentation.
Verdict: **GO for an isolated, disabled-by-default curriculum retrieval experiment**;
**NO-GO for live activation or claims of historical learning memory until measured gates pass**.

The merged application uses Hono, a JSON store, keyword classification followed by Claude,
and pending-quiz grading. It does not have Supabase, authentication, a historical evidence
ledger, or a shipping ChatGPT adapter. This experiment does not introduce those systems or
change grading, progression, shared contracts, UI, or the extension. Main's existing API/extension
v4 blockers remain separate; see [final integration check](checkpoints/FINAL-INTEGRATION-CHECK.md).

## Feasibility evidence

- Published `@moss-js/moss` version 1.21.0 requires Node >=20.4; the workspace runs Node 22.
- Its native core 0.36.0 publishes a Windows x64 MSVC binary.
- Actual Windows x64 native import, client construction, and client close: **PASS** in an isolated
  temporary directory, without credentials. This is not an authenticated search test.
- Opening a local session authenticates. Project ID/key and model warmup are required for live tests.
- The current 6-15-node curriculum already fits in the Claude prompt. Better search alone does not
  prove better classification; compare against the complete existing keyword-plus-Claude pipeline.

## Smallest safe experiment

Implement a curriculum-only adapter in `packages/intelligence`, injected explicitly through local
options by a standalone comparison harness. Do not enable it in API startup or depend on it for
the existing demo. Keep keyword classification first. Claude retains the complete canonical
concept list and can abstain; retrieved candidates are advisory context, never an automatic
classification or a mastery score. Preserve `ClassifyResult.method = 'llm'` for Claude decisions.

Prepare the in-memory index before queries in the harness. Do not upload indexes or student logs.
Fingerprint tree IDs, node IDs, names, mastery criteria and keywords; reject stale/unknown IDs.
Bound retrieval to 200ms within the existing 3s classification budget. Unready, stale, empty,
failed or timed-out retrieval uses the existing baseline. Scope caches to an intelligence
instance and semantic curriculum content so experiments cannot contaminate baseline runs.

## Gates

1. Native import and ordinary disabled startup work without Moss credentials.
2. Keyword routing is unchanged; retrieval exceptions, empty results, unknown IDs, stale curricula,
   and timeouts safely fall back. Timed-out operations cannot multiply without bound.
3. Same-ID educator edits invalidate the index and classification cache. No old-tree result leaks.
4. A labeled harness compares keyword-only, existing keyword+Claude, and optional Moss+Claude on
   paraphrases, related concepts, ambiguous requests and unrelated requests. Report correctness,
   abstention, retrieval recall, context size and warm latency; cold preparation is separate.
5. Workspace typecheck/tests and the existing fake-backed smoke pass with the feature absent.
6. Independent verification reviews the implementation before any live rollout recommendation.

Keep the feature only if measured usefulness justifies extra latency and runtime dependencies.
Missing credentials leave the live quality/latency gates open; mocked tests cannot close them.

## Implemented trial

- Optional pinned dependency `@moss-js/moss@1.21.0`, native core 0.36.0. Existing dependency
  versions are unchanged. The default API does not construct or import the native adapter.
- `MossCurriculumRetriever.prepare(nodes)` explicitly authenticates, builds one local curriculum
  session, and warms its model before measurements. No cloud index writes or student-history indexing.
- Explicit `createIntelligence({ curriculumRetriever })` injects candidate numbers as fallible hints
  alongside the full canonical concept catalog. No token savings are claimed for this approach.
- Warm retrieval has a 200ms response deadline, subtracted from the 3s Claude classification
  timeout. There is at most one outstanding native query. Since a timeout does not cancel that
  native operation, disposal waits for it before freeing handles; close is idempotent.
- A 23-case synthetic seed-course harness includes exact terms, paraphrases, three ambiguous
  related-skill cases with allowed alternatives, and unrelated prompts. Optional Claude comparison
  reports valid outputs separately from provider errors, token usage, and observed latency.

### Run locally

Add `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY` to the existing gitignored root `.env`. Never put
them in client-side configuration. No new server or database is required.

```text
pnpm --filter @friction/intelligence moss:trial --check-sdk
pnpm --filter @friction/intelligence moss:trial
pnpm --filter @friction/intelligence moss:trial --with-claude
```

The first command only loads/constructs/closes the native SDK. The second authenticates and
measures local retrieval. The third additionally makes paid Claude classification calls using
`ANTHROPIC_API_KEY` and `MODEL_CLASSIFY`. All test prompts are synthetic. Missing configuration
produces a safe machine-readable status and nonzero exit. Provider error details are suppressed.

Cold preparation is reported separately and may require downloading the model. This standalone
spike does not cancel a hung native operation: run it separately from demo services. Timing out
an individual response prevents additional outstanding retrieval operations, not native execution.

### Verification on Windows

| Check | Result |
| --- | --- |
| Pre-change workspace baseline | Typecheck PASS; 181 tests PASS |
| Installed SDK native import/construct/close | PASS; no authentication performed |
| Workspace typecheck | PASS |
| Workspace regression tests | PASS: 199, including 60 intelligence tests |
| Existing demo smoke | PASS: 16/16 on an ephemeral in-memory API; shared services/data untouched |
| Missing-credential trial | Correctly reports `credentials_missing`; live retrieval not run |
| Independent implementation verification | PASS for default-off trial; native disposal race fixed and tested |
| Authenticated retrieval / comparative Claude quality | PASS technical feasibility; no incremental quality gain demonstrated — see [live results](moss-live-results.md) |

Independent verifier `verify_moss_trial` confirmed opt-in isolation, keyword preservation,
canonical catalog retention, freshness invalidation, bounded queries, and the resource-lifecycle
fix. It requested ambiguous cases and provider-failure observability; both are now in the harness.
Its follow-up review also passed the final harness changes and independently passed typechecking.

**Rollout remains NO-GO after the initial live comparison.** Both pipelines were correct on all
21 healthy paired cases; the apparent 23/23 versus 21/23 advantage came from two baseline provider
errors. Ordinary API startup stays unchanged, including when Moss credentials exist. A later
opt-in API hook should only be considered after a realistic larger-curriculum comparison
demonstrates useful improvement. See [authenticated trial results](moss-live-results.md).

## Sources

- [Quickstart](https://docs.moss.dev/docs/start/quickstart)
- [Local indexing](https://docs.moss.dev/docs/build/real-time-local-indexing)
- [Authentication](https://docs.moss.dev/docs/integrate/authentication)
- [Metadata filtering](https://docs.moss.dev/docs/integrate/metadata-filtering)
- [Deployment](https://docs.moss.dev/docs/integrate/deployment-production)
- [Published package](https://registry.npmjs.org/@moss-js%2fmoss/latest)
