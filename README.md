# Friction (CalHacks 13.0, Team We'll Figure It Out)

An extension plus dashboard that makes AI tools teach instead of tell. It adjusts how much help claude.ai gives based on each student's mastery of an educator-defined skill tree.

- **Product:** [PRD.md](PRD.md) · **Design:** [design.md](design.md)
- **Build plan and ownership:** [PLAN.md](PLAN.md)
- **Contracts:** [docs/contracts.md](docs/contracts.md) · **Screens:** [docs/ui-layouts.md](docs/ui-layouts.md)
- **Agent prompts:** [docs/agents/](docs/agents/)

## Quickstart
```bash
npm i -g pnpm@9          # or: corepack enable (macOS/Linux)
pnpm install
cp .env.example .env     # Windows: copy .env.example .env   (then add ANTHROPIC_API_KEY)
pnpm dev:mock            # mock API on :8788 (full contract, fake AI)
pnpm smoke:mock          # in a second terminal
```

Works on **Windows, macOS and Linux** (Node ≥ 22.9). All commands are `pnpm` scripts, with no shell-specific syntax. See the Windows notes in [AGENTS.md](AGENTS.md).

| Path | What | Owner |
|---|---|---|
| `packages/shared` | Frozen contract: types, API, rules, client, seed, fakes | Lead |
| `packages/intelligence` | Claude-powered parse / classify / prompts / grading | Agent B |
| `apps/api` | Hono API :8787, JSON store, SSE | Agent A |
| `apps/dashboard` | Vite + React dashboard :5173 | Agent C |
| `apps/extension` | Chrome MV3 extension for claude.ai | Agent D |
