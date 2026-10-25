# D demo verification handoff

Integrated `agent/extension` **`ed2b6bf`** after main `35f01d5`. The delta is **only 38 lines in D's own status file**. Source/config/dependencies are unchanged; no previous A/B work is replaced. Whitespace, ownership and runtime-diff checks pass. This documentation merge does not warrant repeating the already-passed full runtime suite.

D reports Phase1 verification on baseline `655f42d`: extension typecheck/build,109 tests, certified external API19/19, legacy18 pass/1 deliberately gated skip, and Chrome for Testing unpacked startup/popup/icons/side-panel checks. These are D's attributable results, not fresh E-executed live checks. Main's more recent combined verification remains in [DEMO-READY-INTEGRATION](DEMO-READY-INTEGRATION.md).

D's reported full-Student-page panel finding was correct for that older baseline. **Resolved on current main:** B's `259cc3a` embed is integrated and its browser/iframe checks passed. Do not reopen or reimplement it based on the historical finding.

**D Phase1 is complete; Phase3 live acceptance remains open.** Use D's new twelve-point checklist with the final main extension build on the credentialed, logged-in demo machine: setup, first send/hidden block, live gold mastery, same mastered concept in a new chat, approved prompt bypass, bypass races, consent, side-panel opening, multi-tab, offline/recovery, extension reload and educator privacy. D explicitly did not claim those logged-in checks were run.

Next: D/E/human execute that exclusive-backend live window, then the rehearsals/recordings. Public hosting and HTTPS extension support still need a host choice. The separate `candidate/demo-ready`, narrow-wrap and multi-site branches are not included in this merge.
