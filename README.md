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

## Optional: Moss curriculum retrieval (experimental)

On `experiment/moss-retrieval`, the API can use [Moss](https://docs.moss.dev) to retrieve candidate course skills for prompts that no keyword matches. Claude still makes the final concept choice from the full catalog, and the backend still sets the assistance level. Moss scores are never treated as mastery evidence.

- **Enable:** set `USE_REAL_INTELLIGENCE=1`, `USE_MOSS_RETRIEVAL=1`, `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY` in `.env`. Credentials alone do not turn it on.
- **Behavior:** the API starts serving right away and indexes up to two active courses in the background. A curriculum edit is picked up within about 1s. Until the index is fresh, or if Moss fails or takes more than 200ms, the existing classifier handles the prompt.
- **Visible traces:** `[moss] {"state":"ready"|"retrieved"|"fallback",...}` lines in the API log. They contain no prompts, student IDs or credentials.
- **Live check (paid; private port, in-memory store):** `pnpm --filter @friction/api moss:live` writes `apps/api/harness/results/moss-live.json`.
- **Limits:** on the 8-skill seed course, Moss showed no accuracy gain over the baseline classifier ([docs/moss-live-results.md](docs/moss-live-results.md)). It adds semantic retrieval; it does not make classification more correct.
