# Moss runtime integration plan

Updated after fetching origin on 2026-10-24. Latest merged main is still `544767f`;
`experiment/moss-retrieval` already contains it, plus the SDK experiment and live study.
No new upstream changes need merging. Continue on this experimental branch.

## Decision and scope

The user clarified that meaningful sponsor integration is itself a product objective.
Proceed with an explicitly enabled runtime integration, subject to reliability verification.
This supersedes the earlier recommendation to require an accuracy improvement before wiring
Moss into the running application. It does not supersede the [measured results](moss-live-results.md):
the small seed-course trial demonstrated retrieval feasibility, not a semantic accuracy gain.

Moss will retrieve instructor-defined skills and learning objectives for keyword-unmatched
prompts in the actual sandbox/claude.ai backend flow. Claude interprets the retrieved candidates
against the canonical curriculum; the existing backend selects the assistance policy.
The existing JSON store, grading/progression, shared contracts, dashboard and extension stay intact.
Do not introduce historical student-memory claims, Supabase, ChatGPT support, or a new agent framework.

## Runtime flow

1. Require both real intelligence and `USE_MOSS_RETRIEVAL=1`. Project credentials alone do not enable it.
2. Construct the JSON store before initializing retrieval. Start serving without waiting for model downloads.
3. In the background, snapshot the currently active course curricula and prepare local Moss sessions.
   Use a bounded pool of at most two courses, prioritizing the demo student's active course. A course
   outside the pool continues through the baseline classifier; document this initial capacity limit.
4. Keep keyword matching first. For unmatched prompts, query only a ready session whose complete
   semantic fingerprint matches a snapshot of the supplied curriculum. Wait at most 200ms and subtract
   that wait from the existing 3s classifier timeout; keep the 4s interception budget.
5. Map returned IDs to canonical skills. Pass candidate numbers and their canonical learning objectives
   as advisory context to Claude, retaining its complete catalog and ability to return no match.
   Reuse the existing candidate-hint implementation; do not add redundant copies of objective text.
6. Continue the existing node/state lookup, prompt construction, quiz and policy behavior. Retrieval
   scores never become mastery evidence, classification confidence, or a direct assistance decision.

## Freshness and lifecycle

- Use one background refresh interval while explicitly enabled, unref'ed and cleared on shutdown.
  A one-second refresh is sufficient for this demo. It reads the authoritative store rather than
  requiring hooks in every educator route. No interval or native SDK import exists on the disabled path.
- Fingerprint tree/node IDs, concept names, mastery criteria and keywords. State-only saves and layout
  changes do not require re-embedding. Snapshot mutable node objects before warmup and classification.
- An educator edit, node addition/deletion, parse/assignment, or reset becomes visible on the next scan.
  Queries detect mismatched fingerprints immediately and fall back until the replacement is ready.
- Serialize preparations and retain only the latest pending snapshot per selected course. Do not lose
  a refresh when the adapter refuses preparation because a query or another preparation is active.
- Bound resident sessions, pending work and retry frequency. Failed initialization retries with backoff
  outside requests. In-flight queries remain bounded after response timeouts.
- Count preparing and still-closing sessions against the two-course resource cap, including sessions
  waiting on hung native work. Do not let eviction create an unbounded collection of native handles.
- Dispose evicted sessions only after their outstanding work settles. Close is idempotent; shutdown
  stops refresh/retry work and requests resource disposal without an unbounded server shutdown wait.

## Small implementation surface

| Files | Change |
| --- | --- |
| `packages/intelligence/src/index.ts` | Export the supported adapter factory/types; API package cannot deep-import unexported source paths. |
| `packages/intelligence/src/classify.ts` | Snapshot semantic inputs consistently; retain the existing optional hint path and budget. |
| `apps/api/src/intelligence.ts` | Wire real intelligence to the optional runtime retriever; fake/disabled modes remain baseline. |
| `apps/api/src/index.ts` | Initialize store first; start/stop the background retrieval lifecycle. |
| New private API runtime service | Own scoped sessions, bounded preparation, refresh, backoff and diagnostics. |
| `.env.example` and README | Document explicit enablement, setup, limitations and sponsor contribution. |
| API/intelligence tests | Verify enabled behavior, fallback, freshness, capacity and shutdown. |

Avoid changes to frozen shared types or HTTP payloads. Use server-side diagnostic traces rather than
introducing a public health contract or a dashboard dependency.

## Visible sponsor contribution

When enabled, emit safe server diagnostics for ready/fallback states, curriculum fingerprint prefix,
candidate count and elapsed time. Do not log credentials, provider error strings, raw student prompts,
student identifiers or interaction history. A controlled demo can pair these traces with the existing
sandbox and course graph to show real retrieval.

Use a new conversation with a paraphrase such as:
"How do I share the selected theme with deeply nested descendants without passing it through every layer?"
Show Moss retrieval, Claude's selected course concept, and the resulting policy-guided reply. Then
disable the flag or inject a retrieval failure and show the existing flow still works. Do not claim
improved accuracy or guaranteed compliance by third-party AI tools. Final sponsor eligibility remains
the judges' decision; the README must describe the actual running integration.

## Checkpoints and verification

1. **Runtime wiring:** opt-in loader, background warmup, safe traces and disposal. Unit/integration checks
   prove disabled/fake startup never imports the SDK, and cold/auth-failed startup still serves normally.
   Spawn an independent verification agent before calling this checkpoint complete.
2. **Freshness and fallback:** same-ID edits, added/deleted nodes, newly parsed course, reset, pool capacity,
   preparation/query overlap, SDK failures, slow queries and shutdown. Retain latest snapshots and reject
   old-course IDs. Run workspace typecheck/tests and a private in-memory demo smoke. Independent verifier.
3. **Live enabled demo:** real Moss and Claude through the actual API on a private port/store. Inspect the
   ready trace and unmatched-prompt path; exercise failure fallback without changing shared services.
   Record evidence and setup instructions, get independent verification, then push the experimental branch.

Main remains separate throughout. Existing API/extension v4 blockers are outside this change and must
not be reported as resolved by adding Moss.
