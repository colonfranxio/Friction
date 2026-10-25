# API reset + final learning-map integration

Baseline main `655f42d`. Integrated in the required order:

1. A `agent/platform` **`ab34e32`**, merge **`ea647d4`**: per-student uploaded-course reset restores usable active-course states.
2. B `feature/learning-map` **`259cc3a`**, merge **`1a7e910`**: final map-only embed on the existing concept-card canvas, click details, Escape/Close/focus return and live state. Existing extension source/safety remains unchanged by this merge.

No request/type shape, contract version, model prompts, Moss runtime, shared tree rules or existing canvas/layout change. The shared reset-request comment is clarified only. `proposal/narrow-wrap` and `feature/multi-site` are excluded. No new third-party service or deployment was provisioned.

## Verification on combined code

| Gate | Result |
|---|---|
| Ownership review, frozen install, workspace typecheck | PASS |
| API tests after A merge | PASS — 95 |
| Root suite after B merge | PASS — **316 tests /26 files**: shared26, dashboard9, intelligence65, extension109, API95, scripts12 |
| Extension and dashboard builds | PASS |
| Standalone cancellation / upstream-failure regressions | PASS / PASS |
| Fake-backed real API v4 smoke | PASS — 17/17 |
| Certified external extension/API suite | PASS — 19/19, full reviewed API SHA supplied explicitly |
| Embed browser suite | PASS — five-card row at 360/390/420, actual bounds, readable details, Escape/Close/focus, full Student route, unknown-student Retry, gold mastery and 4/4 live without reload |
| Existing dashboard demo, editing, polish/reduced-motion, v4 and resilience browser suites | PASS |
| Visual browser suite | PASS — desktop/laptop/mobile educator, student, sandbox and upload |
| Built panel + real dashboard iframe with simulated chrome.storage | PASS — 360/420 map/details/live mastery, consent unload, storage reload, unknown student, unreachable Retry |

The visual suite is an unchanged-assertion temporary copy with imports/URLs/evidence relocated to E's private mock/dashboard. No tracked screenshot changes were required. Private memory API 8791, mock 8792, dashboards 5175/5176; writers serialized per backend/store. Existing A/C/D services and demo data were left alone. Browser evidence is under `/tmp/friction-demo-ready-evidence/`; the simulated panel wrapper used `/tmp/friction-combined-evidence/panel/`.

The simulated panel test is not actual Chrome host-permission/sidePanel.open or logged-in claude.ai acceptance. Its JavaScript assertions passed; external fonts were blocked and console warnings occurred, so no clean-console claim is made.

Independent read-only `verify_demo_ready_merge` (agreed gpt-6.1-sol medium substitute) reviewed both source tips, reset/inactive-state semantics, ownership, unchanged extension/canvas, focus and SSE handling: **PASS, no blockers**. Tests and service orchestration were performed by E. No builder-source fixes were introduced by E in this round.

## Resolved and remaining work

**Resolved:** the uploaded course remains active with L1/unpaused states after per-student reset; seed resets and other students are preserved. The final embedded learning map is integrated without restoring old pillar layout/zoom/dragging. The existing safety guards remain present. Design/layout docs and the readiness task document now reflect these completed tasks.

**Next:** D/E/human run the real extension-first acceptance on the credentialed demo machine: teacher upload → Moss ready → guided Claude turn → answer → gold mastery live → same mastered concept in a new chat gives full help → bypass/quota/teacher notice. Reload the final extension/tab and use the same API/store for dashboard and extension. Then complete three consecutive real-model smoke passes, two rehearsals and the submission/backup recordings.

No root .env or exported Claude/Moss credentials exist here; fresh real-model/paid retrieval checks and human rehearsals were not performed. Historical live Moss evidence is not a fresh check of this UI release. Public hosting, production HTTPS extension access, visitor isolation/usage limits and the final walkthrough remain separate pending tasks. CR-2 whole-class upload is conditional and unimplemented; this merge retains the honest Alex-only upload flow.

All agents should merge published main before continuing. B should not reintroduce the old vertical pillar implementation. C/D preserve the current card canvas and approved safety code. Use [DEMO-READINESS-TASKS](../DEMO-READINESS-TASKS.md) Phase 3/Phase 4 for the remaining work. This is **technical integration readiness**, not a claim of completed human/live demo acceptance.
