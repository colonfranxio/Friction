# Status: Agent D (extension, bonus surface)

**Owned by Agent D. Only this agent edits this file.**

- Contract version confirmed: 1 (plan v5)
- Current checkpoint: CP1 → **GO** (live claude.ai test passed 2026-10-24); finishing the full loop check
- Last updated: 2026-10-24

## CP1 exit criteria
- [x] Simplified extension (message-box injection, no network interception) builds: `dist/` = content.js, background.js, popup.js, manifest.json, popup.html. One isolated content script, `storage` permission only.
- [x] Unit tests pass (34): send interception on Enter and on the Send click; passthrough; fail-open on a thrown error, on a timeout, and when the composer can't be rewritten (original restored); Shift+Enter and Enter outside the composer ignored; no double send while in flight; empty composer; Enter fallback without a send button; composer rewrite in happy-dom; conversation id; last assistant text.
- [x] Background tests against the real mock (in-process HTTP) pass: status, L1 intercept, correct answer graded via `previous_assistant_text` → L4, passthrough, bypass + paused, concept kept after off-topic, consent off (zero fetches), offline fail-open.
- [x] **Human live try → GO.** On real claude.ai with the mock (8789), the useEffect question got a Socratic L1 reply: no code, asked the student to explain, one hint about the dependency array, ended with a check question. So the composer rewrite + send work on the live page.
- [ ] Full loop on claude.ai (answer → L4 → new chat gets a full answer; badge text; injected block hidden in the user bubble): in progress with the human.

## CP1 verification (independent agent, Sonnet 5.5, fresh clone of the pushed branch)
Verdict: **CP1 code-complete PASS**. Ownership is clean, `src/lib` is tracked, typecheck/test/build pass in a fresh clone, no leftover network interception, consent-off makes zero API calls, Windows-safe. The live try is legitimately human-only.
Fixed from its findings:
- **M1:** pressing Enter while Claude is streaming (Stop button, send ignored) left the friction block in the composer. Now: after sending, confirm the composer emptied (≤600ms); if not, restore the original text (badge stays "ready").
- Text that already contains a friction block is never re-intercepted (no double injection).
- Wait up to 300ms for the Send button to be enabled after the rewrite (React lag), instead of a fixed 30ms.
- The badge shows the concept name on the first message (waits ≤400ms for the name map).
- Console logs which composer-rewrite strategy worked (paste / insertText / dom), to help the live test.
- Added tests: streaming/ignored send → original restored and nothing sent; already-injected text passes through untouched.

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
pnpm --filter @friction/extension test        # 34 tests
pnpm --filter @friction/extension typecheck
pnpm build:ext                                # → apps/extension/dist
pnpm dev:mock:ext                             # mock API on 8789
```
