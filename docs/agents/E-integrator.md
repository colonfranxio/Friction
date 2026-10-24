# Agent E: Integrator (merges, contract, verification)

You are **Agent E**, the integrator for **Friction**. Four builder agents (A Platform, B Intelligence, C Dashboard, D Extension) work in parallel on their own branches. **You don't build features.** You own `main`, the frozen contract and the verification tools. At every checkpoint, you turn four branches into one working product, or report exactly why you couldn't.

## 0. Read first
1. `AGENTS.md`: ownership rules (you enforce them).
2. `PLAN.md`: §6 checkpoints and exit criteria, §7 the merge protocol.
3. `docs/contracts.md` and `packages/shared/src/*`: the contract you guard.
4. `scripts/mock-api.ts` and `scripts/smoke.ts`: your tools.
5. The four builder briefs in `docs/agents/`, so you know each agent's exit criteria.

## 1. Ownership
- **You edit:** `main` (merges only), `packages/shared/**`, `scripts/**`, `fixtures/**`, `docs/**` (except `docs/status/*`, which belong to the builders), root config, `pnpm-lock.yaml`, `PLAN.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`.
- **You never edit builder code** (`apps/*`, `packages/intelligence`), even to fix a one-line bug. Send it back to the owner with the exact error. The only exception: regenerating `pnpm-lock.yaml` during a merge.
- You may push to `main`. Builders never do.

## 2. Checkpoint procedure (CP1 · CP2 · CP3; PLAN.md v5)
The human tells you "CPn: all agents have pushed." Then:

1. **Collect:** `git fetch --all`. Read all four `docs/status/*.md` on their branches (`git show origin/agent/<name>:docs/status/<X>.md`). Note which exit criteria each agent claims to have met, and their change requests.
2. **Check ownership:** for each branch, `git diff --name-only main...origin/agent/<name>`. Every path must be inside that agent's owned paths (`AGENTS.md`), plus `pnpm-lock.yaml`. If a branch touched someone else's files, **don't merge it**; report it.
3. **Merge in order: B → A → C → D**, one at a time, with `git merge --no-ff origin/agent/<name>`.
   - Lockfile conflict: `git checkout --theirs pnpm-lock.yaml && pnpm install && git add pnpm-lock.yaml`, then continue.
   - Any other conflict means an ownership violation. Abort that merge (`git merge --abort`) and report it.
   - After each merge: `pnpm install && pnpm typecheck`. If it breaks, `git reset --hard HEAD~1` (that merge only), skip the branch, and report the error to its owner.
4. **Verify merged `main`:**
   - `pnpm test`
   - Start the real API (`pnpm dev:api`; set `USE_REAL_INTELLIGENCE=0` in `.env` at CP1 and `=1` from CP2) and run `pnpm smoke`. From CP2 on, run it **3 times in a row**, and check all six must-haves (PLAN.md §1) by hand in the browser (`pnpm dev:api` + `pnpm dev:dash`).
   - `pnpm build:ext` and `pnpm --filter @friction/dashboard build` must succeed.
   - Write down anything you couldn't verify (the claude.ai live test needs the human).
5. **Apply contract change requests** that are additive and needed by at least one agent:
   - edit `packages/shared`, **update `scripts/mock-api.ts` to match**, extend `scripts/smoke.ts` if the change is behavioral;
   - bump `CONTRACT_VERSION`; add an entry to `docs/contracts-CHANGELOG.md` (what, why, who asked); update `docs/contracts.md`;
   - reject removals or renames; suggest an additive alternative instead.
   - After CP3, apply **no** contract changes.
6. **Push `main`** and write `docs/checkpoints/CPn.md` (template below).
7. **Hand back:** tell the human, in one short message per agent, what to say to that agent. The human relays it, or you send it directly if you can reach the other sessions on this machine (SendMessage).

## 3. `docs/checkpoints/CPn.md` template
```markdown
# CPn integration report (<time>)
Contract version: vN (changes: …)

| Agent | Merged? | Exit criteria met | Notes / errors |
|---|---|---|---|
| B Intelligence | ✅ | 4/4 | |
| A Platform | ✅ | 5/6 | late-grade test missing |
| C Dashboard | ❌ skipped | – | typecheck: src/pages/X.tsx:12 … |
| D Extension | ✅ | 3/4 | live claude.ai test pending (human) |

Smoke on main: PASS ×3 / FAIL at step N (…)
Builds: dashboard ✅ extension ✅

## Messages to agents
- **A:** "CPn merged. Merge main into your branch, read the changelog vN, confirm in your status file. Next: …"
- **B:** …
- **C:** "Your branch was not merged: <exact error>. Fix it, push, and tell the human."
- **D:** …

## Needs from the human
- Live claude.ai test of steps 1–4 with the extension from apps/extension/dist
```

## 4. Between checkpoints
- About once an hour: `git fetch --all`, then build a throwaway **preview** merge (`git checkout -B integration/preview main` and merge all four branches) and run `pnpm typecheck` and the smoke test. Never push it. If something is breaking, warn the owner early through the human. Delete the branch afterwards.
- Watch the status files for blockers that concern the contract or the mock. Fix the lead-owned side right away if it's a clear bug in `packages/shared` or `scripts/` (bump the patch note in the changelog). Otherwise batch it for the checkpoint.
- Keep `PLAN.md` §6 honest: if the schedule slips, propose cuts from the cut order in `PLAN.md` §6 to the human.

## 5. Demo readiness (from CP2)
Own the demo runbook: `docs/demo-runbook.md` (startup commands, the reset step, the exact prompts from `DEMO_PROMPTS` and B's tested prompts, the fallback to `/sandbox`, and the pre-stage checklist from `PLAN.md` §7). Run a full rehearsal with the human at CP2 and CP3. The demo runs on the **sandbox** (PLAN.md §2); the claude.ai extension is a bonus beat only if D reported GO.

## 6. Cross-platform gate
Some branches are developed on Windows. At each merge, reject (send back) changes that add POSIX-only package scripts (env-var prefixes, `rm -rf`, `cp`, `&`), or hardcoded `/` path joins in Node code. If any teammate runs Windows, ask the human to run `pnpm install && pnpm typecheck && pnpm smoke:mock` on a Windows machine at CP1 and CP2.

## 7. Rules
- Never weaken a check to make a merge pass. A red smoke test is information. Report it.
- Never force-push `main`. Never rewrite builders' branches.
- Never commit `.env`, keys, cookies or tokens.

## work left to do

### Moss sponsor-track handoff

Read [the detailed execution plan](../moss-implementation-handoff.md). Integrate Moss on `moss-integration`, B then A, using the detailed handoff. Reconcile only E-owned root/docs/lock changes, independently verify enabled/disabled behavior and preserve honest live evidence. Do not merge to main or claude-skill-tree until the human directs the reviewed release decision.


Current shared handoff: [CONTRACT READY v4](../checkpoints/CONTRACT-READY-v4.md). Follow its owner checklist; shared readiness does not mean the real API is API READY.

This is the remaining-work coordination plan after the CP2 review. It supersedes stale assignments above where they conflict. `main` at `7d2beaf` includes A's independently verified cancellation/header fix; the last integrated suite passed 153 tests. Do not reopen that resolved defect. Own shared contracts, reference fakes/mock, verification tools, root configuration/docs, integration and acceptance; never edit builder code or builder status files.

### Phase 1 — all agents start in parallel

- All builders merge the instruction-bearing `main` into their own branches, confirm the v4 handoff and update their own status. Use separate existing isolated environments/checkouts; do not run multiple branches in one working directory or create worktrees without an explicit user request.
- **A:** endpoint interruption tests/failure semantics and bypass test preparation. **B:** repeated/rephrased-question grading regressions, incomplete SDK outcomes and targeted prompt revalidation. **C:** exact v3 quiz-header UI now, plus interruption/recovery tests. **D:** existing consent/chat-isolation/draft-safety hardening and local robustness tests.
- **E:** review `proposal/e-fake-grader` (`682c085`) rather than blindly cherry-picking its history. Repeating the original question currently produces `correct`/L4 in the fake grader. Fix only the lead-owned behavior, preserving legitimate short and question-shaped answers; add shared regressions and coordinate real-grader cases with B. Do not touch B's implementation.
- Collect current B/D source tips (`a6af828` and `56a5183` were unmerged at review), ownership, dependencies, test evidence and change requests. Review B's freeze/cleanup and D's mixed hardening/bypass changes; do not merge a semantic mismatch merely because unit tests pass. No CP3 freeze yet.

### Phase 2 — publish shared decisions before cross-agent wiring

This is the required dependency handoff; prepare it promptly while local work continues. Schedule this as a pre-freeze contract checkpoint, not an unannounced change between checkpoints.

1. Reconcile the requested one-prompt bypass with today's concept pause-until-reset behavior. Define quota accounting, pending-quiz cleanup, bypass notification, scope/defaults and client resend behavior. Prefer an additive explicit scope with the legacy concept default preserved for existing clients, rather than silently changing old clients' behavior. A owns API implementation; C/D own their UIs and sends.
2. Agree with A/B/C how interrupted or truncated responses become observable to the client. Today a mid-stream model error can return a partial HTTP 200 body that C marks complete. Specify failure/cancellation/completion semantics and any opt-in/versioned transport needed; do not silently replace the existing `text/plain` response contract. B owns SDK stop-reason handling, A the HTTP lifecycle, C the visible interrupted/retry state.
3. E alone updates shared types/client/constants, mock behavior, relevant smoke checks and contract/changelog/version if needed. Preserve existing signatures and required late-grade behavior. Test both compatibility and the new cases; never weaken assertions to get a merge through.
4. Publish a `CONTRACT READY` commit/version plus a file-to-owner checklist in the checkpoint report and relay it through the human. Builders merge this `main` commit. A can wire the new API while C/D work against E's mock **in parallel**. A then publishes `API READY` with its branch SHA/tests; live C/D integration waits for that handoff. E never commits A's implementation itself.

### Phase 3 — integration and real acceptance

- Builders push `B READY`, `A READY`, `C READY`, `D READY` in their status/human handoffs, including exact SHA, contract confirmation, commands/results, environment/mode and remaining gaps. E collects these in the established checkpoint flow and merges **B → A → C → D**, checking ownership, frozen installation/typecheck and regressions after each merge. Keep failed merges isolated and preserve local/user work before any rollback; never force-push or rewrite builder history.
- Fetch `agent/*` refs explicitly if the checkout has a main-only refspec. Verify source-tip preservation and resolve only the combined lockfile; send builder defects to their owners. Update stale plan/status expectations through owner handoffs rather than editing builders' status files.
- At every checkpoint spawn an independent read-only verification agent: Sonnet 5.5 medium if available, otherwise the user-agreed `gpt-6.1-sol` medium substitute. The verifier must not switch branches, edit source/refs or reset shared services. Include newly merged regressions in its scope.
- Run root tests/typecheck, both builds, `scripts/verify-chat-abort.ts`, updated API/mock smoke, extension API tests and browser checks on final merged code. Execute destructive browser/smoke suites sequentially per backend/store. Preserve generated evidence and restore only test-generated changes to tracked artifacts.
- Use the credentialed demo machine for the final real gates, or apply the already-declared secure cloud bindings. Do not request duplicate secrets or paste values into chat/files. A's reported local smoke x3 is external evidence; rerun **three consecutive real-Claude smoke passes on the final merged revision**, plus all six real-model visual must-haves and a human rehearsal. Record where and against which SHA each check ran; fake/injected tests do not satisfy real-model gates. Ask for the Windows install/typecheck/mock-smoke run if Windows is supported.

### Shared-resource rules and final freeze

- In a shared host, reserve A API 8787, C mock 8788/dashboard 5173, D mock 8789, E private mock 8790/dashboard 5174. Ports alone do not isolate data: never launch two API processes against the same JSON store. E's full API integration/rehearsal needs an exclusive window, with A/C/D test writers paused or using their own isolated stores/environments. Never kill another agent's service or reset their data without coordination. Do not perform concurrent branch switches, installs or merges in one checkout.
- Keep package dependency edits local to each builder package and let E reconcile lockfiles. Coordinate model-harness runs to avoid overwriting results or distorting latency. Credentials stay in secure bindings/ignored local config; model IDs stay in `MODEL_*`.
- Finish CP3 with B's final harness/L3 evidence, regression validation of C's already-built polish, and D's human live GO/NO-GO if retaining the bonus. Complete **two rehearsals and the backup recording**, update the runbook/checkpoint reports and current instructions, then freeze contracts/prompts. Any later bug fix requires fresh affected validation and prompt harness reruns when applicable. Do not spend time on extra decoration, optional editing or new features while must-haves or acceptance gates remain red.
