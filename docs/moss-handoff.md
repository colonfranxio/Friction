# Moss retrieval: handoff for re-evaluation

**Branch:** `experiment/moss-retrieval` (based on `main` `544767f`; merges cleanly into `main` `d23cb63`, whose newer commits are docs-only).
**Status:** built, tested, live-verified, independently reviewed. **Not merged.** Off by default.
**Why it exists:** the human asked for a real Moss integration to qualify for the Cal Hacks "Best Use of Moss" track. It was not added to fix an accuracy problem, and it does not improve accuracy on the seed course (see [Evidence](#evidence)).

Who should read what:
- **E (Integrator):** [Decision for E](#decision-for-e), [Ownership note](#ownership-note), [Merge checklist](#merge-checklist).
- **A (Platform):** [How it differs from main](#how-it-differs-from-main) (API section), [Lifecycle](#runtime-lifecycle-api).
- **B (Intelligence):** [How it differs from main](#how-it-differs-from-main) (intelligence section), especially the [behavior changes when the flag is off](#behavior-changes-even-with-the-flag-off).
- **C, D:** nothing to do. No change to shared types, HTTP payloads, the dashboard or the extension.

---

## What it does

[Moss](https://docs.moss.dev) (`@moss-js/moss`, the Cal Hacks sponsor's semantic-search SDK) indexes each active course's skills: concept name, mastery criteria and keywords. When a student prompt matches **no keywords**, the API asks Moss for up to 3 candidate skills. The IDs of those candidates are added to the existing Claude classifier prompt as a **hint**. Claude still sees the full concept list and can still return null. Everything downstream is unchanged: node lookup, level, friction prompt, quiz, grading and progression.

```
main:        prompt → keyword match ──miss──► Claude classify (full catalog)  → policy
experiment:  prompt → keyword match ──miss──► Moss top-3 (≤200ms) ──hint──► Claude classify (full catalog) → policy
                                                  └─ cold / stale / error / slow → no hint (= main behavior)
```

Moss output is never used as mastery evidence, confidence, or an assistance decision.

## How it differs from main

### Intelligence package (`packages/intelligence`, B's area)

| File | Change |
|---|---|
| `src/retrieval.ts` (new) | `CurriculumRetriever` interface, `curriculumFingerprint(nodes)` (a hash of IDs, names, criteria and keywords), and the `within(promise, ms, fallback)` timeout helper. |
| `src/moss.ts` (new) | `MossCurriculumRetriever`: one Moss session per curriculum revision, at most one query running at a time, never logs SDK errors. `mossFromEnv(env)` returns null without credentials and **dynamically imports** the native SDK only when a session is first opened. |
| `src/classify.ts` | After a keyword miss: an optional retriever call capped at 200ms, a hint line added to the user message, and the Claude timeout reduced by the time retrieval took (the overall classify budget is unchanged). |
| `src/config.ts` | New optional `curriculumRetriever` option, plus a **per-instance** `classificationCache`. |
| `src/index.ts` | Exports `mossFromEnv`, `MossCurriculumRetriever`, `curriculumFingerprint`, `within` and `CurriculumRetriever`. |
| `package.json` | `optionalDependencies: { "@moss-js/moss": "1.21.0" }` (native module; install doesn't fail if the platform lacks it). Adds `moss:trial` script. |
| `harness/moss.ts`, `harness/moss-cases.ts` | Offline comparison harness: 23 cases, Moss-assisted vs. baseline. |
| `test/moss.test.ts` | Adapter tests: stale/cold index, invalid IDs, errors, timeouts, close races. |

#### Behavior changes even with the flag off

These apply to **every** real-intelligence run, so B should review them:
1. **Classifier cache:** it was a module-global map keyed by `prompt + sorted node IDs`. It is now per `createIntelligence()` instance and keyed by `prompt + curriculumFingerprint + candidates`. This fixes a real bug: after an educator edited a concept without changing its ID, main could return a stale cached classification.
2. **Node snapshot:** `classifyTopic` now copies the nodes at the start, because educator routes mutate the stored objects in place and one request should see a single consistent revision.
3. **Claude timeout:** now `LLM_TIMEOUT_MS − elapsed`. With no retriever, elapsed is about 0, so behavior is identical.

### API (`apps/api`, A's area)

| File | Change |
|---|---|
| `src/intelligence.ts` | `loadIntelligence(useReal, { store, env?, trace?, load? })` now returns `{ intel, start(), close() }` instead of a bare `Intelligence`. Moss is wired in only if `USE_REAL_INTELLIGENCE=1` **and** `USE_MOSS_RETRIEVAL=1` **and** both credentials are set. Fake mode returns before importing anything. |
| `src/index.ts` | The store is created **before** intelligence (the retriever reads it). `intelligence.start()` runs after the app is built. Shutdown runs `store.flush()` and `intelligence.close()` together, capped at 2s. |
| `src/services/moss-runtime.ts` (new) | `MossRuntime` (see [Lifecycle](#runtime-lifecycle-api)). Emits `[moss] {…}` trace lines. |
| `test/moss-runtime.test.ts` (new) | 18 tests through the real app: educator PATCH/add/delete, parse and new-course assignment, reset, pool capacity, query/prepare overlap, SDK failure, slow queries, shutdown during warmup. |
| `harness/moss-live.ts` (new) + `package.json` `moss:live` script, `tsconfig.json` includes `harness` | Paid live check (see [How to run](#how-to-run)). |

#### Runtime lifecycle (API)

- The server starts serving **immediately**. Indexing happens in the background (about 1.5s per course live).
- A 1s `unref`'d poll reads the authoritative store and re-indexes any course whose fingerprint changed. Changes to state, layout or progress don't trigger re-indexing.
- At most **two courses** are resident, with the demo student's course first. Courses still preparing or closing count toward the cap. Other courses use the baseline classifier.
- A query is answered only by a ready index whose fingerprint matches the curriculum in the request **and** the store, checked both before and after the query. Otherwise it returns no hint and emits `fallback/cold_or_stale`.
- Failures retry with backoff (up to 30s). Shutdown stops the poll immediately and closes native handles only after work in progress settles.

### Shared, dashboard, extension

**No changes.** No contract version bump and no new HTTP fields. Traces go to server stdout only.

### Ownership note

To keep the experiment in one branch, the human directed it to touch A's files (`apps/api/**`), B's files (`packages/intelligence/**`) and E's files (`README.md`, `.env.example`, `docs/**`, `pnpm-lock.yaml`). This doesn't follow the normal AGENTS.md ownership model, so E should treat it as a proposal branch, not a builder checkpoint.

## How to run

Prerequisites: the normal setup (`pnpm install`, `.env` with `ANTHROPIC_API_KEY` and `MODEL_*`), plus a Moss project from <https://docs.moss.dev> (ask the human for the team's credentials; never commit them).

```
git fetch origin
git checkout experiment/moss-retrieval
pnpm install                         # pulls @moss-js/moss (optional native dep)
```

Add to `.env`:
```
USE_REAL_INTELLIGENCE=1
USE_MOSS_RETRIEVAL=1
MOSS_PROJECT_ID=...
MOSS_PROJECT_KEY=...
```

| Goal | Command | Cost |
|---|---|---|
| Unit and integration tests (no network) | `pnpm typecheck` · `pnpm test` (or `pnpm --filter @friction/api test`) | free |
| Live end-to-end check: private port, in-memory store, doesn't touch :8787 or `db.json` | `pnpm --filter @friction/api moss:live` → `apps/api/harness/results/moss-live.json` | a few Claude calls |
| Moss vs. baseline classifier comparison (23 cases) | `pnpm --filter @friction/intelligence moss:trial` | up to ~46 Claude calls |
| Run the real API with Moss | `pnpm dev:api`, then use the sandbox at :5173 | normal |

**What to look for when running the API.** Within about 2s of start you should see:
```
[moss] {"state":"warming","revision":"3fc20bf603a5"}
[moss] {"state":"ready","revision":"3fc20bf603a5","ms":1551}
```
Then, in a **new** sandbox chat as the demo student, send a prompt with no keywords, for example:
> How do I share the selected theme with deeply nested descendants without passing it through every layer?

```
[moss] {"state":"retrieved","revision":"3fc20bf603a5","candidates":3,"ms":5}
[intercept] student=Alex Chen node="Context API" level=L2 ...
```
Prompts that match a keyword don't reach Moss, so they produce no `retrieved` line. That is expected.

**To disable:** set `USE_MOSS_RETRIEVAL=0` (or remove it) and restart. Behavior is then identical to main, apart from the [cache and snapshot fixes](#behavior-changes-even-with-the-flag-off).

Windows: verified on Windows 11. If `pnpm` isn't on PATH, see the cross-platform notes in AGENTS.md.

## Evidence

| Check | Result |
|---|---|
| Workspace typecheck | PASS |
| Tests | 218 PASS (API 75, intelligence 61, extension 35, shared 26, dashboard 9, scripts 12) |
| Live `moss:live` (run twice) | PASS: Moss ready in about 1.5s; 3 candidates in 5ms; Claude chose Context API; L2 reply with quiz; mastery unchanged. With an injected Moss init failure, the baseline still chose Context API and applied the friction prompt, with no Moss hints. |
| Offline trial ([moss-live-results.md](moss-live-results.md)) | An acceptable skill was in Moss's top 3 for 19/19 relevant prompts. Warm retrieval p50 31ms, p95 105ms. Moss also returned candidates for unrelated prompts, so it can't decide alone. **Both pipelines were correct on all 21 cases where both returned a result**; the baseline's 2 misses were provider errors. |
| Independent verifiers | PASS at all three checkpoints ([checkpoints/MOSS-runtime.md](checkpoints/MOSS-runtime.md)). |

**Honest summary:** Moss works, is fast, and does real work in the request path. On the 8-skill seed course it doesn't change any decisions, because the keyword classifier plus Claude already handle these cases. Any benefit would show up with large or real syllabi, which is untested.

## Open questions and known gaps

1. **Value vs. risk:** it's a sponsor-track integration that adds a native dependency and a background loop to the API. Is that worth it for the demo?
2. **Demo story:** the `[moss]` lines are server logs only. Showing judges anything in the UI would need a contract change (out of scope here).
3. **Live harness proves usage, not influence:** it checks that Moss returned candidates, not that the correct node was among them or that the hint changed Claude's choice. The baseline gets the same answer.
4. **Pool limit:** two resident courses. A third active course silently uses the baseline.
5. **No student-history retrieval:** only curriculum is indexed. The earlier idea of retrieving past misconceptions or evidence was deliberately left out (privacy, and the store has no such data model).
6. **Lockfile:** `pnpm-lock.yaml` changed. Resolve conflicts the usual way (`git checkout --theirs pnpm-lock.yaml && pnpm install`).

## Decision for E

Recommended options, in order:
- **(a) Keep it on the branch** and demo from it only for the Moss judging. Zero risk to main.
- **(b) Merge with the flag off by default.** Main gains the cache and snapshot fixes, and Moss is turned on only for the sponsor demo. B should review `classify.ts` first, and A should review `index.ts` and `intelligence.ts`.
- **(c) Don't merge**, but cherry-pick the classifier-cache fix (`config.ts` and the cache-key part of `classify.ts`) because it fixes a real stale-classification bug.

### Merge checklist
- [ ] B reviews `packages/intelligence/src/{classify,config,moss,retrieval}.ts`
- [ ] A reviews `apps/api/src/{index,intelligence}.ts` and `services/moss-runtime.ts`
- [ ] `pnpm install && pnpm typecheck && pnpm test` on the merge result
- [ ] `pnpm smoke` against the real API with the flag **off** (expect no regressions), then with it **on**
- [ ] `pnpm --filter @friction/api moss:live` passes
- [ ] Changelog entry (no contract version bump needed)

Related docs: [moss-feasibility.md](moss-feasibility.md) · [moss-live-results.md](moss-live-results.md) · [moss-runtime-plan.md](moss-runtime-plan.md) · [checkpoints/MOSS-runtime.md](checkpoints/MOSS-runtime.md)
