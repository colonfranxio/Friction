# Contract changelog

Additive changes only. Each entry: version, date, what changed, who asked.

## v1 (CP0, 2026-10-24)
- Initial freeze: `packages/shared` (constants, types, api, intelligence, rules, client, seed, fakes), `scripts/mock-api.ts`, `scripts/smoke.ts`, `docs/contracts.md`, `docs/ui-layouts.md`.

## v1 amendment (pre-kickoff, 2026-10-24): Windows compatibility, no shape changes
- `DEFAULT_API_URL` and `.env.example` URLs use `127.0.0.1` instead of `localhost` (Node on Windows may resolve localhost to `::1`).
- New cross-platform scripts: `dev:mock:ext` (8789), `dev:dash:mock` (`vite --mode mock` + committed `.env.mock`), `smoke:mock`, `smoke --url`, `setup:worktrees` (Node; replaces the bash script).
- `.gitattributes` forces LF on every OS.

## v1, plan v5 (2026-10-24): simplification, no shape changes
- Sandbox chat is the main demo surface; the claude.ai extension is a bonus and uses message-box injection (no network interception, no `/responses` from the extension; grading uses `previous_assistant_text`).
- 3 checkpoints (CP1 T+3h, CP2 T+9h, CP3 T+16h freeze). Heartbeat cut from the MVP.
