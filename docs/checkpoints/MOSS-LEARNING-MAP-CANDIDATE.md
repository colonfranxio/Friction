# Moss + learning-map release candidate

**Review blocked; do not merge this candidate into main yet.** Branch `release/moss-learning-map`, code candidate `78cd751`. Main baseline `b113cf5`; B panel `043091a`, including D `7e078cf` and B's original race corrections. Main and Moss integration were already identical when this work started. The combined merge changed no API, intelligence or shared runtime code; only E-owned AGENTS needed conflict resolution, retaining both feature instructions.

## Fresh validation

| Check | Result |
|---|---|
| Frozen install, workspace typecheck | PASS |
| Root tests | PASS — **309**, 26 files: shared26, dashboard9, intelligence65, extension104, API93, scripts12 |
| Dashboard and extension production builds | PASS |
| Standalone cancellation and upstream-stream-failure checks | PASS / PASS |
| Fake-backed real API `smoke --require-v4` | PASS — 17/17 |
| API-backed dashboard demo | PASS — upload, headers/replies, live mastery, new chat, bypass/toast, quota/reset/mobile |
| Private mock v4 browser acceptance | PASS |
| Private mock polish/reduced-motion, resilience/PDF transport and educator editing browser suites | PASS |
| Built side-panel page with simulated extension storage and real dashboard iframe | PASS — map-only360/420, node details, live mastery, consent unload, student/URL reload, unreachable Retry |
| Extension `test:api` against certified current API | **13/16 PASS, 3 FAIL** — fixture leaves approval SHA empty but expects prompt scope |
| New consent and composer-replacement safety probes | **Two remaining defects independently reproduced**, below |
| Uploaded-course single-student reset probe | **FAIL** — 0/8 active-course state rows remain after reset |
| New paid Moss/Claude runs and human rehearsals | NOT RUN — no Claude/Moss credentials or root .env in this instance |

Main's previously committed real-model release evidence remains in [MOSS-release](MOSS-release.md); it is not a fresh live check of this candidate. Moss activation is on by default only in real intelligence mode with project credentials; `USE_MOSS_RETRIEVAL=0`/`false` disables it. Fake mode does not load the SDK. No secret values were read or printed.

All reported API/browser writers ran sequentially per backend, using a private memory-only API8791, mock8792 and dashboards5175/5176. Existing demo stores/services were not reset. Temporary evidence is under `/tmp/friction-combined-evidence/`. Actual MV3 loading was attempted in headless Chromium but no service worker became available; this environment attempt is not a successful Chrome side-panel check. The successful fallback runs the built panel on an ephemeral local HTTP server with simulated chrome.storage and a real dashboard iframe. It does not prove Chrome host permissions, sidePanel.open's user gesture or the live claude.ai flow. Earlier simulated-fixture attempts failed due to a serialized helper and a virtual-origin loopback restriction; those attempts were corrected in the harness, not by weakening application security. The successful run had no page JavaScript errors; it did encounter blocked external-font requests and an attribution warning, so no clean-console claim is made.

## B: fixes required on feature/learning-map

B retains full feature-development permissions. The original post-quota chat/draft/consent checks and completed-send counter are present and tested. Two further timing cases remain:

1. **Consent revoked during health check still allows a new quota POST.** `apps/extension/src/background.ts`, `handleBypass`, snapshots settings, awaits `/health`, then calls `/bypass` without rereading consent/current settings. A deterministic probe holds health, sets enabled=false, releases health, and observes a new POST while disabled. Recheck current settings immediately before issuing the quota request, and reject if consent or the bound student/API identity changed. Add a deferred-health regression proving zero subsequent bypass POSTs. Do not issue an automatic retry/refund request.
2. **Composer replacement can send a new draft.** `apps/extension/src/lib/send-interceptor.ts`, `sendUnmodified`, retains a composer across awaited rewriting/settling, but `triggerSend` finds the current button. A deterministic probe replaces/disconnects that composer while rewriting; the old element still contains the intended bypass prompt, so validation passes and the current Send sends the replacement draft. Verify the captured composer is still connected and is the current site composer immediately before writing/sending; on replacement, abort without restoring into or sending from the replacement. Add a remount regression, preserving the user's draft.
3. **Repair external-API test configuration.** The test setup sets apiUrl/studentId but no `promptBypassReadySha`. Three assertions nevertheless require `scope_applied:prompt`; actual API health says server=api, so the runtime correctly uses legacy scope. Make certified test runs explicitly supply the reviewed API SHA, retain an empty-SHA fallback case, and make generic expectations respect the selected mode. Do not remove the production gate or relabel a real API as a mock to get green tests. The current API runtime supports v4.

Independent `verify_moss_map_combined` (agreed gpt-6.1-sol medium substitute) reviewed both feature/runtime overlap and safety. It independently executed `/tmp/friction-combined-race-probes.mts` and confirmed both deterministic failures above; it also confirmed the external test-fixture mismatch. No source/ref/service mutations by the verifier.

**Remaining disclosed limitation:** conversation aliasing still relies on unconfirmed passthrough/failed-open sends and a 15-second URL-assignment window. It is not causal proof that an unseen UUID belongs to a newly created conversation. B should preserve this as a visible release limitation or strengthen send/navigation confirmation; do not claim complete elimination of cross-chat ambiguity.

## A: uploaded-course reset correction

On main and this candidate, `/demo/reset {student_id}` keeps the student's active uploaded tree but replaces their states with seed-tree rows. Reproduced with isolated `makeApp({demoMatches:false})`, live-path fake parse, then per-student reset: **0 of 8 active-course nodes have a state**. This breaks subsequent active-course interception.

Reset the selected student's active-course states to L1/unpaused with the intended quota/log/bypass/token cleanup, preserving the active tree, other students and unrelated data. Retain full-reset and seed-course behavior. Add parse → progress → per-student reset → active-course intercept regression, plus another-student isolation. Confirm the intended legacy inactive-state retention against the existing contract; coordinate any behavior change through E. A owns the source fix; E has not patched builder code.

## Completion order and release limits

1. A and B can fix their owned code in parallel in separate checkouts. B pushes an updated PANEL READY; A pushes its reset fix. Neither rewrites the source branches.
2. E refreshes this candidate from corrected refs, repeats affected unit/safety/API/iframe checks, then runs root checks once on the final code. No bypass of red gates based on the existing green suite.
3. Use the credentialed demo machine for fresh Moss on/default and explicit off smoke, live retrieval evidence, real-model semantics and human Chrome side-panel checks. Ensure dashboard/extension select the same backend and set the approved API SHA only for that deployed revision. Do not copy credentials into chat or tracked config.
4. Complete three consecutive real-Claude smoke passes, six semantic must-haves, two rehearsals and backup/sponsor recordings before declaring full acceptance. No such recordings or rehearsals were produced here. CR-2 whole-class assignment remains separate and unimplemented.
5. Main stays at its existing release while this combined candidate is blocked. Operational rollback for Moss is flag0 + restart; do not force-push main or reset another user's demo data.
