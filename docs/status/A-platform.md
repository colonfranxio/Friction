# Status: Agent A (platform)

**Owned by Agent A. Only this agent edits this file.**

- Contract version confirmed: 1 (PLAN.md v5, merged from `origin/main` at 688d316 before starting)
- Current checkpoint: CP1 done, pending verification and merge by E. Not started on CP2.
- Last updated: 2026-10-24

## Exit criteria: CP1 (T+3h): every endpoint on fakes
- [x] Hono boots on 8787; `GET /health` → `{ok, contract_version, mode:{intelligence:'fake', demo, server:'api'}}`. Verified with `curl.exe` against `pnpm dev:api`/`start`.
- [x] JSON store seeds on first run and survives a restart. `apps/api/data/db.json` is created at boot; test "seeds on first run and survives a restart" writes, re-opens a second store from the same file, and checks quota, logs and bypasses. Corrupt files are moved aside and reseeded.
- [x] All endpoints in `ENDPOINTS` match the mock with fakes, including `/chat` streaming and SSE `/events`. Every route in `scripts/mock-api.ts` is implemented. `/chat` checked with `curl.exe -i` (text/plain, `X-Friction-*` headers, streamed body); SSE checked with `curl.exe -N` while a bypass fired (`student_state` then `bypass` events, plus `: connected` and `: ping` comments).
- [x] `pnpm smoke` passes against :8787 (11/11, "SMOKE PASSED").
- [x] Endpoint tests (`pnpm --filter @friction/api test`, 47 tests via `app.request`): intercept happy path, pending-quiz precedence, stickiness, passthrough, bypass 409, edge cycle 409, demo reset (full, per-student, `demo_only`), error shape (404/400/500), plus parse (cache, live, 502/504), chat, CORS, heartbeat, store.
- [x] `pnpm typecheck` clean across the workspace.

### Early CP3 items (cheap, already in)
- [x] Late grade applies when it lands and is pushed over SSE (test uses a slow `evaluateExchange` above a 40ms budget).
- [x] Per-student mutex (`src/lib/mutex.ts`); two concurrent intercepts call `evaluateExchange` once.
- [x] One log line per intercept: `[intercept] student=… node="…" level=L1 classify=Xms grade=Yms verdict=… total=Zms`.

### Verifier findings (independent Sonnet review of a18b874), all fixed
- SSE: a client reconnecting within 15s lost its subscription (the old connection's late `unsubscribe()` deleted the new client's entry). `EventBus.subscribe` now returns an idempotent unsubscribe that only removes its own set. Tests: bus-level and a real `GET /events` stream.
- A grade landing after a demo reset published stale `student_state`/`activity` events and wrote to orphaned rows. `/intercept` now bails out (passthrough) or skips the late apply when its captured log/state are no longer in the store. Four tests (in-budget and late, per-student and full reset).
- `/chat` now intercepts the last *user* message even if an assistant message trails it, like the mock (400 only when there's no user message).
- Added tests: bypass closes a pending quiz, SSE stream.
- Known gaps: the PDF demo-hash path is untested (no `fixtures/demo-syllabus.pdf` yet); SIGTERM on Windows doesn't flush the store (SIGINT does), and writes are already write-through so the window is tiny.

## Not done yet
- CP2: `USE_REAL_INTELLIGENCE=1` is wired (dynamic import of `@friction/intelligence`'s `createIntelligence()`), but B's real implementation isn't merged, so it still returns the fakes. Live-parse and `/chat` against real Claude are untested.
- CP3 polish items beyond the ones above.

## Change requests (contract)
None.

## Dependency changes
None. (`hono` and `@hono/node-server` were already in `apps/api/package.json`.)

## Assumptions
- `DEMO_MODE` defaults to **on** when unset (matches the mock and what `pnpm smoke` needs). `0`/`false` turns it off.
- `POST /heartbeat` is kept as a cheap route (204 + `student_seen`), though it's cut from the MVP.
- DEMO cache hit resets the seed tree, all seed students' states/quota and the logs/bypasses on seed nodes; parsed (non-seed) trees are left alone. `POST /demo/reset {full:true}` rebuilds everything from the seed, like the mock.
- Extra validation beyond the mock (only on bad input, valid requests behave the same): `POST /trees/:id/nodes` and `PATCH /nodes/:id` reject a `pillar_id` from another tree, a bad `required_blooms_level` or `size`; `POST /edges` rejects a self-edge with 409 `cycle`; `PATCH /nodes/:id` ignores fields outside the node's editable set.
- `/chat` pulls the first model chunk before sending headers so a failing model becomes a clean 502 `llm_error` (or 504 `llm_timeout` after 30s) instead of a broken stream. Mid-stream failures end the stream and keep the partial text as `llm_response`.
- A grade that misses the budget blocks a second grade of the same quiz while it's running (so two fast sends can't double-grade); the later message is still logged and gets a normal turn.
- `/bypass` takes the same per-student lock as `/intercept`.

## Blockers / needs from the human
- `ANTHROPIC_API_KEY` is needed in a local, gitignored `.env` for CP2.

## How to run and verify my part
```
pnpm install
pnpm dev:api                      # terminal 1: Friction API on http://127.0.0.1:8787, prints mode and store path
pnpm smoke                        # terminal 2: must print SMOKE PASSED
curl.exe -N "http://127.0.0.1:8787/events?tree_id=33333333-3333-4333-8333-333333333333"   # watch SSE while smoke runs
pnpm --filter @friction/api test  # 47 tests, no network
pnpm typecheck
```
Env (all optional): `API_PORT` (8787), `DEMO_MODE` (on), `USE_REAL_INTELLIGENCE` (off), `INTERCEPT_BUDGET_MS` (4000), `DEMO_PARSE_DELAY_MS` (3000).
To start from a clean store, stop the server and delete `apps/api/data/db.json` (or call `POST /demo/reset {"full":true}`).
