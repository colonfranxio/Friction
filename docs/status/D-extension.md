# Status: Agent D (extension, bonus surface)

**Owned by Agent D. Only this agent edits this file.**

- Contract version confirmed: 1 (plan v5)
- Current checkpoint: CP1 (code complete; waiting on the human's live try → GO/NO-GO)
- Last updated: 2026-10-24

## CP1 exit criteria
- [x] Simplified extension (message-box injection, no network interception) builds: `dist/` = content.js, background.js, popup.js, manifest.json, popup.html. One isolated content script, `storage` permission only.
- [x] Unit tests pass (32): send interception on Enter and on the Send click; passthrough; fail-open on a thrown error, on a timeout, and when the composer can't be rewritten (original restored); Shift+Enter and Enter outside the composer ignored; no double send while in flight; empty composer; Enter fallback without a send button; composer rewrite in happy-dom; conversation id; last assistant text.
- [x] Background tests against the real mock (in-process HTTP) pass: status, L1 intercept, correct answer graded via `previous_assistant_text` → L4, passthrough, bypass + paused, concept kept after off-topic, consent off (zero fetches), offline fail-open.
- [ ] **Human live try → GO / NO-GO.** Steps in `apps/extension/NOTES.md` ("Live test").

## Removed (per plan v5)
Page-level fetch patch, postMessage bridge, SSE parser, network fixtures, `/responses` calls.

## Lead-level fix made along the way (on main, commit 688d316)
The root `.gitignore` (a Python template) ignored every `lib/` folder, so `apps/*/src/lib/` would never be committed. That hit A, C and me. The Python patterns are now anchored to the repo root. My earlier pushes were missing `src/lib/*`; this push includes them.

## Change requests (contract)
None.

## Dependency changes
- `happy-dom` (dev, extension only).

## Blockers / needs from the human
1. Live try on claude.ai (≈5 min, NOTES.md). If it fails, run the console snippet in NOTES.md and paste the output.

## How to run and verify my part
```
pnpm --filter @friction/extension test        # 32 tests
pnpm --filter @friction/extension typecheck
pnpm build:ext                                # → apps/extension/dist
pnpm dev:mock:ext                             # mock API on 8789
```
