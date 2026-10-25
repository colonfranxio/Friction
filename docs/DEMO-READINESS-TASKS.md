# Demo readiness: assignments and execution order

**All agents: read this before starting.** Original assignment baseline: main `52c41ac`.

**Progress update:** A `ab34e32` and B `259cc3a` are integrated and verified in [DEMO-READY-INTEGRATION](checkpoints/DEMO-READY-INTEGRATION.md). The reset fix and final map implementation are complete; do not rebuild them. Continue Phase3 live acceptance/rehearsals and Phase4 hosting preparation. Technical/injected passes do not certify the human demo. The teacher creates the skill tree first; the student then uses the **claude.ai extension with the live learning map**. The sandbox is a secondary regression/fallback surface. This document supersedes older demo order, ownership and branch assignments where they conflict. Preserve the concept-card design and the integrated safety fixes. No new model provider, database migration, unrelated feature or prompt tuning is required.

## Current state

- Main includes Moss, corrected v4 stream/token behavior, concept cards and extension shell/icons, B's focused safety fixes and C's narrow-screen fit. Current integrated checks: 316 tests, seven dashboard browser suites (including embed), builds, stream tools, v4 fake-backed smoke and 19 certified extension/API checks passed.
- B's final map-only panel (`259cc3a`) is integrated on the current concept-card canvas with detail Escape/Close/focus and narrow/live browser checks. The separate narrow-wrap proposal and multi-site work are not included.
- A's uploaded-course per-student reset defect is fixed (`ab34e32`) with active-course/intercept/isolation regressions. Non-demo upload still moves Alex only, not the whole class.
- Fresh real-model/Chrome acceptance on the combined final revision, two rehearsals and recording remain open. This cloud instance has no Claude/Moss credentials; existing live reports are historical evidence.
- Hosting is not chosen. Public access with usage limits and isolated visitor progress is the agreed target. Vercel dashboard + a long-running backend is a candidate, not a deployed or approved hosting account. Current extension hosts/URL validation support local HTTP only.

## Phase 0 — every agent starts here

1. Fetch origin and merge current main into your own assigned branch in your **existing isolated checkout**. Preserve unfinished work before switching. Never force-push, reset others' work or switch a shared directory another agent is using. No new worktrees unless the human requests them.
2. Read `AGENTS.md`, `docs/design/CONCEPT-CARDS.md`, `design.md`, `docs/ui-layouts.md` and this document. Do not restore PillarHeader, module columns, CanvasActions.move/rename, drag positioning or the 0.5 minimum scale floor.
3. Record baseline SHA, task/branch, mode, commands and remaining gaps in your own status file. Only E merges main. Push the ready branch and report its exact SHA; a local commit is not a handoff.

## Phase 1 — A, B and C work in parallel; D prepares verification

### A — API/reset and public-demo backend preparation

**Branch:** `agent/platform`. **Owned:** `apps/api/**`, A status. Coordinate any shared/root contract needs with E before overlapping changes.

Required local-demo fix — completed; details retained for regression reference:

1. Fix `POST /demo/reset {student_id}` after a non-cached syllabus upload. It currently preserves the active uploaded tree but swaps in seed-tree states, leaving no state for the active concepts.
2. Recreate/reset that student's active-course states to L1/unpaused; preserve the active tree and other students/data. Retain intended quota/log/bypass/token cleanup and full/seed reset behavior. Resolve inactive-state retention against the existing contract with E rather than silently changing it.
3. Add meaningful regressions: non-demo parse → progress → per-student reset → intercept on the uploaded tree succeeds; another student's progress unchanged; seed/full resets still work. Preserve late grading, cancellation, stream-failure and prompt-token guards.
4. Run API tests and workspace typecheck; both standalone stream tools and v4 fake-backed smoke must pass on an isolated API/store. Publish **API DEMO READY** with SHA and evidence.

Public-link preparation can proceed as a separate follow-up commit/proposal: report the port binding, writable data path/persistence, streaming/SSE proxy needs, health checks, real-model cost controls and visitor-isolation requirements. Do not expose the current global reset/edit API as an unrestricted shared public demo. Propose minimal guest isolation and hard request/concurrency/model-spend controls using the current stack; E coordinates any contract change before implementation. Budget alerts alone are not spending caps. This work is not a prerequisite to local rehearsal.

**Whole-class upload:** CR-2 is conditional. Do not implement or claim it as complete merely for this checklist. If the human chooses to demonstrate every classmate moving onto a new syllabus, E first specifies the behavior, then A implements/tests it. Otherwise rehearse the honest Alex-only flow.

### B — final learning map and safe reconciliation

**Branch:** `feature/learning-map`. **Authority:** B retains the human's full repository edit permissions for this feature, including supporting extension/dashboard/config changes when required. Keep changes focused, coordinate overlapping paths, and leave release/main merges to E.

1. Merge current main into the feature branch. Preserve the approved map-only panel with click-to-open node details and live progress, while adapting it to concept cards and the new vertical scroll/frontier canvas. Do not bulk-restore the old pillar/zoom layout from `bc4997e`.
2. Preserve all integrated safety behavior: chat/draft/send checks before and after quota, completed-send counter, logical chat IDs, consent/student/API recheck after health, connected/current composer guards, no stale arming and truthful quota-spent/not-sent + Copy question. Retain explicit approved-SHA versus legacy scope in external API tests.
3. Check 360/390/420px and a five-card-row fixture: actual card bounds fit, no unreachable outer cards, readable detail card, close/focus behavior, no TopBar/teacher controls in embed, full Student route unchanged. Preserve compact unknown-student/API-error Retry, consent unload and stale-load cancellation.
4. Grade an answer through the same private backend the iframe uses; verify the card turns gold live without reload, including its level/detail state. Do not count a static screenshot as SSE proof.
5. Run dashboard/extension tests, typecheck and both builds. Include regressions for any reconciliation fixes. Publish **PANEL READY FINAL** with SHA, changed paths, mode, browser evidence and remaining human checks.

B is the only learning-map implementer. C/D must not concurrently edit EmbedPage, the shared canvas/layout for this feature, panel/settings/manifest/popup/storage/content/conversation/bypass files while B reconciles them. B must coordinate before touching A's API files; full permissions do not make concurrent writes safe. No Moss reimplementation or grading/template tuning is assigned.

### C — teacher/student concept-card regression

**Branch:** `agent/dashboard`. **Owned:** dashboard outside B's active feature paths, C status. During B reconciliation, prefer verification and report shared-canvas/routing defects to B rather than editing the same files.

1. Confirm teacher upload → concept-card tree; inspector edits, required levels, prerequisite connect/delete/cycle error, Class/Activity, viewer switching, frontier button and live mastery.
2. Retain intentional removals: module renaming from canvas, saved-position dragging and canvas zoom. Test narrow fitting below0.5 by card bounds, not just document overflow.
3. Run dashboard unit/build/typecheck and six browser suites against C's private mock, serially. Record reference screenshots, reduced motion and errors. Fix non-overlapping regressions only; coordinate any routing/canvas/token edits with B.
4. Publish **DASHBOARD DEMO READY** with tested SHA and any fixes. Do not write the submission walkthrough yet; final UI and the D/B extension pass must settle first.

### D — extension verification, then deployment-host support

**Branch:** `agent/extension`. **Ownership:** non-map extension work and D status; B owns the full map feature. Merge main first and preserve B's safety changes.

Phase 1 is read-only test preparation: review the rebuilt popup/pill/card icons, prepare new-chat/multi-tab/offline/service-worker/reload/consent test cases and report bugs to B. Do not duplicate or overwrite B's panel implementation. Build a live-check checklist; do not claim logged-in Claude verification from DOM stubs.

After **PANEL READY FINAL** is integrated by E, D can execute the final live checks in Phase3. Public HTTPS support is Phase4 and must wait for chosen hosts plus B's shared-file handoff; D and B must not race on manifest, popup/storage or URL validation.

### E — integration and evidence coordination

**Branch:** main integration or an explicit temporary candidate. **Owned:** shared/scripts/root config/lockfile/docs; no ad-hoc builder-source fixes. Coordinate owner fixes and resolve documented merge overlaps without losing behavior.

- Collect exact READY SHAs and ownership/dependencies. Maintain this checklist, validation report and technical runbook; keep credentials in secure bindings/ignored local configuration.
- Do not reopen resolved v4 stream/token/timestamp issues. Preserve default-on Moss in real mode with credentials and explicit opt-out 0/false.
- Prepare the release and deployment checklist, package/build scripts and evidence destinations. No actual hosting provision/deploy until the account/target configuration is available; do not invent a public URL.
- At integration checkpoints use the required independent read-only verifier (Sonnet 5.5 medium if available, otherwise the already-agreed gpt-6.1-sol medium substitute).

## Phase 2 — E integrates ready code

**Order: A → B → any independent C fixes.** D's original shell and B safety fixes already exist on main; do not re-merge an old D branch to undo them. If A is not ready, E may verify B on an isolated candidate while preserving the API dependency as open.

After each merge: frozen install/typecheck and affected checks. On final combined code run root tests, both builds, both stream verification tools, v4 API smoke, certified external extension/API tests and the six dashboard suites. The external fixture needs the reviewed full API SHA (`FRICTION_API_READY_SHA`); keep the empty-SHA legacy gate covered too. Use private stores and serialize destructive checks.

Verify actual built panel/iframe behavior, consent/no-load/unload and storage/URL changes. Distinguish simulated chrome.storage/iframe evidence from actual MV3/sidePanel.open and logged-in site evidence. Publish **INTEGRATED DEMO READY** with final code SHA and exact open human/live gates; never infer live readiness from health or green unit tests.

## Phase 3 — D + E + human, after integrated handoff

Use the credentialed demo machine and one exclusive backend/store window. C/B may assist; no simultaneous smoke/reset tests against that store.

1. Build/load the exact final extension, reload the Claude tab, confirm consent, student, API, dashboard backend and approved readiness SHA all match. Wait for Moss ready after startup and again after syllabus parsing.
2. Execute the real extension-first acceptance flow: teacher uploads syllabus and inspects tree; selected student asks through Claude; guided reply/check question; answer → gold mastery live in teacher/student/panel; same mastered concept in a new chat → full help; bypass → one intended resend, quota decrement and teacher notification. Confirm hidden prompt text and no raw student text on teacher pages.
3. Check navigation/draft changes during bypass, first-send UUID assignment, consent revocation, sidePanel.open, multi-tab/offline/reload recovery and Copy question for a charged-but-not-sent case. Confirm approved prompt scope; do not silently demonstrate legacy concept pause as one-prompt bypass.
4. E runs three consecutive real-Claude smoke passes on final code, with Moss-on/default and explicit-off checks where appropriate, plus a fresh live retrieval example proving a Moss query happened. Keyword-heavy smoke alone is not retrieval evidence. Record provider failures/grades honestly; no accuracy-gain claim.
5. Complete **two timed rehearsals**, then a roughly 3-minute submission video and a backup recording. Use the elementary or agreed syllabus; respond to the actual quiz and account for variable model latency. No per-student uploaded-course reset until A's fix is verified; otherwise use full reset + upload.

D publishes **LIVE EXTENSION GO** with machine/browser/version/SHA and remaining issues, or NO-GO with reproduction. E updates the runbook from old sandbox/green-node wording to the final teacher → extension/student gold-card flow and records acceptance. **Human recording/rehearsal requires human participation; no agent claims it happened automatically.**

## Phase 4 — public submission link (parallel to local rehearsal after host choice)

This is separate from local demo readiness. E coordinates hosting; A handles backend readiness and controls; C handles web deployment regressions; D implements approved HTTPS host support after B's feature files are stable.

- Choose/provide the hosting account and target first. Vercel can host the dashboard; the API needs a long-running Node/native-Moss-compatible runtime. Verify actual free-tier memory/warmup, sleeping behavior, SSE/text-stream handling and data lifecycle. Do not promise free API/model usage or persistent JSON storage on an ephemeral disk.
- A/E validate persistence, visitor isolation and hard usage controls before opening a real-model public backend. Keep real secrets server-side. Restrict appropriate origins without breaking the extension. No new provider/database unless explicitly agreed.
- D adds the selected HTTPS API/dashboard origins to host permissions and URL validation, preserving local development and consent behavior. Limit origins to the chosen hosts; no blanket host access. Update defaults/build configuration for the public build without committing secrets.
- E publishes a versioned unpacked extension ZIP with correct manifest/icons and verifies the download and teacher/student URLs from a clean browser. A public try link is not complete if the download still calls localhost. Chrome Web Store publication is not assumed.
- **Walkthrough remains deferred** until B/C/D UI is accepted. Then E writes the installation/walkthrough with the human's final teacher-first sequence. C/D provide verified screenshots and checks; nobody publishes speculative instructions while UI is changing.

## Shared resources and handoff format

Use existing isolated environments/checkouts. On a shared host reserve A API 8787; C mock 8788/dashboard 5173; D mock 8789; E mock 8790/dashboard 5174. A private port does not isolate a shared JSON store. Browser/smoke scripts mutate data and screenshots: serialize writers per backend/store, preserve evidence, never kill another agent's service, and coordinate the real-demo exclusive window. B must coordinate its private pair with C/D/E before using these reserved ports.

Every READY message includes branch + exact SHA, scope, contract version, commands/results, fake/injected/real mode, backend/store, evidence location and open checks. Update your own status only. Push source before handing off. Mark a task complete only with attributable evidence.

**Required critical path:** A reset fix and B final map (parallel) → E combined verification → D/E/human live acceptance → two rehearsals + recordings → freeze/tag. Public hosting/HTTPS/download preparation can run alongside this once hosting is chosen; final walkthrough waits for UI acceptance. Whole-class upload and multi-site support are outside this critical path unless the human explicitly adds them to the demo.
