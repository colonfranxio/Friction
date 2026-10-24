# CONTRACT READY — v4

Latest integration: [CP3 dashboard report](CP3.md). C is merged with the real-API rollout guard; A's v4 candidate is held for a timestamp-tie test correction. This handoff's original evidence below remains historical. Do not enable real prompt bypass until E records the approved corrected API merge.

Contract commit: **`a11c16a1e7ead6f657ee71b9f627a4c3195ce3b6`**. Merge current `main` (which includes that commit and this handoff reference); confirm v4 in your own status file before wiring new fields.

This is the pre-freeze coordination checkpoint requested by A's PR #2 and the remaining-work briefs. **Shared types, reference mock, regression tools and specification are ready. The real API is NOT yet API READY for v4.** Merge the published contract commit/main before implementing the owner checklist below. The version shown by `/health` does not establish feature readiness.

## Integrated builder work

- B READY `d7d0f33` merged at `2070022`: 42 unit tests, repeated/rephrased-question grading cases and fresh live-harness evidence; non-natural chat stops now throw. Caller cancellation still returns quietly. No prompt tuning was needed. B's live harness is external evidence, not E's live gate.
- A PR #2 head `0c2ad041c5242b4b101d5652a1773fb3d4a5e335` matched the PR ref and merged at `e01e724`: 57 API tests and status only. The two new tests correctly pin old mid-stream clean EOF and concept-bypass behavior. No wire implementation was smuggled into this merge.
- E reviewed proposal `682c085`, implemented an adapted fake-grader guard and eight regressions without merging D's broader branch/history. Repeated/new questions and exact quiz echoes no longer earn mastery merely from keywords; tested short and tentative question-shaped answers still work. The deterministic fake is not a semantic replacement for the real grader.

## Decision 1 — failure means a rejected body read

Accept A's proposal: keep `text/plain` and existing headers. Before the first chunk, retain structured 502/504 errors. After streaming starts, a generation error/refusal/truncation must error the body, not produce clean EOF or append JSON. Save partial text, close the unseen quiz, and keep caller cancellation distinct. No failure-only header/trailer protocol is introduced.

**Pinned-stack experiment:** on actual ephemeral localhost HTTP, an explicitly errored native `ReadableStream` rejects the fetch body reader after a delivered chunk. Hono `stream()` callback throw and `s.abort()` both yield clean EOF. A must use an actually errorable response stream, not merely invoke the helper's abort. Preserve pre-first-chunk mapping, client-cancel cleanup and late grading. D's claude.ai send path does not consume sandbox chat bodies.

E added `pnpm exec tsx scripts/verify-stream-failure.ts`: it gates upstream failure until the client has read the first chunk, uses an isolated in-memory API and ephemeral HTTP server, and checks reader rejection plus partial-text/quiz cleanup. It currently **FAILS** on A's old route, as expected from the characterization test. It must genuinely pass before API READY; do not weaken it or keep the old clean-EOF assertion as the new desired behavior.

## Decision 2 — explicit prompt scope with legacy default

- `BypassRequest.scope?: 'concept' | 'prompt'`. Omitted/`concept` keeps today's pause-until-reset behavior and repeat-charge behavior.
- `prompt` spends one quota, clears pending quizzes and emits the existing educator notification, but does not change mastery, set pause or undo an existing concept pause. Unknown scope/bad binding is 400 before mutation; empty quota is 409.
- **D direct resend:** omit the new binding fields; after success resend the exact intended message once to claude.ai without another intercept. Keep consent, current-chat/draft/busy guards and expiry; future ordinary sends still get friction.
- **C sandbox resend:** supply both optional `raw_prompt` and `conversation_id` with prompt scope. The response additionally supplies opaque `prompt_bypass_token`, bound to student, node, exact text and conversation for 120 seconds. Pass it once as `ChatRequest.prompt_bypass_token` with the matching last user message. A atomically consumes it before generation and streams this call as L4/quiz=false without grading or changing mastery. It still logs safe matched-node activity and saves the reply normally. The next ordinary turn has normal friction.
- Charge only issuance, not token consumption. Reject replay, expiry, mismatch and invalidated tree/node with 400 before model calls. Mismatches do not consume the valid binding. Reset/reparse invalidate affected tokens; restart may discard them. Cancellation/failure does not refund or re-arm a consumed token. No automatic retry/reissue that spends more quota. Tokens/raw text never appear in educator events.

The optional fields preserve old clients. There is no unvalidated `bypass:true` flag, global credit, default-scope switch or extra quota-free API call. The mock implements this full flow; the real API still needs A's implementation.

## Owner handoff and execution order

1. **A: go ahead now.** Merge the v4 contract commit, implement real stream errors, prompt scope, one-use token issue/consume/reset lifecycle and tests inside `apps/api/**`. Replace the old mid-stream characterization assertion with the required rejected-read test. Preserve legacy concept tests, early 502/504, cancellation and late grades. Test token expiry with an injected clock, atomic concurrent replay, mismatch without consumption, quota-once, reset, no promotion/pause and privacy. Publish `API READY` with SHA, exact commands and mode.
2. **C and D: proceed in parallel against the updated mock** after merging this contract. Restart only your own mock process so it loads v4. C can finish exact quiz-header display immediately; implement guarded token-bound sandbox resend and interruption UI. D must explicitly request prompt scope and retain its existing guarded direct resend; preserve consent/chat/draft safety. Do not send new fields to an old real server that may ignore them. Live integration waits for A's API READY SHA, not just health/version.
3. **B:** merged and ready for this handoff. Preserve natural-stop versus cancellation/failure distinction. Keep frozen-prompt results and latency provenance. Coordinate only if A identifies a concrete SDK-boundary defect.
4. **E:** review A/C/D readiness, merge remaining eligible work B → A → C → D, independently verify the integrated build and then close real-model acceptance. No CP3 freeze yet. Builders modify only their owned folders/status; E owns shared/mock/tool/docs and combined lockfile.

## Validation evidence and required next gates

- Frozen installation and typecheck after both merges: PASS. Root suite after E's changes: **175 tests passed across 17 files** (shared 26, intelligence 42, dashboard 3, extension 35, API 57, scripts 12).
- Both builds: PASS. Standalone cancellation regression: PASS. Old API fake smoke: **16/16 PASS**. Private v4 mock smoke `pnpm smoke --url http://127.0.0.1:8790 --require-v4`: **17/17 PASS**. Nine private-mock regressions include default/explicit concept, prompt/no pause, quota/invalid scope, cancellation and bound one-use sandbox token cases.
- Current API-backed fake browser demo and extension API integration: PASS (9 extension cases, not additional unique unit cases). Browser screenshots retained in `/tmp/friction-v4-evidence`; E restored only generated tracked screenshot changes.
- Independent `verify_contract_v4` (`gpt-6.1-sol`, medium, the agreed substitute) passed 38 focused shared/mock/event tests and separately checked cross-student mismatch, expiry with a simulated clock and concurrent token replay over real HTTP. Its transport experiment proved native body errors reject and Hono helper abort/throw do not. It independently passed A 57/B 42 tests, early 502/504 and quiet cancellation. No builder/source/ref changes were made by the verifier.
- Standalone real-HTTP stream-failure regression: **FAIL against the current API**, the exact outstanding A implementation gate. Passing old characterization tests does not satisfy it.
- Before API READY, require updated API tests/typecheck, both standalone stream/cancel tools, and `pnpm smoke --require-v4` on A's owned fake-backed API. Add the token endpoint cases above; the smoke flag also checks prompt scope but is not a substitute for all token tests.
- Independent real-Claude smoke x3, all six real-model visual must-haves, human rehearsals and the final recording/freeze remain open. This instance still has no API key or `.env`; do not duplicate a requirement or claim B's/A's local results were run here. Use the credentialed demo machine or securely apply the existing cloud bindings.
- In a shared host keep A API 8787, C mock 8788/dashboard 5173, D mock 8789, E private mock 8790/dashboard 5174. Serialize destructive tests per store, not merely per UI port; never share one JSON store between API processes. The independent verifier uses ephemeral ports/memory only.
