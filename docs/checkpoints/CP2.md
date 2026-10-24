# CP2 integration report (2026-10-24)

**Code merge complete; CP2 acceptance is BLOCKED.** The latest pushed builder work is integrated on `main`, but independent real-Claude validation is unavailable in this instance and an inherited A↔B stream-cancellation defect needs A's fix. Do not describe CP2 as passed or demo-ready.

Contract version: **v3**. C's optional exact quiz-attachment header is defined and implemented in E's mock; A/C's real endpoint/UI rollout remains pending. See [the changelog](../contracts-CHANGELOG.md) and [demo runbook](../demo-runbook.md).

## Branch integration

| Agent | Source tip | Integration | Result and limits |
|---|---|---|---|
| B Intelligence | `00a5d4d5097d12eb9e0375e813b040f451a6a4a0` | `6ca6cce` | Merged real streaming chat, parse, classifier fallback/cache, harness and tests. 39 tests pass. B's stored live-harness results are builder evidence, not E's independent live validation. |
| A Platform | `9736d6f2936be29a37fa0b80271eb2ad22cfc70e` | `b3c25d3` | Merged chat-failure quiz cleanup, parse-cache tests and CP2 verification notes. 53 tests pass; cancellation gap below remains. |
| C Dashboard | `bbd45c70a3b1839967dd2f5c4c3d4864fbcd05bd` | Already included at CP1 (`e4e34ac`) | No new commits to merge. Existing full browser demo passes against current API with fake intelligence. |
| D Extension | `12b2c8a9b9a1ddd0cd9e0b5886ec6937ef7b5689` | `56a6b39` | Only contract-version status confirmation was new. 35 tests and separate 9-case API integration run pass; consent followup remains. |

Fetched all builder refs, read remote status files, and checked ownership before merges. B → A → C → D order was preserved; C was an explicit no-op. Frozen dependency installation and workspace/scripts typecheck passed after each changed merge. No conflicts, lockfile regeneration, builder-code edits or skipped source tips. Final ancestry/source comparisons preserve all four source tips and owned files exactly. E's changes are limited to shared constants, reference mock, verification scripts and docs.

## Executed checks

| Check | Result |
|---|---|
| Frozen installation after merges | PASS |
| `pnpm typecheck` | PASS after merges and v3 addition; scripts also rechecked after the new regression tool |
| `pnpm test` | **151 passed across 16 files**: shared 18, intelligence 39, dashboard 3, extension 35, API 53, smoke tools 3 |
| `pnpm smoke` on API 8787, fake intelligence | **PASS, 16/16**, contract 3 |
| `pnpm smoke:mock` on 8788 | **PASS, 16/16**, including v3 exact quiz header and exposure |
| Dashboard production build | PASS |
| Extension build | PASS |
| Dashboard full browser demo on 5174 → API 8787, fake intelligence | PASS after restarting the stale Vite process; initial run hit `ERR_CONNECTION_REFUSED` when that process stopped |
| `pnpm --filter @friction/extension test:api` on 8787, fake intelligence | **9/9 passed**; repeated integration cases, not nine additional unique unit cases |
| `pnpm exec tsx scripts/verify-chat-abort.ts` | **FAIL**: interrupted reply leaves `quiz_pending=true` |
| Real chat prerequisite check using B's actual factory and `.env.example` model | **BLOCKED** locally: `Could not resolve authentication method` |
| Real-Claude smoke three consecutive runs | **UNRUN**: missing credential and model bindings in this instance |
| All six visual must-haves with real Claude and human rehearsal | **UNRUN**; fake-backed browser success is not this gate |

Browser evidence from this run is under `/tmp/friction-cp2-evidence`. E restored the four overwritten tracked screenshots after preserving the generated evidence, leaving C's source/artifact tree unchanged. The browser test covered upload, L1 streaming, live L4 on educator/student/sandbox, new chat/full answer, bypass and toast, quota exhaustion, reset and mobile width. Its deterministic reply assertions were tested on fakes only.

## Blocking A-owned cancellation defect

Reproduce without credentials, persistent files or a running API:

```text
pnpm exec tsx scripts/verify-chat-abort.ts
```

The verification tool uses A's in-memory app plus B's real factory with an injected SDK stream. It reads one partial chunk, cancels the response reader and waits for cleanup. Current result: SDK aborted, partial text saved, **quiz still pending**. Expected: keep the partial text but clear the unseen/interrupted quiz.

At `apps/api/src/routes/chat.ts:79`, A treats any normal iterator completion as success. B's documented abort handling at `packages/intelligence/src/chat.ts:19` ends the generator quietly, so A must include `!abort.signal.aborted` in its completion decision. Add an A-owned endpoint regression using B's quiet-abort behavior, not only a fake generator that throws.

The independent verifier reproduced this with both A's CP1 route at `355fcac` and the current CP2 route using current B. It confirmed in memory that changing the completion decision to `complete = !abort.signal.aborted` clears the quiz. This is an inherited lifecycle defect incompletely addressed by CP2, not a new failure introduced by A's CP2 diff. Reverting that diff does not resolve it. E retained the source merges, saved a failing standalone regression, and left the checkpoint gate open; E did not modify A's code or weaken the assertion.

## Credential/configuration blocker

Inspected configuration metadata and actual variable presence only. No saved credential requirements/bindings, no exported `ANTHROPIC*` variable, no root `.env`, and none of the four `MODEL_*` variables were present. Keys used in another agent's machine do not establish a binding here.

An unauthenticated HTTPS GET reached `api.anthropic.com/v1/messages` and returned the expected **405 Method Not Allowed**, so runtime connectivity was demonstrated. B's actual chat factory, with the model selected from `.env.example`, then failed locally for missing authentication before a model request. No live model call or three-run gate was claimed.

Saved an additive environment draft requirement for `ANTHROPIC_API_KEY` scoped to `api.anthropic.com`, and suggested the four non-secret model defaults from `.env.example`. The save added that hostname to the configured restricted network destinations. It did **not** supply a secret value, apply runtime configuration or publish. The user must enter the key securely in environment settings, review/save the configuration and publish as required by the environment UI. Never put the value in chat, source, reports or scripts. Recheck actual bindings and operations after applying settings.

## v3 rollout and followups

- **E completed:** optional `CHAT_HEADERS.quizAttached` (`X-Friction-Quiz-Attached`), exact boolean-string semantics, mock emission/CORS and smoke validation. Original three headers remain required. Real API omission is permitted during rollout; a present header must have the exact value and exposure. No current API check was weakened.
- **A next:** emit the optional header from `ic.quiz_attached` in real `/chat` and add endpoint tests. Implement the blocking cancellation fix first.
- **C next:** consume the optional header when available and retain fallback when absent. Current approximate low-level hint remains; low level does not prove a new quiz was attached.
- **D next:** add a defensive consent-enabled guard and no-fetch regression to `handleBypass` (`apps/extension/src/background.ts:111`), as already reported at CP1. Current popup guards do not protect queued/programmatic bypass messages. Complete the remaining human live claude.ai flow separately.

## Independent verification

`verify_cp2_integration` used the agreed `gpt-6.1-sol` medium substitute for unavailable Sonnet 5.5. It independently passed the 151-test suite and typecheck, checked ancestry/ownership/source preservation and v3 compatibility, and exercised four A↔B paths with an injected SDK: L1 chat, grade → persisted L4, classifier fallback, noncached parse storing eight nodes. These deterministic integration checks are not live-Claude evidence.

It discovered and reproduced the blocking cancellation issue, confirmed its inheritance and the in-memory candidate fix, and reconfirmed D's existing consent followup. The standard green unit suite does not cover the newly reproduced cancellation case. This report preserves the failing outcome alongside the passed checks.

## Messages to agents / remaining gate

- **A:** CP2 code is merged but acceptance blocked. Merge `main`, read v3 and confirm in your status file. Run the new standalone cancellation regression, fix the completion/abort decision in your owned route, add the quiet-abort regression, push and notify E. Then implement/test the exact quiz header. E must rerun the failing check before acceptance.
- **B:** CP2 code is merged. Merge `main`, read v3 and confirm. E passed 39 tests and injected-SDK integrations; your live harness results remain your evidence. E's cloud instance has no Anthropic credential yet. Preserve quiet cancellation and late-grade semantics; coordinate A's lifecycle fix.
- **C:** Your pushed source was already present and remains unchanged. Merge `main`, read v3 and confirm. The browser demo passes against the current fake-backed real API. Adopt the optional exact quiz header once A emits it; real-Claude visual gate and human rehearsal remain open.
- **D:** Your status update is merged; code is unchanged. Merge `main`, read v3 and confirm. Nine API integration cases pass on the fake-backed API. Add the defensive bypass-consent guard/test and complete the remaining real-site loop with the human.
- **Human:** configure the missing secret securely in this cloud environment and relay A's blocking fix. After the fix and credential are available, rerun the cancellation regression, real-Claude smoke **three consecutive times**, all six visual must-haves and the full rehearsal using the runbook. CP3 rehearsal/recording/freeze is not complete.
