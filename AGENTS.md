# Rules for every Friction agent

You are one of four agents building Friction in parallel. Your personal brief is in `docs/agents/<you>.md`. The plan is **PLAN.md v5 (simplified)**: the sandbox chat is the main demo, the claude.ai extension is a bonus, there are 3 checkpoints, and **must-haves come before anything else**.

## Ownership (non-negotiable)
| Agent | You may edit | Branch |
|---|---|---|
| A Platform | `apps/api/**`, `docs/status/A-platform.md` | `agent/platform` |
| B Intelligence | `packages/intelligence/**`, `docs/status/B-intelligence.md` | `agent/intelligence` |
| C Dashboard | `apps/dashboard/**`, `docs/status/C-dashboard.md` | `agent/dashboard` |
| D Extension | `apps/extension/**`, `docs/status/D-extension.md` | `agent/extension` |
| E Integrator | `main` (merges), `packages/shared/**`, `scripts/**`, `fixtures/**`, `docs/**` (not status files), root config, lockfile | `main` |

**Read-only for builders A–D (owned by E, the integrator):** `packages/shared/**`, `scripts/**`, `fixtures/**`, `docs/**` (except your own status file), root config (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example`, `.gitignore`), `PLAN.md`, `PRD.md`, `design.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`.

## Working rules

### Claude skill tree feature isolation (human instruction, 2026-10-24)

For the C/D learning-map feature only, this section overrides the branch/merge destinations above and in the individual briefs:

**Latest human reassignment:** B now owns the learning-map implementation end to end on **`feature/learning-map`**. This supersedes the C/D implementation split below. E first merges D's existing `agent/extension` shell/hardening into **`claude-skill-tree`**, then reviews/merges B's feature there. B must incorporate that D-ready base before final PANEL READY. C must not build the embed, D must make no further panel edits, and the previously created `agent/claude-skill-tree-*` branches are superseded for this feature. B's narrowly scoped cross-owner permissions are listed in B's brief. Main remains isolated until the human directs release integration.

- E integrates and verifies on **`claude-skill-tree`**, based on main `d23cb63`. Do not merge this feature into `main` without the human's explicit instruction after review.
- C implements the compact embedded student view on **`agent/claude-skill-tree-dashboard`**. D implements the Chrome side panel on **`agent/claude-skill-tree-extension`**. Both branches start from the instruction-bearing `claude-skill-tree` commit, not their older `agent/dashboard` or `agent/extension` tips.
- C and D work in parallel in their existing separate checkouts, keeping their existing path ownership. Never switch a shared working directory another agent is using. No new worktrees are required.
- Preserve any unfinished work on its original branch before switching. Do not reset, discard or bulk-merge old branches into this feature. Ask E to review any required earlier fixes as explicit dependencies; A's held API and D's unmerged hardening do not become accepted through this feature.
- C publishes **EMBED READY** on its new branch; E merges C into `claude-skill-tree` first. D then integrates that feature-base update, completes the real iframe checks and publishes **PANEL READY**; E merges D second. D can build its shell/settings/tests while C works.
- A/B continue their existing assignments on their existing branches; this feature requires no new API/shared contract or intelligence work. Requests affecting their code go through E.
- Keep the existing private-port/store, consent, verification and priority rules. Builders push only their own new feature branches. Main and the original builder branches remain separate from this feature.

1. **Contracts are frozen** (`packages/shared`, `docs/contracts.md`). Import types, rules, the client, seed and fakes from `@friction/shared`. Never redefine them.
2. If a contract is wrong or missing something: work around it inside your own folder (for example, extend a type locally), add a **Change request** to your status file, and keep going. Contracts change only at checkpoints, additive only.
3. **Dependencies:** add them only to your own package (`pnpm add --filter @friction/<yours> <pkg>`). Never edit the root `package.json`. Lockfile conflicts are resolved at merge time.
4. **Develop against the mock and the fakes:** `pnpm dev:mock` serves the full API on :8788. The real API is :8787. Dashboard is :5173.
5. **Commit small and often** on your branch with clear messages. You may push **your own branch**. Never push to or merge into `main`; Agent E (the integrator) merges at checkpoints.
   **At each checkpoint:** make sure `pnpm typecheck` + your tests pass, update your status file (tick the exit criteria, list change requests), commit, **push your branch**, and say "CPn pushed". Then keep working on the next checkpoint's tasks while E merges.
6. Keep `docs/status/<you>.md` current: check off exit criteria, list change requests, blockers, and "how to verify my part".
7. Before saying a checkpoint is done: `pnpm typecheck` and your package's tests pass, and you've verified the behavior by running it (not just compiled it).
8. **Secrets:** never commit `.env`, API keys, cookies or session tokens. Sanitize any recorded traffic.
9. **Model IDs** come only from `MODEL_*` env vars. Don't send `temperature`/`top_p`/`top_k`, don't use assistant prefill, don't use forced `tool_choice`.
10. When E has merged a checkpoint, you'll get a message (from E or relayed by the human), and the report is in `docs/checkpoints/CPn.md`. If your branch was skipped, fix the reported error first. Then merge `main` into your branch, read `docs/contracts-CHANGELOG.md`, confirm it in your status file, and continue.

## Commands (identical on Windows, macOS, Linux)
```
npm i -g pnpm@9            # once (or `corepack enable` on macOS/Linux)
pnpm install
pnpm dev:mock              # mock API :8788 (C uses this one)
pnpm dev:mock:ext          # mock API :8789 (D's private one, so C's smoke runs don't reset it)
pnpm dev:api               # real API :8787 (Agent A's)
pnpm dev:dash              # dashboard :5173 → real API (VITE_API_URL from .env)
pnpm dev:dash:mock         # dashboard :5173 → mock API (reads committed .env.mock)
pnpm build:ext             # extension → apps/extension/dist
pnpm typecheck  |  pnpm test
pnpm smoke                 # demo flow vs real API :8787
pnpm smoke:mock            # demo flow vs mock :8788   (any URL: pnpm smoke --url http://127.0.0.1:XXXX)
pnpm setup:worktrees       # optional: one worktree per agent on this machine
```

## Cross-platform rules (some teammates run Windows)
- **package.json scripts must work in cmd/PowerShell:** no `VAR=value cmd` prefixes, no `rm -rf`/`cp`/`mv`/`&` backgrounding, no bash-only syntax. Use CLI flags, `.env` files, or a small Node script (`node scripts/x.mjs`) instead.
- **Paths in code:** build them with `node:path` (`join`, `resolve`) and `fileURLToPath(new URL('…', import.meta.url))`. Never concatenate with `/` or assume a POSIX root.
- **URLs:** use `http://127.0.0.1:<port>` for our servers, not `localhost` (Node on Windows may try IPv6 `::1` first and get refused).
- **Line endings:** `.gitattributes` forces LF. Don't commit CRLF; don't change editor settings to override it.
- **Windows shell tips:** in PowerShell, `curl` is an alias for something else, so use `curl.exe`. Copy files with `copy` (cmd) or `Copy-Item`, or use your editor. To kill a stuck dev server, close its terminal or run `npx kill-port 8787`.
- **Windows install tips:** if `corepack enable` fails with a permissions error, use `npm i -g pnpm@9`. If `pnpm install` fails on long paths, run `git config --global core.longpaths true` once.
