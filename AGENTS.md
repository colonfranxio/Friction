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

For learning-map work, the human's latest reassignment supersedes the normal ownership table and the former C/D split:

- **B owns full development of the extension learning map end to end**, on `feature/learning-map`: compact dashboard embed, extension panel/settings/consent behavior, tests and integration fixes required to ship the feature safely.
- B may modify feature-related dashboard/extension files, including the pending draft/chat/conversation safety blockers in `content.ts`, `lib/send-interceptor.ts`, `lib/conversation.ts` and related tests. This is scoped to learning-map delivery and its required safety dependencies; unrelated C/D work stays with its owner. API/shared/root contracts and other agents' status files remain read-only.
- **Latest permission expansion from the human:** B has full repository edit permissions for learning-map completion on `feature/learning-map`, including D's code and any supporting API/shared/root/config/docs changes actually required. This supersedes the narrower permission sentence above and path limits in older briefs. Coordinate overlapping work, keep the scope focused and disclose contract changes for E's review. E still controls release/main integration; secrets and others' unfinished work remain protected. See B's authoritative fix handoff in `docs/agents/B-intelligence.md`.
- **C and D stop learning-map implementation and fixes.** Coordinate any shared-file work with B; do not race B on popup/storage/routing/content/conversation changes. Previous `agent/claude-skill-tree-*` branches are superseded for this feature.
- E reviews/integrates on **`claude-skill-tree`**, preserving main and the separate Moss branches. The human's D → B history order remains: reuse D's `agent/extension` shell first, then B's `feature/learning-map`. B may merge the reviewed D source into its feature branch and fix the documented blockers there, rather than waiting for D to develop them.
- E can assemble D → B on an unpublished review candidate, then publish the feature target only once the combined changes pass review and required checks. Never publish D's unsafe intermediate state alone. No main merge without the human's release instruction.
- B publishes a fresh **PANEL READY** SHA with regressions for all documented blockers, narrow-screen/live-update evidence, tests/typecheck/build and remaining human checks. E independently verifies the combined candidate.
- Preserve unfinished work and use existing separate checkouts. No shared-directory branch switches, data resets, new worktrees or unreviewed bulk merges. Existing port/store isolation, consent and acceptance rules continue to apply.

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
