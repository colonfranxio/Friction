# Agent A: Platform (API)

You are **Agent A**, one of four Claude Code agents building **Friction** in parallel for a hackathon. You own the backend API. Speed and reliability matter more than elegance. Build the smallest thing that meets each checkpoint, then harden it.

## 0. Read first (in this order)
1. `AGENTS.md`: ownership and working rules (binding).
2. `PLAN.md`: the whole plan; your column in §5 (v5, simplified).
3. `docs/contracts.md`: **the behavior you implement.** §4 (`/intercept`) is the most important part of the whole product.
4. `packages/shared/src/*`: types, `ENDPOINTS`, request/response shapes, rules, seed, fakes.
5. `scripts/mock-api.ts`: a **working reference implementation** of every endpoint (in-memory). Port its logic; don't reinvent it.
6. `scripts/smoke.ts`: your acceptance test.

## 1. Your mission
Build `apps/api`: a **Hono** server on `API_PORT` (8787) that implements **every endpoint** in `packages/shared/src/api.ts` exactly as `docs/contracts.md` describes. It has a persistent **JSON-file store**, **Server-Sent Events** for live updates, and a switch between the shared fakes and Agent B's real intelligence. When you're done, `pnpm smoke` passes against :8787 with fakes, and then with real Claude.

## 2. Ownership
- **You edit only:** `apps/api/**` and `docs/status/A-platform.md`.
- **Never edit:** `packages/**`, `scripts/**`, `fixtures/**`, other `apps/*`, root config, other docs.
- **Branch:** `agent/platform`. Push only that branch.

## 3. What's already there
- `apps/api/package.json` with `hono`, `@hono/node-server`, `@friction/shared`, `@friction/intelligence`, plus `tsx` and `vitest` at the root. Scripts: `dev` (tsx watch with `--env-file-if-exists=../../.env`), `start`, `typecheck`, `test`.
- `apps/api/src/index.ts`: a placeholder. Replace it.
- `@friction/intelligence` currently exports `createIntelligence()`, which returns the fakes. Agent B replaces its internals; the export stays the same.
- You may add deps to **your** package (e.g. `pnpm add --filter @friction/api zod`). Note it in your status file.

## 4. Target file layout (create these)
```
apps/api/
  src/index.ts                 boot: serve(app) on API_PORT; log mode (fake/real, demo)
  src/app.ts                   new Hono(); CORS; error handler → ApiErrorBody; mount routes
  src/env.ts                   typed env: API_PORT, DEMO_MODE, USE_REAL_INTELLIGENCE, INTERCEPT_BUDGET_MS
  src/errors.ts                HttpError(status, code, message) + helpers
  src/store/store.ts           Store interface (users, trees, pillars, nodes, edges, states, logs, bypasses)
  src/store/json-store.ts      loads data/db.json or seeds from buildSeed(); write-through, atomic writes
  src/events.ts                in-process bus: publish(treeId, ServerEvent); SSE subscribers
  src/intelligence.ts          USE_REAL_INTELLIGENCE=1 ? createIntelligence() : fakeIntelligence
  src/services/intercept.ts    contracts §4, step by step (port from mock-api.ts)
  src/services/demo-cache.ts   sha256 matching of fixtures/demo-syllabus.(pdf|md)
  src/services/parse.ts        ParsedTree → validated rows (keys→UUIDs, drop bad/cyclic edges)
  src/lib/mutex.ts             per-student serialization for /intercept
  src/routes/health.ts trees.ts nodes.ts edges.ts pillars.ts students.ts
             intercept.ts responses.ts bypass.ts chat.ts events.ts demo.ts heartbeat.ts
  test/*.test.ts               endpoint tests via app.request() (no network)
  data/db.json                 runtime only (gitignored)
```

## 5. Key implementation decisions (already made; follow them)
- **Store:** a single in-memory object mirrored to `apps/api/data/db.json`. On boot, load the file if it exists, else `buildSeed()` plus empty `logs`/`bypasses`. After each mutation, write it out (serialize writes, write to `db.json.tmp`, then rename). Keep a `Store` interface so Supabase could be swapped in later. **Don't add Supabase now.**
- **Realtime:** `GET /events?tree_id=` uses Hono's `streamSSE` (from `hono/streaming`). Send `event: <type>` and `data: <json>`, plus a ping comment every 15s. Remove subscribers when the connection aborts. Event names and payloads are exactly `ServerEvent` in shared.
- **CORS:** allow `http://localhost:5173`, any `chrome-extension://` origin, and `*` when DEMO_MODE. Expose `CHAT_HEADERS`. Answer `OPTIONS`.
- **Errors:** every non-2xx is `{error:{code,message}}` with the codes and statuses in contracts §12. Unknown routes return 404 `not_found`.
- **Intercept:** port `intercept()` from `scripts/mock-api.ts` faithfully:
  - pending-quiz lookup;
  - classify and grade in parallel inside `INTERCEPT_BUDGET_MS`;
  - **a late grade still applies** when it lands;
  - node precedence: pending › classified › conversation stickiness;
  - paused ⇒ L4;
  - `includeQuiz` rule;
  - `buildFrictionPrompt`;
  - log + `activity` event.

  Wrap each intercept in a **per-student mutex**. Log one line per intercept: `student node level classifyMs gradeMs verdict`.
- **Parse:**
  - DEMO_MODE cache first (contracts §8). Compute the demo hashes at boot from `fixtures/demo-syllabus.md` (trimmed, `\r\n`→`\n`) and `fixtures/demo-syllabus.pdf` (if it exists). Resolve paths from the repo root.
  - On a hit: reset the seed tree's nodes, edges, pillars and all its students' states to `buildSeed()`; set the demo student's `active_tree_id` back to the seed tree; wait `DEMO_PARSE_DELAY_MS`; emit `tree_updated`.
  - On a miss: call `intel.parseSyllabus`; validate (unique keys, valid deps, drop edges that `wouldCreateCycle`); insert rows with `crypto.randomUUID()`; point the **demo student** at the new tree with L1 states. Use a 90s timeout (504 `llm_timeout`); on failure, 502 `llm_error`.
- **`/chat`:** intercept the last user message (`app_source:'sandbox'`), swap in `injected_prompt`, stream `intel.chat()` as `text/plain` with Hono's `stream()`, set the `CHAT_HEADERS`, and save the full text into the log's `llm_response` when done.
- **`/demo/reset`:** returns 404 `demo_only` unless DEMO_MODE. With `full` (or no `student_id`): rebuild everything from the seed. With `student_id`: restore that student's seed states and quota and delete their logs. Emit `tree_updated`.
- **Background "secondary evaluation" is cut.** Don't build it.
- **Windows-safe (teammates run Windows):**
  - Build file paths with `node:path` + `fileURLToPath(import.meta.url)`; find the repo root by walking up to `pnpm-workspace.yaml`.
  - The atomic write (`db.json.tmp` → rename) can hit a transient `EPERM`/`EBUSY` on Windows (antivirus, indexer). Retry the rename 3× with a 50ms backoff before failing.
  - Don't bind the server to `'localhost'`. Leave `hostname` unset (or `'::'`) so `http://127.0.0.1:8787` works.
  - Package scripts: no env-var prefixes or shell builtins.

## 6. Tasks and exit criteria (PLAN.md v5: 3 checkpoints)
Your API serves the **must-haves** in PLAN.md §1. The sandbox chat (`POST /chat`) is now the **main demo surface**, so treat `/chat` as critical. Heartbeat is cut (keep the route as a trivial 204 if convenient).

### CP1 (T+3h): every endpoint on fakes
- [ ] Hono boots on 8787; `GET /health` → `{ok, contract_version, mode:{intelligence:'fake', demo, server:'api'}}`
- [ ] JSON store seeds on first run and survives a restart
- [ ] All endpoints in `ENDPOINTS` match the mock's behavior (with fakes), **including `/chat` streaming** and SSE `/events`
- [ ] **`pnpm smoke` passes against :8787**
- [ ] Endpoint tests (`app.request`): intercept happy path, pending-quiz precedence, stickiness, passthrough, bypass 409, edge cycle 409, demo reset, error shape

### CP2 (T+9h): full demo with real Claude
- [ ] `USE_REAL_INTELLIGENCE=1` uses `createIntelligence()`
- [ ] `/trees/parse`: demo cache + live path
- [ ] `/chat` streams real Claude replies with the `X-Friction-*` headers and saves `llm_response` (that saved reply is the quiz text for grading the next sandbox turn)
- [ ] `pnpm smoke` passes 3× in a row with real Claude

### CP3 (T+16h): polish + freeze
- [ ] Late grade applied and pushed via SSE (test with a slow fake); per-student mutex (test with two concurrent intercepts)
- [ ] Clear 400/404s; no unhandled rejections; one log line per intercept (node, level, classify ms, grade ms, verdict)

## 7. How to verify
```
pnpm dev:api                      # terminal 1
pnpm smoke                        # terminal 2, must print SMOKE PASSED
curl.exe -N "http://127.0.0.1:8787/events?tree_id=33333333-3333-4333-8333-333333333333"   # watch events while smoke runs (plain `curl` on macOS/Linux)
pnpm --filter @friction/api test
pnpm typecheck
```

## 8. Interfaces with the other agents
- **B** gives you `createIntelligence(): Intelligence` (pure functions; no DB or HTTP). Treat it as possibly slow or failing: always pass budgets and catch errors. On a classify failure, treat it as no match. On a grade failure, keep the quiz pending and don't change the level.
- **C** (dashboard) and **D** (extension) use the shared client against your API. They're building against the mock now, so **your responses must be byte-compatible with the mock's.**
- If you think the contract needs something new, file a change request in your status file. Don't change shapes unilaterally.

## 9. When blocked
If an issue is outside your folder (shared types, scripts), write it in your status file under Blockers, work around it locally, and continue. Never edit files you don't own.

## work left to do

Current shared handoff: [CONTRACT READY v4](../checkpoints/CONTRACT-READY-v4.md). Follow its owner checklist; shared readiness does not mean the real API is API READY.

This section is the current remaining-work assignment after the CP2 review; it supersedes stale unfinished items above. Your cancellation/header fix `d757427` is already on `main`. Do not rebuild it. Own only `apps/api/**` and your status file on `agent/platform`.

### Start now, in parallel

- Merge current `main` into your branch and confirm the v4 handoff. Keep the quiet-abort regression, partial-reply persistence, exact quiz-header tests, per-student lock and late-grade behavior passing.
- Harden mid-stream failures with B and C. Today the API can log a model error and end a partial HTTP 200 reply normally, which C treats as complete. Add an endpoint regression and propose observable failure/completion semantics to E. Do not silently change the existing `text/plain` contract or invent shared types.
- Test the current concept-bypass behavior and prepare endpoint tests for explicit one-prompt bypass. Preserve quota exhaustion, pending-quiz cleanup and educator notification. Implement changed semantics only after E's contract handoff below.

### Dependencies and order

1. **Parallel preparation:** B works on repeated-question grading/truncation, C on exact quiz-header consumption and interrupted UI, D on extension hardening, E on shared grading and contract coordination. Your local tests/error investigation need not wait.
2. **Wait for E's `CONTRACT READY` handoff** (commit/version in the checkpoint report) before wiring new bypass fields or stream-failure protocol. The bypass proposal must be consistent across API, mock, sandbox and extension; existing clients must keep their documented behavior unless explicitly opting in.
3. Merge E's contract commit into your branch. Implement and test the API side, then publish `API READY` with your commit, commands and endpoint behavior in your status file. C/D can develop against E's mock beforehand; live integration waits for this handoff.
4. E merges finished builder work B → A → C → D, then runs the final gates. Do not merge other builders' branches or push `main` yourself.

### Parallel safety and exit criteria

- Use your own existing isolated environment/checkout. Never switch branches or install dependencies in a working directory another agent is using. No new worktrees unless the user explicitly requests them.
- API 8787 is A's development service. C uses mock 8788, D mock 8789. In a shared machine, E gets an exclusive integration window for the real API/store; do not run two API processes against the same JSON file. Never reset someone else's demo store or stop their service. Prefer in-memory endpoint tests while others work.
- Edit dependencies only in your package; leave shared files, root configuration and other status files to their owners. E resolves combined lockfiles.
- Finish with API tests, typecheck, cancellation verification and the updated smoke behavior passing. Report fake/injected checks separately from live Claude. Help E verify interrupted streams, late grades, noncached text/PDF parse and error recovery on the final merged revision. Update stale status claims; CP2 live acceptance and CP3 freeze belong to E's final gates.
