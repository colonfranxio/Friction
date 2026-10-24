# Final integration check — 2026-10-24

Checked main **`6b18efb54ef1366945036dec07716077c1181aab`**, contract v4. **Overall: NOT READY for final acceptance/freeze.** The existing fake-backed demo passes; the complete coordinated v4 product is not integrated.

Fetched all agent branches. B `f7113fd` and C `d7866f8` are integrated. A `d6badeb` and D `dcc2f9d` remain unmerged; neither has a newer pushed correction. This check did not merge or modify builder code.

## Fresh checks

| Check | Result |
|---|---|
| Frozen install, workspace typecheck | PASS |
| Root tests | PASS — 181 tests, 18 files |
| Dashboard production build, extension build | PASS |
| Real API with fakes, legacy smoke | PASS — 16/16 |
| Private v4 mock smoke | PASS — 17/17 |
| API-backed browser demo | PASS — upload, metadata, live mastery, new chat, legacy bypass/toast, quota/reset/mobile |
| Extension background/API integration | PASS — 9/9 (overlap existing unit cases) |
| Dashboard v4 browser checks on mock | PASS — exact quiz, guarded bound resend, next-turn friction, interrupted-read recovery, draft/history/expiry/cancel guards |
| Dashboard polish/reduced-motion browser checks | PASS |
| Dashboard resilience/PDF transport and educator editing browser checks | PASS |
| Quiet-abort standalone regression | PASS |
| Upstream-failure standalone regression | **FAIL** — API emits clean EOF after partial text |
| Real API with fakes, `--require-v4` smoke | **FAIL** — prompt bypass pauses the concept; required no-pause assertion fails |
| Real-Claude smoke x3 and semantic browser acceptance | NOT RUN — no API credentials in this instance |
| Live claude.ai extension, Windows gate, rehearsals/recording | NOT RUN in this cloud check |

The mock's injected disconnect verifies C's UI; it does not prove the current API signals disconnects correctly. Health v4 does not certify prompt-bypass support. Keep `VITE_PROMPT_BYPASS_API_READY_SHA` unset for this API; C correctly uses concept pause-until-reset and does not perform a token resend.

Checks used a private in-memory API on 8791, private mock on 8792 and dashboards on 5175/5176. Writers were serialized per backend. Existing services/stored demo data were not reset. Evidence: `/tmp/friction-final-evidence/`. Only the check report changes in this round.

Independent `verify_final_integration` used the agreed gpt-6.1-sol medium substitute. It confirmed branch ancestry, A's unfixed timestamp assertion, D's rollout deviation, dashboard fallback and outstanding acceptance gates. Its direct-binary dashboard tests passed 9/9; it independently reproduced quiet-abort PASS and stream-failure FAIL using memory/ephemeral ports. Its initial pnpm launcher attempt failed before tests; direct existing binaries supplied the reported independent results.

## Required completion order

1. **A:** correct the test's timestamp-tie assumption (`api.test.ts:330` on A's branch). Validate the bypass record without assuming index zero; preserve all state/quota/event assertions. Push corrected API READY. E then re-merges and reruns root tests, stream/abort regressions and real-API v4 token checks. A's pending runtime code contains the needed stream-failure and prompt-token implementation.
2. **D, in parallel:** resolve its acknowledged deviation from the handoff's old-server gate; preserve consent/chat/draft guards and publish a compatible handoff. These hardenings are absent from the current shipping extension. E reviews/merges it after the API is ready, then repeats extension/API checks; human confirms live GO.
3. **C:** after E approves the actual API revision, configure that full rollout SHA and verify one-prompt resend against the merged real API. A SHA-shaped string alone is not proof of readiness.
4. **B/A/E:** the non-demo whole-class syllabus assignment is still an open request, not implemented by the B status merge. Coordinate its scope before final freeze if required for the demo.
5. **E + human:** on final merged code run three consecutive real-Claude smoke passes, inspect all six semantic must-haves, complete supported Windows validation, two rehearsals and the backup recording. Then freeze.

See [CP3](CP3.md) for the precise held-A failure and agent handoffs. Passing the current root suite does not close these blockers.
