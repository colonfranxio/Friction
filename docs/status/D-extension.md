# Status: Agent D (extension, bonus surface)

**Owned by Agent D. Only this agent edits this file.**

- Contract version confirmed: **2** (read docs/contracts-CHANGELOG.md: v2 only adds an optional grading AbortSignal between A and B; no impact on the extension). My CP2 work is already on main via E's CP1 merge.
- Current checkpoint: **CP2** (CP1 closed: GO on live claude.ai)
- Last updated: 2026-10-24

## CP1 exit criteria
- [x] Simplified extension (message-box injection, no network interception) builds: `dist/` = content.js, background.js, popup.js, manifest.json, popup.html. One isolated content script, `storage` permission only.
- [x] Unit tests pass (34 at CP1; 35 now incl. 9 in-process integration tests): send interception on Enter and on the Send click; passthrough; fail-open on a thrown error, on a timeout, and when the composer can't be rewritten (original restored); Shift+Enter and Enter outside the composer ignored; no double send while in flight; empty composer; Enter fallback without a send button; composer rewrite in happy-dom; conversation id; last assistant text.
- [x] Background tests against the real mock (in-process HTTP) pass: status, L1 intercept, correct answer graded via `previous_assistant_text` → L4, passthrough, bypass + paused, concept kept after off-topic, consent off (zero fetches), offline fail-open.
- [x] **Human live try → GO.** On real claude.ai with the mock (8789), the useEffect question got a Socratic L1 reply: no code, asked the student to explain, one hint about the dependency array, ended with a check question. So the composer rewrite + send work on the live page.
- (moved to CP2) Full loop on claude.ai: answer → L4, new chat → full answer, badge text, block hidden in the user bubble.

## CP2 exit criteria
- [x] Popup: online status, consent toggle, concept + level chip, **Use a bypass (N left)** with the 409 message, settings (built in CP1; covered by the background tests for status/bypass/consent).
- [x] Badge: active level / no friction / offline / paused, plus **"Friction updated · reload this tab"** when the extension was reloaded and the open tab's content script is orphaned (previously shown as "offline").
- [x] Injected block hidden in rendered messages (`hide-injected.ts`, unit tested; never touches the composer).
- [ ] **Works against the real API on 8787.** BLOCKED on Agent A (no `agent/platform` branch on origin yet). Ready as one command: `pnpm --filter @friction/extension test:api` (runs the 9 service-worker integration tests against `http://127.0.0.1:8787`, after a demo reset). Verified working against a live mock on 8789.
- [ ] Human, ~3 min: on claude.ai, answer the check question (→ L4), then ask again in a new chat (→ full answer); report the badge text and whether your sent message shows the `⟦friction⟧` block. This also confirms the assistant-message selector (used as quiz text for grading).

## CP2 verification (independent agent, Sonnet 5.5, fresh clone)
Verdict: **CP2 PASS for everything Agent D controls**; the remaining items are legitimately blocked (Agent A's API; the human check). `test:api` confirmed against a live mock, including the clear error when DEMO_MODE is off. Fixed from its findings: popup bypass button disabled while in flight (no double bypass); popup shows "Offline" instead of hanging when the service worker is unavailable; `test:api` says "is the API running?" when it can't connect.

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
1. Agent A's API (`agent/platform`), then run `pnpm --filter @friction/extension test:api`.
2. Human, ~3 min on claude.ai: answer the check question (→ L4), new chat same question (→ full answer); report the badge text and whether the sent message shows the block.

## How to run and verify my part
```
pnpm --filter @friction/extension test        # 35 tests
pnpm --filter @friction/extension test:api    # integration tests vs a running API (default :8787)
pnpm --filter @friction/extension typecheck
pnpm build:ext                                # → apps/extension/dist
pnpm dev:mock:ext                             # mock API on 8789
```
