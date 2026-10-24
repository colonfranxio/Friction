# CP2 integration report (2026-10-24)

**A's code blocker is resolved; CP2 live acceptance remains open.** A's fix `d757427` from PR #1 is merged at `c657422`, and E independently reran the previously failing cancellation regression successfully. Independent real-Claude validation, the real-model visual gate and human rehearsal remain unavailable in this instance. Do not describe those gates as passed or the demo as fully accepted.

Contract version: **v3**. The exact quiz-attachment header is now emitted by both the mock and real API, with API value/CORS tests. C's UI consumption remains pending. See [the changelog](../contracts-CHANGELOG.md) and [demo runbook](../demo-runbook.md).

## Branch integration

| Agent | Source tip | Integration | Result and limits |
|---|---|---|---|
| B Intelligence | `00a5d4d5097d12eb9e0375e813b040f451a6a4a0` | `6ca6cce` | Merged real streaming chat, parse, classifier fallback/cache, harness and tests. 39 tests pass. B's stored live-harness results are builder evidence, not E's independent live validation. |
| A Platform | `d757427f3e159110beceb79de575e6147c367c38` | Initial `b3c25d3`, fix `c657422` | PR #1 head matched this exact SHA. Only API route/tests and A's status changed. Cancellation fixed; exact v3 header emitted; 55 API tests pass. |
| C Dashboard | `bbd45c70a3b1839967dd2f5c4c3d4864fbcd05bd` | Already included at CP1 (`e4e34ac`) | No new commits to merge. Existing full browser demo passes against current API with fake intelligence. |
| D Extension | `12b2c8a9b9a1ddd0cd9e0b5886ec6937ef7b5689` | `56a6b39` | Only contract-version status confirmation was new. 35 tests and separate 9-case API integration run pass; consent followup remains. |

Fetched all builder refs, read remote status files, and checked ownership before merges. B → A → C → D order was preserved in the initial integration; C was an explicit no-op. The followup merges only the user-requested A fix, not unrelated newer B/D commits. Frozen dependency installation and workspace/scripts typecheck passed after each changed merge. No conflicts, lockfile regeneration or E edits to builder code. Source comparisons preserve the integrated source tips and owned files exactly. E's changes are limited to shared constants, reference mock, verification scripts and docs.

## Executed checks

| Check | Result |
|---|---|
| Frozen installation after merges | PASS |
| `pnpm typecheck` | PASS again after merging A's fix |
| `pnpm test` | **153 passed across 16 files** after A's fix: shared 18, intelligence 39, dashboard 3, extension 35, API 55, smoke tools 3 |
| `pnpm smoke` on API 8787, fake intelligence | **PASS, 16/16**, contract 3 |
| `pnpm smoke:mock` on 8788 | Initial integration **PASS, 16/16**, including v3 exact quiz header and exposure; mock unchanged by A's followup |
| Dashboard production build | PASS |
| Extension build | PASS |
| Dashboard full browser demo on 5174 → API 8787, fake intelligence | PASS again after A's fix and service restart |
| `pnpm --filter @friction/extension test:api` on 8787, fake intelligence | **9/9 passed**; repeated integration cases, not nine additional unique unit cases |
| `pnpm exec tsx scripts/verify-chat-abort.ts` | **PASS** after A's fix: upstream aborted, partial reply retained, unseen quiz closed |
| Real chat prerequisite check using B's actual factory and `.env.example` model | **BLOCKED** locally: `Could not resolve authentication method` |
| Real-Claude smoke three consecutive runs | **UNRUN by E here**: missing credential and model bindings; A reports three consecutive 16/16 real runs on its credentialed local machine after this fix |
| All six visual must-haves with real Claude and human rehearsal | **UNRUN**; fake-backed browser success is not this gate |

Browser evidence from A-fix revalidation is under `/tmp/friction-cp2-a-fix-evidence` (initial integration evidence: `/tmp/friction-cp2-evidence`). E restored the four overwritten tracked screenshots after preserving the generated evidence, leaving C's source/artifact tree unchanged. The browser test covered upload, L1 streaming, live L4 on educator/student/sandbox, new chat/full answer, bypass and toast, quota exhaustion, reset and mobile width. Its deterministic reply assertions were tested on fakes only.

## Resolved A-owned cancellation defect

Reproduce without credentials, persistent files or a running API:

```text
pnpm exec tsx scripts/verify-chat-abort.ts
```

The verification tool uses A's in-memory app plus B's real factory with an injected SDK stream. It reads one partial chunk, cancels the response reader and waits for cleanup. Before PR #1 the quiz stayed pending. **Current result: PASS** — SDK aborted, partial text saved, pending quiz cleared.

In PR #1, A changed completion to `complete = !abort.signal.aborted`, accounting for B's documented quiet abort. A also added the endpoint regression using a quietly returning generator. E's standalone check uses B's actual factory, so both the simulated endpoint behavior and real A↔B lifecycle are covered without live credentials.

Historical diagnosis: the initial independent verifier reproduced the defect with both A's CP1 route at `355fcac` and the initial CP2 route using current B. E retained the initial source merge and recorded the failing standalone regression rather than changing A's code or weakening the assertion. The new `verify_cp2_a_fix` agent independently confirmed the merged fix and regression now pass, with no blocking findings for A's fix.

## Credential/configuration blocker

Rechecked configuration metadata and actual variable presence after A's re-submission. The saved `ANTHROPIC_API_KEY` requirement exists, but reports `has_saved_binding:false`. The four model requirements remain pending. No exported API key/auth token, root `.env`, or runtime `MODEL_*` values are present. A's supplied key on its local machine does not establish a cloud binding; E has not requested a duplicate secret or printed values.

An unauthenticated HTTPS GET reached `api.anthropic.com/v1/messages` and returned the expected **405 Method Not Allowed**, so runtime connectivity was demonstrated. B's actual chat factory, with the model selected from `.env.example`, then failed locally for missing authentication before a model request. No live model call or three-run gate was claimed.

The existing additive environment draft requirement scopes `ANTHROPIC_API_KEY` to `api.anthropic.com` and suggests the four non-secret model defaults from `.env.example`. The initial save added that hostname to the configured restricted destinations. It did **not** supply a secret value, apply runtime configuration or publish. For independent cloud reruns, supply the value securely through environment settings and apply the pending settings; never put it in chat, source, reports or scripts. Recheck the actual bindings and operations after applying settings. A's three reported consecutive real-Claude runs after the fix are recorded as external builder evidence rather than E-executed results.

## v3 rollout and followups

- **E completed:** optional `CHAT_HEADERS.quizAttached` (`X-Friction-Quiz-Attached`), exact boolean-string semantics, mock emission/CORS and smoke validation. Original three headers remain required. Real API omission is permitted during rollout; a present header must have the exact value and exposure. No current API check was weakened.
- **A completed in PR #1:** emit the header from `ic.quiz_attached` in real `/chat`, with tests for true/false/no-match and exposure, and fix quiet-abort completion with its regression. Independent extra coverage confirmed L1 with an existing pending quiz emits `false`, retains the original quiz and exposes the header.
- **C next:** consume the optional header when available and retain fallback when absent. Current approximate low-level hint remains; low level does not prove a new quiz was attached.
- **D next:** add a defensive consent-enabled guard and no-fetch regression to `handleBypass` (`apps/extension/src/background.ts:111`), as already reported at CP1. Current popup guards do not protect queued/programmatic bypass messages. Complete the remaining human live claude.ai flow separately.

## Independent verification

`verify_cp2_integration` used the agreed `gpt-6.1-sol` medium substitute for unavailable Sonnet 5.5. It independently passed the 151-test suite and typecheck, checked ancestry/ownership/source preservation and v3 compatibility, and exercised four A↔B paths with an injected SDK: L1 chat, grade → persisted L4, classifier fallback, noncached parse storing eight nodes. These deterministic integration checks are not live-Claude evidence.

It initially discovered and reproduced the cancellation issue, confirmed its inheritance and the in-memory candidate fix, and reconfirmed D's existing consent followup. After A's re-submission, `verify_cp2_a_fix` independently passed API 55/55, intelligence 39/39, full workspace/scripts typecheck and the actual-B-factory cancellation tool. It checked the L1 already-pending quiz header case in memory and found no blockers for A's fix. The previously missing quiet-abort regression is now part of the standard API suite. Real-Claude runs, real-model visual acceptance and human rehearsal remain separate, unexecuted gates in this instance.

## Messages to agents / remaining gate

- **A:** PR #1 / `d757427` merged; cancellation and exact-header checks pass independently. Merge `main` and retain your local real-Claude three-run evidence. No further cancellation fix is requested.
- **B:** CP2 code is merged. Merge `main`, read v3 and confirm. E passed 39 tests and injected-SDK integrations; your live harness results remain your evidence. Preserve quiet cancellation and late-grade semantics. No unrelated newer B commits were merged in this A-fix task.
- **C:** Your pushed source remains unchanged. Merge `main`, read v3 and confirm. The browser demo passes against the fixed fake-backed API. A now emits the optional exact quiz header, ready for you to consume with fallback; real-Claude visual gate and human rehearsal remain open.
- **D:** Your status update is merged; code is unchanged. Merge `main`, read v3 and confirm. Nine API integration cases pass on the fake-backed API. Add the defensive bypass-consent guard/test and complete the remaining real-site loop with the human.
- **Human:** A's code blocker is resolved. To rerun the remaining gates independently here, apply the secure cloud credential/model bindings, then run real-Claude smoke **three consecutive times**, all six real-model visual must-haves and the full human rehearsal using the runbook. A reports that the three-run smoke passes on its credentialed local machine; E has not represented that as cloud-executed validation. CP3 rehearsal/recording/freeze is not complete.
