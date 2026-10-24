# Moss integration checkpoint (E)

Branch `moss-integration`. Plan: [moss-implementation-handoff.md](../moss-implementation-handoff.md). Reference: experiment `8f8fe63`.
**Not merged to main or `claude-skill-tree`.** Waiting for the human's release decision.

## Provenance

| Step | Commit | Content |
|---|---|---|
| Base | `793aaa4` | main `d23cb63` + Moss execution plan |
| B | `c9a926f` on `agent/moss-intelligence` | `packages/intelligence/**` + B status only. MOSS INTELLIGENCE READY |
| E | `6427c24` | merge B + lockfile (`@moss-js/moss@1.21.0` optional; identical to reference lock) |
| A | `caf1e06` on `agent/moss-platform` | `apps/api/**` + A status only. MOSS API READY |
| E | `adabab0` | merge A + `.env.example`, README section, experiment docs |

Ownership check: B touched only `packages/intelligence/**` and `docs/status/B-intelligence.md`. A touched only `apps/api/**` and `docs/status/A-platform.md`. No shared contract or version change. API code on base equals the reference base, so no newer API fixes were overwritten. The separate A v4 cancellation/token work is not included.

**Changes vs reference `8f8fe63`:**
- **B:** 4 new tests: Claude abstains despite hints; candidates deduplicated and capped at 3; layout-invariant fingerprint; missing native SDK.
- **A:**
  - The store flush is no longer capped by native disposal (lifecycle correction, Step 3.6).
  - Traces now carry canonical candidate IDs.
  - New hung-preparation stall test.
  - The live harness is rewritten for Step 5.

## Default-behavior and regression checks at `adabab0` (clean clone)

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` (fresh clone, no node_modules) | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS: shared 26, dashboard 9, intelligence 65, extension 35, api 76, scripts 12 (223) |
| `pnpm build:ext` · `pnpm --filter @friction/dashboard build` | PASS · PASS |
| `pnpm exec tsx scripts/verify-chat-abort.ts` | PASS |
| `pnpm exec tsx scripts/verify-stream-failure.ts` | **FAIL**: "Upstream failure ended as clean EOF". **Pre-existing:** fails identically on main `d23cb63`. A v4 blocker, not a Moss regression; not weakened or xfailed. |
| `pnpm smoke --url http://127.0.0.1:8797`, real Claude, Moss **off** (private API, clone's own db.json) | SMOKE PASSED |
| Same, Moss **on** (after `ready`) | SMOKE PASSED. Moss was queried on the off-topic step (Props, Custom Hooks, Data Fetching) and Claude still passed the prompt through. |
| Theme prompt via `/intercept` on fresh private API, Moss on | `retrieved` [Props, **Context API**, React useEffect] in 5ms, then Claude picked Context API, L2, quiz attached |

`--require-v4` was not run: this base lacks corrected v4 API support (known main blocker).

## Credentialed live evidence (`pnpm --filter @friction/api moss:live`)

Artifact: [`apps/api/harness/results/2026-10-24T23-43-16-013Z-adabab0/moss-live.json`](../../apps/api/harness/results/2026-10-24T23-43-16-013Z-adabab0/moss-live.json) (`sha` `adabab0`, `dirtyWorkingTree: false`; scanned for keys and student identifiers). The previous run is kept at `results/reference-388ce96/`.

| Section | Step | Result |
|---|---|---|
| live (real Moss + Claude) | `/health` during warmup | 200; index ready in 1515ms |
| | Keyword control (`DEMO_PROMPTS.question`) | React useEffect, **0 Moss queries** |
| | Theme prompt, fresh chat via `/chat` | Moss [Props, **Context API**, React useEffect] 5ms. Claude chose Context API, L2 scaffold reply with quiz; mastery and quota unchanged |
| | Answer turn, same chat | Pending quiz kept Context API with **0 Moss queries**; graded `correct`; L2 → L4 (DEMO_MODE) |
| | Unrelated prompt (banana bread) | Moss returned 3 candidates; **Claude abstained** (prompt unchanged) |
| injected (Moss doubles, real Claude) | Init failure | fallback `unavailable`; baseline chose Context API; policy applied |
| | Query timeout | fallback `timeout`; baseline chose Context API |
| config | `USE_MOSS_RETRIEVAL=1` without credentials | trace `disabled/credentials`; API serves normally |

Repeated runs are operational verification, not evidence of higher accuracy.

## Known limitations (release notes)

- No accuracy gain shown on the 8-skill seed course ([moss-live-results.md](../moss-live-results.md)).
- Pool of 2 resident courses (demo student's first). Other courses use the baseline.
- A permanently hung native prepare/close pauses further Moss preparation (shared reconcile loop). Requests keep using the baseline, and shutdown caps native disposal at 2s after the full store flush. No worker process for hackathon scope.
- Locality/privacy: only curriculum text is indexed, and credentials stay server-side. SDK network behavior beyond authentication has **not** been independently audited, so make no "fully local" claim.
- Pre-existing A v4 blockers (stream failure above, `--require-v4`) remain open for full-product acceptance.

## Remaining for the human

- [ ] Short screen recording tying the theme prompt → `[moss] retrieved` log → teaching reply (Step 5.7). Not possible from this session.
- [ ] Release decision: keep on `moss-integration` for the sponsor demo, or direct a reviewed merge.
- [ ] Sponsor-demo machine: set the flag, restart, wait for `[moss] ready`, then use the theme prompt in a **new** sandbox chat.

Sponsor claim (approved wording): *"Moss connects students' everyday descriptions to the concepts in their course, helping Friction choose relevant teaching context."* Claude makes the final choice.
