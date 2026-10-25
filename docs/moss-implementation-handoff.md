# Moss sponsor integration: execution plan

> **Executed and released (2026-10-24).** Moss is merged to main and is **on by default** when real intelligence and Moss credentials are present (human decision), which supersedes the "off by default" and "credentials alone never enable it" rules below. Current state: [checkpoints/MOSS-release.md](checkpoints/MOSS-release.md).

Accepted direction: reuse the existing Moss curriculum-retrieval experiment with minimal stack changes. Sponsor-track usage is a valid product goal; an accuracy improvement is not a prerequisite. Preserve honest claims and existing learning behavior.

## Scope and branch rules

- E coordination/integration branch: **`moss-integration`**, based on main `d23cb63`. Implementation reference: **`experiment/moss-retrieval` at `8f8fe63`**. This reference is proposed code and external evidence, not a merged or independently validated release.
- B works on **`agent/moss-intelligence`** and A on **`agent/moss-platform`**, initially based on this instruction-bearing branch. Their normal ownership applies: B intelligence package/status, A API/status. E owns combined lockfile, environment example, root configuration and documentation.
- Keep main, `claude-skill-tree` and the C/D feature branches separate. No feature merge into main until the human directs it after review. Never bulk-merge original agent branches or the complete experiment to import unreviewed work.
- Use existing isolated checkouts. Preserve unfinished changes before switching; do not switch/install in another agent's directory, reset their data, create worktrees or overwrite their services.
- C/D continue their existing learning-map work. They have no new Moss feature assignment; no new search UI, endpoint, database, model provider or shared contract is required.

## Desired behavior

On a keyword miss, retrieve up to three relevant skills from the student's current curriculum. Supply validated skill suggestions alongside the full canonical catalog to the existing Claude classifier. Claude chooses a concept or abstains. Existing policy chooses assistance; only actual quiz grading affects mastery. Pending quizzes retain precedence and keyword matches retain their fast path.

Index only concept name, mastery criteria and keywords with canonical IDs/tree/revision. Do not index student histories, transcripts, grades or tokens. Keep project credentials server-side. Verify SDK data flows before making locality/privacy claims; local index creation alone does not establish every network behavior.

Moss remains off by default in committed configuration. Enable it on the sponsor-demo machine with `USE_REAL_INTELLIGENCE=1`, `USE_MOSS_RETRIEVAL=1`, existing `MODEL_*`, and secure `MOSS_PROJECT_ID`/`MOSS_PROJECT_KEY` plus Claude credentials. Cold/stale/failed/slow retrieval falls back to the existing classifier. Missing native support or credentials must not break ordinary startup.

## Step 1 — parallel source review (A and B)

Read the reference branch's `docs/moss-handoff.md`, `docs/moss-live-results.md` and `docs/checkpoints/MOSS-runtime.md` using `git show`; no branch switch is needed to review.

**B reviews:** `packages/intelligence/src/{moss,retrieval,classify,config,index}.ts`, associated tests/harnesses and package dependency changes. Check native import isolation, canonical ID validation, per-tree semantic revision, query limits, cache behavior and unchanged keyword/abstention behavior.

**A reviews:** `apps/api/src/{index,intelligence}.ts`, `services/moss-runtime.ts`, tests and live harness. Check nonblocking startup, authoritative-store freshness before/after retrieval, reset/parse/edit/delete cases, pool capacity, backoff and resource disposal.

Both publish review findings in their own status files with exact reference SHA. A can finish review and test preparation while B implements. Existing A v4 cancellation/token/test correction work remains a separate prerequisite/hand-off; do not smuggle it into this feature. Moss does not repair those blockers.

## Step 2 — B implements the intelligence layer

Reuse/adapt the reference package code rather than rebuilding it. Import only B-owned files; do not cherry-pick cross-owner commits wholesale. Keep the native SDK optional and pinned as proposed; dynamic native import occurs only during explicit background preparation, never on ordinary module import.

Required checks:

1. Keyword hit never calls Moss or Claude. Keyword miss can receive at most three validated, deduplicated candidate IDs from the same curriculum.
2. Claude retains the full catalog and can return null, including when Moss returns results for unrelated prompts. No direct top-result routing or mastery changes.
3. One immutable semantic snapshot per classify request. Fingerprint includes tree/node IDs, names, mastery criteria and keywords; layout/progress changes do not invalidate it.
4. Per-instance cache invalidates same-ID semantic edits and does not leak between baseline/experiment instances. Preserve the useful cache fix even with retrieval disabled; document that this is an intentional default-path change.
5. Retrieval waiting fits within 200ms and the existing overall classification deadline. A timeout does not cancel a native operation: prevent overlapping query accumulation, release handles only after in-flight work settles, and keep fallback functional.
6. Test exceptions, timeouts, unavailable native SDK, cold/empty/stale results, unknown IDs, concurrent query/close and edit/delete/reset behavior at the appropriate layer.

Run package tests and workspace typecheck on the owned changes. If a package dependency changes, E reconciles the root lockfile; never bypass a frozen-install failure. B publishes **MOSS INTELLIGENCE READY** with commit, commands, results and default-off behavior. E reviews/merges B into `moss-integration` and prepares a consistent lockfile before A's runnable integration.

## Step 3 — A wires runtime after B's handoff

A merges E's B-ready `moss-integration` update into `agent/moss-platform`. Reuse/adapt only the reference API-owned files. Do not overwrite API fixes already present in the chosen base; reconcile lifecycle edits against the current loader and shutdown.

Required runtime behavior:

1. Fake mode never initializes Moss; credentials alone never enable it. Real mode requires the explicit flag and credentials. Missing/failed optional SDK degrades safely.
2. Background preparation starts without delaying HTTP availability. Never download/warm/index on the chat request path.
3. Keep the existing small pool cap; preparing and closing handles count toward it. Two-course/demo-first policy is acceptable for this hackathon if documented; other courses use baseline.
4. Compare authoritative semantic revision before and after queries. Edits/deletes/parse/reset must immediately prevent stale hints, even before the background refresh catches up. Back off retries and avoid unbounded queues.
5. The shared reconcile loop can stall behind permanently hung native preparation/disposal. For this scope, document that limitation, bound outstanding work and demonstrate baseline/API availability during the stall. Do not introduce a worker service or new infrastructure for the hackathon. Process isolation is a later improvement unless an actual crash/hang blocks the demo.
6. Stop polling on shutdown, safely dispose handles, and preserve database flush behavior. Review the reference's shared two-second shutdown cap: a slow native cleanup must not silently shorten persistence guarantees. Flag any necessary lifecycle correction rather than assuming the experiment is production-ready.
7. Use sanitized backend traces: enabled/disabled, warming, ready, retrieved/fallback reason, elapsed time and candidate count. No keys, prompts, student identifiers or provider error payloads. A per-request diagnostic correlation ID is acceptable if needed to prove that the demonstrated turn used retrieval.

Run API tests/typecheck, fake-backed smoke and transport regressions. Publish **MOSS API READY** with SHA, commands, limitations and mode. Report the known pre-existing upstream-stream failure separately until the corrected A v4 branch is integrated; do not xfail or weaken it.

## Step 4 — E integrates and checks default behavior

Merge **B → A** into `moss-integration`. Review ownership, source provenance and changes with the flag off. E adds/reconciles the proposed root environment documentation, relevant experiment docs and combined lockfile. No shared contract/version change is expected.

Run, sequentially where a backend is mutated:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build:ext
pnpm --filter @friction/dashboard build
pnpm exec tsx scripts/verify-chat-abort.ts
pnpm exec tsx scripts/verify-stream-failure.ts
pnpm smoke --url http://127.0.0.1:<private-api-port>
```

Use E's isolated store/private services; no two API processes against one JSON file. Repeat affected dashboard/API and extension/API regressions. If the final base includes corrected v4 API support, also require `pnpm smoke --require-v4` and C's rollout/token checks. Existing main's known v4 failures remain blockers for full-product acceptance and must be recorded distinctly from Moss regressions.

At integration checkpoints E spawns the independent read-only verifier specified in E's brief (agreed gpt-6.1-sol medium substitute if Sonnet 5.5 is unavailable). No further runtime changes until review findings are resolved or explicitly documented as release limitations.

## Step 5 — credentialed live validation and sponsor evidence

Use the existing credentialed demo machine or secure bindings. Do not paste credentials into chat, reports, the browser, or tracked files. A key-presence check is not a live pass.

1. Run the reference/adapted `pnpm --filter @friction/api moss:live` against its own memory store and ephemeral port. Capture exact code SHA, model configuration, warmup/query timings, actual returned candidate IDs and selected canonical concept. The current reference harness only asserts a nonempty candidate set; strengthen it to verify the expected concept is among the candidates for the chosen example.
2. Show a keyword-hit control with no Moss query, then a **fresh chat with no pending quiz** and a keyword-free example:
   > How do I share the selected theme with deeply nested descendants without passing it through every layer?
   Expect retrieval to include Context API and Claude to choose it. Retest the wording with the current curriculum; never hardcode a retrieval result or bypass the real path.
3. Show the existing teaching response and current level. Retrieval itself must not alter mastery or quotas. Display the existing learning map if available; no new UI is needed for sponsor proof.
4. Show an unrelated-message case: candidates may exist, but Claude must abstain. Separately demonstrate pending-quiz precedence and normal grading.
5. Inject Moss failure and a query timeout using test doubles; verify baseline fallback. Also check genuine missing credentials/native support without exposing provider errors. Separate injected-failure evidence from live-provider evidence.
6. Run smoke with real Claude and retrieval **off**, then **on**, against the exact integration revision. Warm the runtime before the on-mode demonstration and capture a retrieved trace: passing keyword-heavy smoke alone does not prove Moss usage.
7. Retain sanitized machine-readable artifacts and a short recording tying the actual prompt to retrieval and the resulting teaching response. Do not overwrite the only previous successful run; separate output directories per run. Repeated runs are operational verification, not proof of higher accuracy.

Sponsor claim: **"Moss connects students' everyday descriptions to the concepts in their course, helping Friction choose relevant teaching context."** Explain that Claude makes the final choice. Do not claim improved accuracy, token savings, historical student memory, guaranteed locality or sponsor eligibility beyond the evidence and published track rules.

## Step 6 — release decision and demo preparation

E reports B/A source SHAs, exact enabled/disabled results, independent findings, live artifacts and outstanding product blockers. Keep committed default off. On the sponsor-demo machine enable Moss explicitly and restart; verify ready/retrieved traces using the exact demonstration prompt. Roll back operationally by disabling the flag and restarting; main remains untouched while this branch is evaluated.

Only after the human directs the reviewed merge should E merge the feature into the intended release branch. If combining with `claude-skill-tree`, reconcile on a dedicated candidate and run iframe/consent/shared-backend checks; do not assume either feature's independent pass proves the combined product. Final real-Claude x3, six visual must-haves, rehearsals and recording remain required for full product acceptance.

## Agent messages

- **B:** "Use agent/moss-intelligence. Read this handoff; review/adapt experiment 8f8fe63 in your owned package, test, and publish MOSS INTELLIGENCE READY. Do not touch A/E files."
- **A:** "Use agent/moss-platform. Review the runtime in parallel now. Runnable API wiring waits for E's B-ready base/lockfile. Preserve separate v4 fixes; publish MOSS API READY with exact mode/evidence."
- **C/D:** "No new Moss UI or endpoint work. Continue isolated claude-skill-tree assignments; existing map can display the concept chosen by the normal intercept flow. Keep dashboard and extension pointed at the same backend during any later combined demo."
- **E:** "Integrate B then A on moss-integration, independently verify, execute credentialed evidence gates and report before any release/main merge."
