# Status: Agent B (intelligence)

**Owned by Agent B. Only this agent edits this file.**

- Contract version confirmed: 1
- Current checkpoint: CP1 (done, pushed)
- Last updated: 2026-10-24

## Exit criteria for the current checkpoint (CP1)
- [x] `templates.ts` done for all 4 levels, with feedback and quiz variants; unit tests check the format (delimiters, the `Level:` line, the L4 passthrough, the raw prompt first). *Verified: `test/templates.test.ts`, incl. body ≤120 words for every seed node × level.*
- [x] Keyword classifier, with unit tests on the seed nodes (all 4 `DEMO_PROMPTS` route correctly; "write a haiku" → null). *Verified: `test/classify.test.ts`. question + correctAnswer → React useEffect, bypassQuestion → Context API, lazyAnswer → null (it carries no concept; the pending quiz decides its node per contracts §4), haiku → null, whole-word only, <5ms/call.*
- [x] Real `evaluateExchange`; unit tests with a mocked client; **latency measured and reported**. *Verified: `test/evaluate.test.ts` (mocked) + live run below.*
- [x] `createIntelligence()` wired up (parse + chat still return the shared fakes until CP2) and `pnpm typecheck` passes.

### Grade latency (live, `pnpm --filter @friction/intelligence latency`)
**p50 2335ms · p95 3700ms · max 3700ms** (claude-opus-5-5, effort low, n=10, sequential). All 10 verdicts matched expectations (correct / lazy / incorrect / partial / not_an_answer). Full table: `packages/intelligence/harness/results/latency.md`.
Within the 4s budget, but p95 is close. If on-stage grades land late, the late-grade path (contracts §4.5) still applies them. Human decision available per PLAN §8: set `MODEL_GRADE=claude-haiku-5-5` for speed.

## Change requests (contract)
1. **Abort signal for `evaluateExchange`.** *What:* add optional `signal?: AbortSignal` to `EvaluateInput` (or a second `opts?: { signal?: AbortSignal }` arg). *Why:* the brief asks B to accept an AbortSignal so A can cancel; the frozen interface has no slot. *Proposed additive change:* `EvaluateInput.signal?: AbortSignal`. *Local workaround in place:* `evaluateExchange` already reads `input.signal` if present (exported type `EvaluateArgs`), so A can pass it today with no type error via an object variable. Without a signal, calls still time out at 20s (SDK timeout, 1 retry).

## Dependency changes
None.

## Assumptions
- `createIntelligence(opts?)` accepts `{ client?, models? }` for test injection; with no args it reads `MODEL_*` and `ANTHROPIC_API_KEY` from env lazily, so importing the package never needs a key.
- The quiz line is only added when `includeQuiz && level < 4` (same as the fake; contracts §4.7 never asks for a quiz at L4).
- L4 with `feedback: {verdict: 'not_an_answer'}` still emits a block (contracts §5: "L4 with feedback ⇒ a block"), but it carries no Feedback line, so it just says "help fully". Harmless; flagging in case E prefers a passthrough.
- The API key must be scoped to a workspace (an unscoped org key gets a 400 asking for `anthropic-workspace-id`).

## Blockers / needs from the human
None.

## How to run and verify my part
```
pnpm --filter @friction/intelligence test       # 22 tests: templates, classify, evaluate (mocked)
pnpm typecheck
pnpm --filter @friction/intelligence latency    # needs .env key; prints 10 graded rows + p50/p95
```
