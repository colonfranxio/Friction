# Status: Agent B (intelligence)

**Owned by Agent B. Only this agent edits this file.**

- Contract version confirmed: **3** (merged main after E's CP2 report. v3 only adds the optional `CHAT_HEADERS.quizAttached`, which A emits and C reads. It doesn't affect B. v2's `EvaluateInput.signal` is still in use.)
- Current checkpoint: CP3 (done, pushed). PLAN v5 has no CP4; what's left are E's gate checks and the human's rehearsals.
- CP2 report follow-up (A↔B cancellation): B's behaviour is unchanged on purpose. When the caller aborts, `chat()` ends **quietly** with no throw, like the fake (`src/chat.ts:19`, tested in `test/chat.test.ts` "forwards the signal and ends quietly when aborted"). So A's `/chat` route has to decide completion with `!abort.signal.aborted`, not from the iterator finishing. `scripts/verify-chat-abort.ts` still FAILS on this branch, as expected, until A's fix lands. Nothing in B needs to change.
- Last updated: 2026-10-24

## Exit criteria: CP3
- [x] L3 "find the bug" ≥4/5: **5/5** (it was 5/5 at CP2 and is 5/5 again after the CP1 merge). Each reply explains the causes, gives a full example with one planted loop bug (for example, an object built inside the component body and listed as a dependency), says there's exactly one bug to find without saying where, and ends with the check question.
- [x] **Prompts frozen** as of this commit: `src/templates.ts` (friction block and all 4 levels, feedback lines, quiz line), `src/evaluate.ts` (grader system prompt and level line), `src/classify.ts` (fallback prompt), `src/parse.ts` (parse instruction), `src/chat.ts` (system prompt). From now on I change them only to fix a bug found in rehearsal, and I re-run the full harness after any change.
- [x] Final full harness run on the frozen prompts (after merging main): **L1 5/5 · L2 5/5 · L3 5/5 · L4 5/5 · demo answer vs real L1 quizzes 5/5 · grading 5/5 · classify 3/3 · parse text + PDF pass · 3-turn pass** (`harness/results/latest.md`).

### Demo prompts known to work (exact text, all in `DEMO_PROMPTS`)
| Step | Type exactly | Expected (verified live) |
|---|---|---|
| 2: ask at L1 | `How do I stop my useEffect from running in an infinite loop?` | Keyword-routes to **React useEffect**. L1: no code, one hint, ends with one single-sentence question like "In your own words, what does the dependency array tell React?" (5/5) |
| 3: answer | `The dependency array lists the values the effect depends on, so React only re-runs the effect when one of those values changes. An empty array means run once after mount.` | Graded **correct** against the real L1 quiz in 5/5 runs (10/10 earlier), so with `DEMO_MODE=1` the student goes to L4 and the reply confirms "right, and why" |
| 4: new chat, same question | `How do I stop my useEffect from running in an infinite loop?` | L4: no friction block, full code answer (5/5) |
| 5: bypass topic | `How does React Context help me avoid prop drilling?` | Keyword-routes to **Context API** (unit-tested) |
| Optional: lazy at L3 | `just give me the code` | Graded **lazy**, L3 → L2 |

Tips for rehearsal: type them exactly (or paste). Answer the quiz in the **same** chat. Expect L3 replies to take 7–11s before the first token. An unrelated prompt such as "write a haiku about the sea" is not intercepted (classify returns null).

## Exit criteria: CP2 (done)
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
None open. (1. The abort signal for `evaluateExchange` was **accepted in v2**, and the local workaround is removed. Without a signal, calls still time out at 20s: SDK timeout, 1 retry.)

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
