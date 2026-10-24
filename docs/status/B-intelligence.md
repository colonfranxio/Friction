# Status: Agent B (intelligence)

**Owned by Agent B. Only this agent edits this file.**

- Contract version confirmed: 1 (re-read after PLAN v5 and E's CP1 preflight / v1 verification amendment, 2026-10-24: no shape changes; merged main into this branch)
- Current checkpoint: CP2 (done, pushed). Next: CP3 (L3 ≥4/5 is already 5/5; freeze prompts, list known-good demo prompts)
- Last updated: 2026-10-24

## Exit criteria: CP2
- [x] Streaming `chat()` (`src/chat.ts`): `MODEL_CHAT`, system "You are a helpful programming assistant.", yields `text_delta`s only, passes messages through untouched (never strips/reveals the block), forwards the AbortSignal and ends quietly on abort (like the fake), aborts the request if the consumer stops early, throws on refusal/API errors. *Verified: `test/chat.test.ts` + live harness.*
- [x] Real `parseSyllabus` (`src/parse.ts` + `src/validate.ts`), text and PDF, streaming + `finalMessage()`, effort high, structured output; then validation (unique keys, unknown/self deps dropped, cycle-closing edges dropped via `wouldCreateCycle`, levels clamped 1–4, icons forced into `ICON_KEYWORDS` (fallback `circle`), keywords lowercased/deduped, unknown pillar → case-insensitive match else first pillar, max 15 nodes). *Verified live on `fixtures/demo-syllabus.md`: text and PDF both give 3 pillars, 8 nodes, "React useEffect" present, and the demo question keyword-routes to it (~10s each). The PDF is generated from the fixture at runtime by `harness/pdf.ts` (no dependency).*
- [x] LLM classify fallback + cache (`src/classify.ts`): only when keywords miss; `MODEL_CLASSIFY`, effort low, structured `{concept index|null, confidence}`; null unless confidence ≥0.5; LRU 500 keyed by sha1(prompt + sorted node ids); 3s timeout, no retries; a failure/timeout returns no match and is not cached (contracts §4). Compiled keyword regexes are now cached (CP1 checker note). *Verified: `test/classify.test.ts` + live 3/3 (Context API, Performance, haiku → null).*
- [x] Harness (`pnpm harness`), results in `packages/intelligence/harness/results/latest.md`:
  - **L1 5/5 · L2 5/5 · L4 5/5** (L3 5/5 too, the CP3 gate)
  - **Grading 5/5** (correctAnswer → correct, lazyAnswer at L3 → lazy, partial, incorrect, not_an_answer)
  - **Demo answer vs the real quiz in each L1 reply: 5/5 correct** (10/10 over the two tuning runs before the final run; this is must-have #4's real risk, since on stage the quiz is whatever Claude asked)
  - **3-turn exchange pass** and reads naturally: L1 hint + one question → correct answer graded (demo mode → L4) → confirms "Exactly right" + why, then full answer → new chat, same question, no block, full answer.
  - Parse text + PDF pass; classify fallback 3/3.

### How the harness scores
L1: no code fence, last line ends with "?". L2: every fence has a `____`-style blank; a blank-free fence goes to a Haiku judge (`MODEL_CLASSIFY`) asking "is this a ready-to-paste fix?", because short snippets that only *show the bug* are fine scaffolding. L3: has code and says "bug". L4: has a code fence. All: no mention of friction / instructions / tutor context / private notes / the delimiter.

### Prompt changes made while tuning (CP2)
- Quiz line: one single-sentence question on the core idea, no "and" follow-up. Compound quizzes were making correct answers grade as partial.
- Grader: judges the central mechanism of the learning goal at the **student's level** (now passed in as `level of 4 (Bloom label)`; below L3, explaining the idea is enough); for multi-part questions, the part closest to the goal is enough. Partial/incorrect/lazy cases still grade correctly.
- L2: blanks written as `____`.

### Latency
- Grade (`pnpm --filter @friction/intelligence latency`, sequential n=10, Opus 5.5 effort low): **p50 2447ms · p95 5188ms** (the p95 is the single slowest call, an "incorrect" case; the other 9 were ≤3.1s; demo correctAnswer took 2.1–2.3s). At CP1 the p95 was 3.7s. An occasional grade will miss the 4s budget, and the late-grade path (contracts §4.5) covers it. The human kept Opus for grading accuracy.
- Chat time to first token (5 concurrent per level): L1 ~1.0–1.2s, L2 1.3–2.7s, L4 1.1–1.9s, **L3 6.9–10.9s** (it thinks before planting the bug). L3 is CP3/nice-to-have, but A/C should expect a pause there.
- Parse ~10s (text or PDF). Classify LLM fallback ~1–2s.

## Exit criteria: CP1 (done)
- [x] Templates for all 4 levels with feedback and quiz variants; keyword classifier; real `evaluateExchange`; `createIntelligence()` wired; `pnpm typecheck` passes. CP1 grade latency: p50 2335ms, p95 3700ms.

## Change requests (contract)
1. **Abort signal for `evaluateExchange`.** *What:* add optional `signal?: AbortSignal` to `EvaluateInput`. *Why:* the brief asks B to accept an AbortSignal so A can cancel; the frozen interface has no slot. *Local workaround in place:* `evaluateExchange` already reads `input.signal` if present (exported type `EvaluateArgs`). Without a signal, calls still time out at 20s (SDK timeout, 1 retry). *On E's cancellation question:* B never aborts on its own; the signal is only for A, e.g. on shutdown. A should **not** abort a grade at the 4s intercept deadline, because late grades must still apply (contracts §4.6).

## Dependency changes
None.

## Assumptions
- `createIntelligence(opts?)` accepts `{ client?, models? }` for test injection; with no args it reads `MODEL_*` and `ANTHROPIC_API_KEY` from env lazily, so importing the package never needs a key.
- The quiz line is only added when `includeQuiz && level < 4`.
- L4 with `feedback: {verdict: 'not_an_answer'}` still emits a block (contracts §5) with no Feedback line.
- `chat()` ends silently when the caller aborts (same as the fake) and throws on API errors/refusal. Text already streamed stays streamed.
- `classifyTopic` never throws: an LLM failure or timeout returns `{node_id:null, method:'none'}` (contracts §4: a classification that fails or times out counts as no match).
- `parseSyllabus` has no signal in the interface; A enforces the 90s limit. It throws on refusal/max_tokens/empty output (A → 502).
- The API key must be scoped to a workspace.

## Blockers / needs from the human
None.

## How to run and verify my part
```
pnpm --filter @friction/intelligence test       # 39 tests: templates, classify (+LLM fallback/cache), evaluate, chat, parse, validate
pnpm typecheck
pnpm harness                                    # needs .env key; ~45 calls, ~2 min; sections: levels grading classify parse exchange
pnpm --filter @friction/intelligence latency    # 10 graded rows + p50/p95
```
