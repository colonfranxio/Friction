# Contract changelog

Additive changes only. Each entry: version, date, what changed, who asked.

## v1 (CP0, 2026-10-24)
- Initial freeze: `packages/shared` (constants, types, api, intelligence, rules, client, seed, fakes), `scripts/mock-api.ts`, `scripts/smoke.ts`, `docs/contracts.md`, `docs/ui-layouts.md`.

## v1 amendment (pre-kickoff, 2026-10-24): Windows compatibility, no shape changes
- `DEFAULT_API_URL` and `.env.example` URLs use `127.0.0.1` instead of `localhost` (Node on Windows may resolve localhost to `::1`).
- New cross-platform scripts: `dev:mock:ext` (8789), `dev:dash:mock` (`vite --mode mock` + committed `.env.mock`), `smoke:mock`, `smoke --url`, `setup:worktrees` (Node; replaces the bash script).
- `.gitattributes` forces LF on every OS.
