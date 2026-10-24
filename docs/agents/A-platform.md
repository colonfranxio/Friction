# Agent A: Platform (API)

You are **Agent A**, one of four Claude Code agents building **Friction** in parallel for a hackathon. You own the backend API. Speed and reliability matter more than elegance. Build the smallest thing that meets each checkpoint, then harden it.

## 0. Read first (in this order)
1. `AGENTS.md`: ownership and working rules (binding).
2. `PLAN.md`: the whole plan; your row in §5 and §6.
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

## 6. Tasks and exit criteria

### CP1 (target T+3h): every endpoint on fakes
- [ ] Hono server boots on 8787; `GET /health` returns `{ok, contract_version, mode:{intelligence:'fake', demo, server:'api'}}`
- [ ] JSON store seeds on first run and survives a restart
- [ ] All endpoints in `ENDPOINTS` implemented with the fakes, matching the mock's behavior
- [ ] SSE `/events` delivers `student_state`, `bypass`, `activity`, `tree_updated`
- [ ] **`pnpm smoke` passes against :8787** (`pnpm dev:api` in one terminal, `pnpm smoke` in another)
- [ ] Endpoint tests (`app.request`) cover: intercept happy path, pending-quiz precedence, stickiness, passthrough, bypass 409, edge cycle 409, demo reset, error shape

### CP2 (target T+8h): real intelligence
- [ ] `USE_REAL_INTELLIGENCE=1` uses `createIntelligence()` (once B is merged at CP1/CP2; until then it still returns fakes, which is fine)
- [ ] `/trees/parse` live path + demo cache both work; a non-demo PDF creates a new tree and moves the demo student to it
- [ ] `/chat` streams with headers and stores `llm_response`
- [ ] `pnpm smoke` passes with `USE_REAL_INTELLIGENCE=1` and a real `ANTHROPIC_API_KEY`

### CP3 (target T+14h): robust demo loop
- [ ] Late grade applied and pushed via SSE (test it with a slow fake: wrap `evaluateExchange` with a delay above the budget)
- [ ] Per-student mutex prevents double grading (test: two concurrent intercepts)
- [ ] Clear 400s for missing fields and 404s for bad IDs; no unhandled rejections crash the process
- [ ] Smoke passes 3× in a row on merged `main`

### CP4 (target T+20h): polish + freeze
- [ ] `/heartbeat` updates `last_seen_at` and emits `student_seen`
- [ ] Startup banner prints the URLs and mode; the README section in your status file explains how to run it

## 7. How to verify
```
pnpm dev:api                      # terminal 1
pnpm smoke                        # terminal 2, must print SMOKE PASSED
curl -N "localhost:8787/events?tree_id=33333333-3333-4333-8333-333333333333"   # watch events while smoke runs
pnpm --filter @friction/api test
pnpm typecheck
```

## 8. Interfaces with the other agents
- **B** gives you `createIntelligence(): Intelligence` (pure functions; no DB or HTTP). Treat it as possibly slow or failing: always pass budgets and catch errors. On a classify failure, treat it as no match. On a grade failure, keep the quiz pending and don't change the level.
- **C** (dashboard) and **D** (extension) use the shared client against your API. They're building against the mock now, so **your responses must be byte-compatible with the mock's.**
- If you think the contract needs something new, file a change request in your status file. Don't change shapes unilaterally.

## 9. When blocked
If an issue is outside your folder (shared types, scripts), write it in your status file under Blockers, work around it locally, and continue. Never edit files you don't own.
