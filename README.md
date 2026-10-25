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

## Optional: Moss curriculum retrieval (sponsor integration)

The API can optionally use [Moss](https://docs.moss.dev) to connect a student's everyday wording to the concepts in their course. When a prompt matches **no keywords**, Moss suggests up to 3 course concepts to the existing Claude classifier. Claude makes the final choice from the full concept list, and can choose none. The backend still sets the assistance level, and only quiz grading changes mastery.

- **On by default** whenever the API runs with real intelligence (`USE_REAL_INTELLIGENCE=1`) and `MOSS_PROJECT_ID`/`MOSS_PROJECT_KEY` are set. Without credentials, or in fake mode, the API runs without Moss. To turn it off, set `USE_MOSS_RETRIEVAL=0` and restart.
- **Behavior:** the API serves immediately and indexes up to two active courses in the background (about 0.5–2s each). Edits are detected within about 1s, and stale queries fall back immediately. Cold, stale, failed or slow (>200ms) retrieval uses the existing classifier. Keyword matches and pending quiz answers never call Moss.
- **Indexed data:** concept name, mastery criteria and keywords are sent to Moss. No student histories, transcripts, grades or prompts are indexed (prompts are used only as search queries). If you have Moss credentials in `.env` but don't want this, set `USE_MOSS_RETRIEVAL=0`.
- **Logs:** `[moss] {"state":"ready"|"retrieved"|"fallback",...}` with candidate node IDs and timings. No prompts, student IDs or credentials.
- **Live evidence (paid; private port, in-memory store):** `pnpm --filter @friction/api moss:live` → `apps/api/harness/results/<timestamp>-<sha>/moss-live.json`.
- **Limits:** no accuracy gain shown on the 8-skill seed course ([docs/moss-live-results.md](docs/moss-live-results.md)). A permanently hung native call pauses Moss preparation (the API keeps serving). See [docs/moss-implementation-handoff.md](docs/moss-implementation-handoff.md) and [docs/checkpoints/MOSS-integration.md](docs/checkpoints/MOSS-integration.md).
