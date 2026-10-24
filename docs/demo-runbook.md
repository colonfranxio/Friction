# Friction demo runbook

For the pre-freeze v4 rollout, see [CONTRACT READY v4](checkpoints/CONTRACT-READY-v4.md). Its new stream-failure regression and prompt/token bypass gates must pass before v4 API READY. The v3 demo/evidence below does not certify those new behaviors; keep the legacy concept bypass until clients and API are coordinated.

Current state: [C's CP3 dashboard is integrated](checkpoints/CP3.md). A's new v4 API is held for an intermittent test assertion; current real API still uses legacy concept bypass and cannot expose mid-stream model failure to the reader. Leave `VITE_PROMPT_BYPASS_API_READY_SHA` unset until E verifies A's corrected merge. C supports exact quiz headers and guarded mock prompt bypass. The CP2 live gate remains open: see [checkpoints/CP2.md](checkpoints/CP2.md). Builders' reported local real-Claude runs remain external evidence.

## Prepare

Use the existing isolated checkout, not a new worktree. Read `AGENTS.md` and the contract changelog (v4). Node >=22.9 and pinned pnpm 9.15.0 are required. Keep secrets in secure environment settings or an ignored `.env`; never commit or paste them into reports.

Cloud shell activation:

```bash
cd /workspace/Friction
export COREPACK_HOME=/workspace/.cache/corepack
export PATH="/workspace/.local/bin:$PATH"
```

In this cloud instance use `pnpm install --frozen-lockfile --store-dir /workspace/.cache/pnpm-store` when refreshing dependencies. On other machines use the repository's normal `pnpm install --frozen-lockfile`. Run `pnpm typecheck`, `pnpm test`, `pnpm --filter @friction/dashboard build`, and `pnpm build:ext` before rehearsing.

For the real demo, supply `ANTHROPIC_API_KEY` securely and configure `MODEL_PARSE`, `MODEL_GRADE`, `MODEL_CHAT`, and `MODEL_CLASSIFY` from `.env.example`. Preserve existing bindings. HTTPS access to `api.anthropic.com` is required. To inspect only presence, from the repo root run:

```text
node --env-file-if-exists=.env -e "for (const k of ['ANTHROPIC_API_KEY','MODEL_PARSE','MODEL_GRADE','MODEL_CHAT','MODEL_CLASSIFY']) console.log(k, process.env[k] ? 'set' : 'missing')"
```

A present key and a real-mode health response do not prove authentication or model behavior. The real smoke gate below must actually pass. Keep `pnpm exec tsx scripts/verify-chat-abort.ts` in the gate; it passes after A's merged PR #1 fix and uses an injected SDK and memory store, so it needs no key and touches no running server.

## Start the services

In the API terminal set `DEMO_MODE=1` and choose `USE_REAL_INTELLIGENCE=1` for the real demo or `0` for a clearly labelled fake rehearsal. Bash uses `export NAME=value`; PowerShell uses `$env:NAME='value'`. These are shell instructions, not package scripts. Keep the four `MODEL_*` values in the environment or ignored `.env`.

Run `pnpm dev:api` from the root. The real API port is 8787. Confirm `/health` reports `server:'api'`, `demo:true`, contract 4 and the intended intelligence mode. Version alone does not certify the v4 rollout. A start without credentials can still report `intelligence:'real'`; model calls will fail.

In a second terminal run `pnpm dev:dash --host 127.0.0.1`. It uses dashboard port 5173 and defaults to API 8787. Keep `VITE_API_URL` pointed to that API. If 5173 already runs the mock dashboard, leave unrelated services alone and use `pnpm --filter @friction/dashboard dev --port 5174 --host 127.0.0.1` with `VITE_API_URL` set to the API. E validated the latter arrangement in this task.

Credential-free fallback development: `pnpm dev:mock` on 8788 plus `pnpm dev:dash:mock --host 127.0.0.1`. Label this fake mode; it does not satisfy real-Claude gates. Restart services after contract/server-code changes. Live processes do not survive environment snapshots.

## CP2 gate and pre-stage checklist

1. Run `pnpm exec tsx scripts/verify-chat-abort.ts` and require its genuine pass without weakening the pending-quiz assertion. The fix is already merged.
2. Verify API health says real intelligence and run `pnpm smoke` **three consecutive times** against that API, with all 16 steps passing each time. Do not substitute mock/fake runs, raise the intercept budget or disable assertions. Investigate a failed sequence before starting a new sequence.
3. Verify all six must-haves in a browser using real Claude: seeded tree, upload, L1 Socratic reply, live mastery, same question in a new chat with full assistance, bypass/quota/toast. C's updated browser script checks transport/UI across modes; real-model semantic acceptance still needs direct assessment. API-backed runs require an exclusive store window and `DASHBOARD_TEST_EXCLUSIVE=1`; do not run smoke/browser writers concurrently against that store.
4. Rehearse the full three-minute sequence with the human, prepare the fallback recording, and reset before going on stage. CP3 still requires two rehearsals and the backup recording/freeze.
5. Check that the seed tree and Alex are selected, both screens have a Live indicator, the API/console shows no request failures, and the dashboard is using the intended API mode. Models come from `MODEL_*`, never hardcoded application strings.

Smoke resets/mutates demo data. Do not run it during a shared live rehearsal. Late grades must still apply after the 4s response budget; do not cancel grading merely because that deadline elapsed. A failed/interrupted chat must clear the quiz the student never saw.

## Three-minute demo

Use the sandbox as the main surface. Keep educator and student/sandbox views visible so live progress and the bypass toast can be observed.

1. Reset with the dashboard's **Reset demo** button. Upload the text in `fixtures/demo-syllabus.md`; expect the cached React tree after roughly three seconds. Select Alex Chen when viewing a student's progress.
2. Open the sandbox with its live student map, start a new chat and ask exactly: **How do I stop my useEffect from running in an infinite loop?** At L1, expect a hint and a natural check question without the full code answer.
3. Answer with the shared tested demo prompt: **The dependency array lists the values the effect depends on, so React only re-runs the effect when one of those values changes. An empty array means run once after mount.** Expect correct grading, L4 and useEffect turning mastered live on all selected Alex views without reload. Respond to the actual quiz if it differs; do not silently claim a partial grade succeeded.
4. Click **New chat** and repeat the same useEffect question. Expect L4, no friction block and a complete answer.
5. Start another new chat and ask: **How does React Context help me avoid prop drilling?** Use the bypass for this turn's concept; quota should fall from 3 to 2, the node becomes paused and the educator sees Alex's Context API bypass toast.
6. Bonus only if D/human reconfirm GO: load `apps/extension/dist`, enable consent and point it at the intended API. Show the same useEffect flow on claude.ai. Validate the badge and hidden instruction block after reload. Stop the bonus beat if the live site fails; retain the sandbox as the main demo.

The quiz-attached header works in both the mock and real API, and C now stores/displays its exact per-turn value. Missing headers retain an explicitly approximate fallback. A low level alone does not prove that this turn attached a new quiz.

## Recovery

On an API/model error, inspect the request and server output; confirm credentials, models and mode. Recover/reset, then repeat the real gate sequence if the cause affected it. For a stalled or cancelled chat, do not send a staged answer to an unseen quiz. Do not replace a failing real-Claude demo with fake output without saying so.

If live claude.ai breaks, use `/sandbox`. If the required sandbox/live-model workflow cannot recover in time, use the backup recording. A recording and a human rehearsal have not yet been produced in this cloud task.
