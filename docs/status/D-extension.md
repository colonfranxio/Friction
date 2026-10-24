# Status: Agent D (extension)

**Owned by Agent D. Only this agent edits this file.**

- Contract version confirmed: 1 (incl. Windows amendment)
- Current checkpoint: CP1 (code complete; waiting on human for the live claude.ai test)
- Last updated: 2026-10-24 00:05

## Exit criteria for CP1
- [ ] **Fixtures captured and sanitized.** BLOCKED: Claude in Chrome is disconnected in my session. Synthetic fixtures (best-known shapes, clearly labeled) are in `apps/extension/test/fixtures/claude/`. The human capture steps (≈2 min) are in `apps/extension/NOTES.md`.
- [x] `adapters/claude.ts` + `lib/sse.ts` unit tests pass against the fixtures (URL match, conversation id, prompt read/write, both stream formats, CRLF). *Verified:* `pnpm --filter @friction/extension test`.
- [x] Bridge with nonce + timeout, unit tested (round trip, wrong nonce → timeout, error reply).
- [ ] **Live test on claude.ai → GO / NO-GO.** Needs the human: load `apps/extension/dist`, run `pnpm dev:mock:ext`, popup API URL `http://127.0.0.1:8789`, ask the useEffect question.
- [ ] Text-box fallback: only needed if the live test is NO-GO.

## Done ahead of schedule (CP2/CP3 items)
- [x] Popup (ui-layouts §5): online status, consent toggle, concept + level chip, bypass with quota and 409 message, settings.
- [x] On-page badge (ui-layouts §6): ready / L1–L3 / no friction / offline / paused. Shadow DOM, `pointer-events: none`.
- [x] Service worker ⇄ API verified end to end against the real mock in-process (`test/background.integration.test.ts`, 7 cases: status, L1 intercept + `/responses`, correct answer → L4, passthrough, bypass + paused, consent off, offline fail-open).
- [x] `hide-injected.ts`: strips the friction block from rendered messages (single node, split across nodes, multiple, skips the composer, ignores incomplete blocks). Unit tested with happy-dom. Selectors unconfirmed.
- [x] Fail-open everywhere: bridge timeout (4.5s), SW API timeout (4.0s), non-JSON bodies, extension reloaded mid-session, network errors re-thrown without retry (no double sends).

## Change requests (contract)
None.

## Dependency changes
- `happy-dom` (dev, `@friction/extension` only) for DOM unit tests.

## Assumptions
- claude.ai shapes per `apps/extension/NOTES.md` table (all unconfirmed until capture).
- Concept names in the badge load lazily (first intercept may show only the level).

## Blockers / needs from the human
1. **Capture claude.ai traffic** (NOTES.md "How to capture"), or reconnect Claude in Chrome so I can do it.
2. **Live test:** load the extension and try the useEffect question against `pnpm dev:mock:ext`.

## How to run and verify my part
```
pnpm --filter @friction/extension test        # 36 tests
pnpm --filter @friction/extension typecheck
pnpm --filter @friction/extension build       # → apps/extension/dist (load unpacked)
pnpm dev:mock:ext                             # mock API on 8789 for live testing
```
