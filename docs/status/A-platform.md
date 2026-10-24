# Status: Agent A (platform)

**Owned by Agent A. Only this agent edits this file.**

- Contract version confirmed: **4** (CONTRACT READY v4 read; see "API READY (contract v4)"). Earlier: **3** (changelog v3 read: optional `X-Friction-Quiz-Attached` chat header; no existing field changed; v2 late-grade/cancel rules unchanged). Merged `origin/main` 457e0a7 (CP2 integration) into this branch. Previously confirmed v2 below.
- Contract version (earlier note): **2** (changelog v2 read: optional `EvaluateInput.signal`; no HTTP shape change; I never abort grading at the intercept budget, so late grades still apply). Merged `origin/main` 355fcac (CP1 integration) on top of CP1.
- Current checkpoint: CP1 and my CP2 fix are on `main` (PR #1 merged). CP2 live acceptance belongs to E. I'm on the "work left to do" list; see that section.
- Last updated: 2026-10-24 (merged `main` 999db80 into this branch; E's 16-step smoke passes 3x against :8787 on fakes)

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

## CP2 progress (T+9h): full demo with real Claude
- [x] `USE_REAL_INTELLIGENCE=1` uses `createIntelligence()` (dynamic import in `src/intelligence.ts`; `/health` reports `intelligence:'real'`; boot warns if `ANTHROPIC_API_KEY` is missing). Only B's CP1 pieces (keyword classify, templates, real `evaluateExchange`) exist on `origin/agent/intelligence` (01cb60e); its `parseSyllabus` and `chat` are still the shared fakes there, so nothing real is wired through them yet.
- [x] `/trees/parse`: demo cache + live path. Demo hash matcher now has direct tests (text with CRLF/LF/whitespace, PDF bytes, no fixtures, and the repo's real `fixtures/demo-syllabus.md`). Live path tests cover validation, cycle/dangling-edge dropping, demo student moved to L1, 502/504.
- [x] `/chat`: streams with `X-Friction-*` headers and saves `llm_response`; a test shows the saved reply is the `quiz_text` used to grade the next sandbox turn (E asked for this: the smoke can't prove it).
- [x] E's 16-step `pnpm smoke` (sandbox chat, live SSE, educator privacy) passes 3 times in a row against :8787 with fakes.
- [x] **`pnpm smoke` 3x in a row with real Claude, all 16 steps**, on a throwaway local merge of `origin/agent/intelligence` (00a5d4d: real parse, streaming chat, LLM classify) into this branch. Not pushed; E does the real merge. Real-model steps: grade 2.2-3.2s (budget 4s; none late), sandbox L1 chat 3-5s, sandbox L4 turns 11-15s (full answers streaming).
- [x] Live parse of a non-demo syllabus: 200 `cached:false` in ~24s, valid pillars/nodes/edges (no cycles or dangling), valid icons, demo student moved to the new tree with L1 states. Garbage PDF/base64 → clean 502 `llm_error` in <0.3s, server stays up.
- [x] `/chat` with real Claude: Socratic L1 reply, `X-Friction-*` headers, `llm_response` saved byte-equal to the streamed text, next answer graded against it (`verdict=correct`, L1→L4).
- [x] Independent verification (Sonnet, medium) of the above on the throwaway merge: all four CP2 criteria PASS, no blockers. Its findings and what I did:
  - Quiz left pending when `/chat` failed before streaming, was cut off, or returned an empty reply (the student never saw the check question) → **fixed**: `routes/chat.ts` closes that turn's quiz in those cases; test covers all three.
  - Not changed, FYI: level-4/answer turns take 11-14s to first byte (model/B, under the 30s timeout); `/demo/reset {full:true}` drops parsed trees (intended: back to the seed); 502 `llm_error` messages include the upstream error text.
  - Not verified live: a late grade (>4s) and the 504 timeouts (covered by unit tests with fakes), a valid PDF parse, client abort mid-stream.
- [x] Quiz-attachment header (`X-Friction-Quiz-Attached`): emitted by real `/chat` (see re-submission above).
- Note for E/B (from CP1-preflight item 1): I never abort `evaluateExchange` at the intercept deadline; late grades keep running and apply. If `EvaluateInput.signal` is adopted, I'll pass a signal that is only aborted on server shutdown.

### CP2 re-submission: E's blocking findings (docs/checkpoints/CP2.md), both done
- [x] **Cancellation defect fixed** (`apps/api/src/routes/chat.ts`): B's `chat()` ends quietly when its signal aborts, so a normal loop exit wasn't proof the reply was fully delivered; completion is now `!abort.signal.aborted`. An interrupted reply keeps its partial text and closes the unseen quiz. `pnpm exec tsx scripts/verify-chat-abort.ts` (E's repro, in-memory app + B's real factory with an injected SDK stream) now prints PASS. New endpoint regression uses B's quiet-abort behavior (generator returns without throwing when the signal aborts, client cancels the reader); I checked it **fails with the old `complete = true` and passes with the fix**.
- [x] **Quiz header (contract v3)**: real `/chat` now sends `X-Friction-Quiz-Attached: true|false` from `ic.quiz_attached` (exact boolean string; `false` for L4 and no-match turns). It's covered by the existing CORS expose list (`Object.values(CHAT_HEADERS)`). Test: question → `true`, graded-correct L4 turn → `false`, off-topic → `false`, header exposed.
- [x] Checks after the fix, on merged `main` + this branch: `pnpm typecheck` clean; `pnpm test` all green (shared 18, intelligence 39, extension 35, dashboard 3, API 55, scripts 3); **real-Claude `pnpm smoke` 3 runs in a row, 16/16 each** (`intelligence=real`, `.env` configured on this machine, no late grades or errors in the server log).
- [ ] Not independently re-verified by a separate agent this round (small, test-backed change); E's rerun of the abort repro is the gate.

### Waiting on others for CP2
- E: merge B (00a5d4d) then A. `agent/platform` alone still has the placeholder `createIntelligence()`, so CP2 criteria 2-4 only pass on the merged result.
- E/C: the exact quiz-attachment chat header (`X-Friction-Quiz-Attached`) is queued for CP2 in shared/mock (E), then API (A) and dashboard (C). I'll add it to `/chat` and its test when the contract lands.

## API READY (contract v4): observable stream failure + prompt-scoped bypass
Merged `main` 836784c (CONTRACT READY v4 commit `a11c16a`); contract **v4 confirmed**. Implemented in `apps/api/**` only. Fake/injected checks and one real-Claude smoke are reported separately below.

**Stream failure.** `/chat` now returns a native `ReadableStream` body (`highWaterMark: 0`, so no read-ahead and nothing queued is lost). Before the first chunk nothing changed: 502 `llm_error` / 504 `llm_timeout`, quiz closed. After streaming starts, a generation error/refusal/truncation **errors the body** (`controller.error`), so the client's `reader.read()` rejects; it is not a clean EOF and no JSON is appended. The partial text is saved as `llm_response` and the unseen quiz is closed. A client cancel is distinct: it aborts the model, keeps the partial, closes the quiz. A normal end while the signal is aborted (B's quiet end) still counts as incomplete. Headers and `text/plain` are unchanged.

**Prompt bypass.** `POST /bypass` takes optional `scope: 'concept' | 'prompt'` (omitted = `concept` = the legacy pause-until-reset and repeat-charge behavior, unchanged).
- `prompt`: spends one quota, closes pending quizzes on that node, emits the usual `student_state` + `bypass` events; does not set a pause, undo an existing one, or touch mastery.
- Unknown scope, or `raw_prompt`/`conversation_id` without prompt scope, or only one of the two, or an empty value → 400 before anything is charged. Empty quota → 409, no token.
- With `scope:'prompt'` + `raw_prompt` + `conversation_id`, the response also carries opaque `prompt_bypass_token` (UUID, in memory, 120s TTL, bound to student, node, exact text and chat). Charged at issue only.
- `POST /chat` with `prompt_bypass_token` and the matching last user message validates and consumes the token in one synchronous step, before any model call: replay, expiry, wrong student/text/chat, unknown/non-string token, or an invalidated tree/node → 400 `bad_request`; a mismatch does **not** consume the valid token. A valid token streams that turn as **L4, `X-Friction-Quiz-Attached: false`, not graded, mastery unchanged**, logs a safe activity row (no raw text or token in any educator event), and saves the reply normally. The next ordinary turn has normal friction. A failure or cancel never refunds or re-arms the token.
- Reset (full or that student's) and any parse (demo cache or live) drop the affected tokens; another student's reset does not. A server restart discards all tokens.

**Verify (exact commands).**
```
pnpm typecheck
pnpm --filter @friction/api test                  # 72 tests, no network
pnpm exec tsx scripts/verify-stream-failure.ts    # E's real-HTTP regression: PASS
pnpm exec tsx scripts/verify-chat-abort.ts        # PASS
pnpm dev:api   (terminal 1)   then   pnpm smoke --require-v4   (terminal 2)
```
Results on this machine: typecheck clean; root `pnpm test` all green (API 72); both standalone tools PASS; `pnpm smoke --require-v4` **17/17** against :8787 (`intelligence=real` because this machine's `.env` is configured; ran once, not 3x; no late grades or errors seen). Mutation check: with token consumption removed, the replay, concurrent-replay and failed-model tests fail. Tests added: v4 rejected-read regression (replaced the old clean-EOF pin), and a 14-case `prompt-scoped bypass` suite (legacy scope, prompt scope, concept-pause preserved, validation/409, one-use turn incl. no grading/mastery/pause, replay, concurrent replay, mismatches not consuming, expiry with an injected clock, failed-model no re-arm, reset/parse/other-student reset, privacy, failure on a token turn).

Independent review (Sonnet 5.5, medium, read-only, on d52e791): reran typecheck, API 72/72 and both standalone tools (PASS); no blockers or should-fix findings across chunk loss, token double-spend/burning, scope semantics, legacy defaults and leaks. It wrote no new probing tests, so its findings are source reading plus those runs. Three minor notes, none changed: (1) a reset landing between token consume and the lock yields a 400 with the token spent (no refund, by design); (2) with no read-ahead the server learns a reply finished only on the client's next read, so a client that cancels right after its last chunk takes the cancel path (full text still saved, quiz closed); (3) an empty reply still sends `X-Friction-Quiz-Attached: true` though the quiz is closed (the mock does the same).

Not verified: a real-Claude 3x gate (E's), the dashboard/extension using the new fields (C/D), a browser run, a valid PDF parse. One API test failed once in a full run and passed in 11 reruns (full suite 3x, the bypass suite 8x); I could not reproduce it, so treat it as unexplained.

## Work left to do (brief §"work left to do", after the CP2 review)
Merged `main` ff25700 (PR #1 `d757427` is on `main`); contract still **v3**, confirmed. API tests 57, typecheck clean.
- [x] Quiet-abort regression, partial-reply persistence, exact quiz-header tests, per-student lock and late-grade tests all still pass.
- [x] Mid-stream failure: endpoint regression added (`current behavior: a mid-stream model failure ...`). It pins what happens today: the model throws after some text, the response still ends as a normal `200 text/plain` with the partial text, the partial is saved as `llm_response`, the quiz is closed, and the error is only logged. A client can't tell this from a complete reply.
- [x] Concept-bypass: added a test of today's semantics (the node stays paused for every later prompt; a repeat bypass on a paused node is accepted and costs another quota). Existing tests already cover quota exhaustion (409), pending-quiz cleanup and the educator activity/toast event.
- [x] E's `CONTRACT READY` v4 arrived (`a11c16a`); both items are implemented and published as **API READY** above.

### Proposal to E: observable mid-stream failure (not implemented; nothing on the wire changed)
Keep `text/plain` and the three required headers. When the model fails *after* streaming started, abort the HTTP response (end it with a connection error instead of a clean chunked terminator), so `fetch`'s body reader rejects. A client that reads to a clean end can then treat that as complete; a rejected read is "interrupted". It needs no new header or body format, and the partial text stays saved. Alternative if E wants it explicit: an opt-in trailer or header set only on failure. Client-side effect for C: an interrupted read must show the "interrupted" UI and not a finished reply. Needs E's go-ahead since the cancellation semantic is shared with the extension.
Proposal for one-prompt bypass: a new optional request field (for example `scope: 'prompt'`) with the existing concept-level behavior as the default when absent, so existing clients keep working.

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
