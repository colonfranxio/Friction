# Status: Agent B (intelligence)

**Owned by Agent B. Only this agent edits this file.**

- Contract version confirmed: **3** (merged main after E's CP2 report. v3 only adds the optional `CHAT_HEADERS.quizAttached`, which A emits and C reads. It doesn't affect B. v2's `EvaluateInput.signal` is still in use.)
- Current checkpoint: post-CP2 "work left to do", **B READY** (see below).
- Cancellation: A's fix (`complete = !abort.signal.aborted`, PR #1) is merged, and `scripts/verify-chat-abort.ts` **PASSES** on this branch with B's real factory. B's quiet abort is unchanged.
- Last updated: 2026-10-24

## PANEL READY (learning-map side panel, reassigned to B by the human, 2026-10-24)
Branch `feature/learning-map` (off `main` `d23cb63`). Code commits `cc0e983` + `af2c9b9` (checker fixes). Ownership note for E: `proposal/b-owns-learning-map` (`d1e83f6`).
- **Dashboard embed view** `/student/:studentId?embed=1` (`apps/dashboard/src/pages/EmbedPage.tsx`, `styles/embed.css`; route switch in `App.tsx`). Read-only: progress, **Now learning** (level and level/required), **Next up** (active nodes only, shallowest first, name tie-break, max 3, with mastery hint and a client-side "Try asking" starter; if nothing else is unlocked it says to master the current concept, no invented recommendation), and the map behind **Show map**. No TopBar, educator controls, upload/reset or chat. Same hooks as the Student page (`useStudentData` + `useTreeData` SSE), so mastery shows live. Compact error + Try again before first load; after that a transient error shows a banner and keeps the content. No-tree and loading states. Without `?embed=1` the Student page is unchanged.
- **Extension:** D's side-panel shell on `agent/extension` (iframe to `?embed=1`, consent guard, Dashboard URL with 127.0.0.1⇄localhost fallback, unreachable → Retry) is kept unchanged. No postMessage readiness signal: D's reachability probe covers a dead dashboard and the embed's own error state covers an API outage.
- **Evidence:** dashboard typecheck clean, `test` 13/13 (new `test/embed.test.ts`: active-only, excludes Now learning, cap 3, depth/name ordering, empty case), `build` OK (embed is its own lazy chunk).
- **Checker (Sonnet 5.5, medium, fresh clone at `cc0e983`): PASS.** Fixed from its nitpicks: a transient refresh error no longer replaces the loaded panel; ordering test added. Not fixed (accepted): the "Now learning" pick is duplicated from TreePage to avoid editing C's file; the map is a fixed 440px behind the toggle. Headless Chrome against the running real API (user's own syllabus tree): 360px and 420px, zero horizontal overflow with and without the map, no TopBar; full `/student/:id` still has the TopBar.
- **Not yet verified (human):** the live node-turns-green check inside the Chrome side panel on claude.ai. Needs D's branch merged (or built) plus this branch, with the dashboard's `VITE_API_URL` and the extension's API URL both on 8787.
- **Merge order:** D's `agent/extension` first, then `feature/learning-map`. Touches only the four dashboard files above and this status file.

## B READY
- **Source:** branch `agent/intelligence`; the exact SHA is in the "B READY" commit and the human handoff. It has `main` @ `ff25700` merged in, contract **v3** confirmed.
- **Prompts:** unchanged and still frozen. The live grader already passes every new repeat/rephrase case, so no prompt fix was needed.
- **Code change:** `chat()` now throws when the stream ends with any `stop_reason` other than `end_turn`/`stop_sequence`: `max_tokens`, `pause_turn`, a missing value, and also `refusal`, as before. A truncated reply is therefore never returned as a normal, complete stream.
- **New tests (42 in total, all with an injected SDK and no key):**
  - truncated reply → throws after the partial text
  - upstream stream error with no caller abort → throws, not a quiet end
  - repeated or rephrased original question → `not_an_answer`, which keeps the level even in demo mode, with the student's message sent as its own labelled section
- **Live harness** (`pnpm harness`, run 2026-10-24T19:45Z on the human's credentialed Windows machine; models chat/grade/parse=`claude-opus-5-5`, classify=`claude-haiku-5-5` from `MODEL_*`):

  | Check | Result |
  |---|---|
  | L1 / L2 / L3 / L4 | 5/5 each |
  | Demo answer vs the real L1 quizzes | 5/5 |
  | Grading | **11/11** |
  | Classify | 3/3 |
  | Parse | text pass in 14.3s; PDF pass in 11.3s |
  | 3-turn exchange | pass |

  The 11 grading cases include:
  - not credited: repeated original question, rephrased question, echoed check question → `not_an_answer`; keyword list → `partial`
  - still credited: short genuine answer and question-shaped answer → `correct`

  Full output: `packages/intelligence/harness/results/latest.md`.
- **Latency:**
  - Grade (`pnpm latency`, n=10, effort low): p50 2581ms · p95 5229ms. The p95 is over the 4s budget, so the late-grade path still matters.
  - Chat time to first token: L1 1.1–1.4s · L2 1.2–2.0s · **L3 5.7–8.4s** · L4 1.1–3.0s.
- **Failure vs cancellation (for A and E):**
  1. **Cancelled** (the caller's signal is aborted): `chat()` returns quietly. The text already yielded is all there is, and A's `!abort.signal.aborted` check counts it as incomplete.
  2. **Failed** (API error, dropped connection, refusal, `max_tokens` or any other non-natural stop, with the signal *not* aborted): `chat()` **throws**, possibly after yielding some text. A should treat this as incomplete: save the partial text if wanted, and close the quiz, because the check question may be missing. Today the client still receives a partial HTTP 200 body. Making that visible to the client is E's Phase 2 transport decision, and B needs no change for it.
  3. **Complete:** the iterator ends normally with no abort, which means `stop_reason` was `end_turn`/`stop_sequence`.
  - `evaluateExchange`: throws on any `stop_reason` ≠ `end_turn` or unparsed output (unchanged), and honours `signal`. `classifyTopic` never throws (failure → no match).
- **Commands:** `pnpm --filter @friction/intelligence test`, `pnpm typecheck`, `pnpm exec tsx scripts/verify-chat-abort.ts`, `pnpm harness` and `pnpm latency` (from `packages/intelligence`; these need `.env`).
- **Limitations:**
  - L3 takes about 6–8s to the first token.
  - The grade p95 is occasionally over 4s.
  - The harness results are builder evidence from one machine, not E's real-Claude smoke ×3 or a rehearsal.

## Exit criteria: CP3 (done; numbers below are historical, current ones are in B READY)
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
**CR-2 (open, requested by the human for the demo; owners A + E, no B change): a real syllabus upload moves the whole class onto the new tree.**
- **Why:** the demo goes "teacher uploads any syllabus → tree → edit → the whole class fills in as students chat". Today a non-cached `POST /trees/parse` moves **only the demo student** (contracts §8, `apps/api/src/services/parse.ts`). The classmates stay on the old tree, so the class panel, the activity feed and the sandbox's student dropdown show one student. The cached demo-syllabus path already uses the full seed class and stays as the safe default.
- **Ask (contracts §8 "Otherwise" path only):**
  1. After creating the tree, take `previousTreeId` = the demo student's current `active_tree_id`.
  2. Every student whose `active_tree_id === previousTreeId` (the demo student included) gets `active_tree_id = newTree.id` and fresh L1 states (`paused:false`) for every new node.
  3. If the demo student is missing or has no tree, move every `role:'student'` user.
  4. Their states, logs and bypasses on the old tree are left as they are, and so is their `bypass_quota`.
  5. Publish `tree_updated` for both trees, as today.
- **Unchanged:** the DEMO_MODE cache path; `resetSeedTree`, which already `Object.assign`s every seed user back onto the seed tree, so **Reset demo** restores the class; response shape `{tree_id, cached}`; no type changes. C's upload already navigates to the returned `tree_id` and reads `/trees/:id/students`, so it needs no change.
- **Contract:** behaviour-only wording change to §8 plus a changelog entry, at E's discretion. If E prefers it opt-in, use an additive `ParseTreeRequest.assign?: 'demo_student' | 'class'` field, defaulting to `'class'` for the demo.
- **Test (A):** parse non-demo text with fake intelligence. Then:
  - every student previously on the seed tree is on the new tree, with L1 states for each new node;
  - their seed-tree states still exist;
  - `GET /trees/:new/students` lists the whole class;
  - after `POST /demo/reset {full:true}`, everyone is back on the seed tree.
- **Demo note:** moved classmates start at L1 everywhere (0/N mastered). Progress appears only as students chat; nothing is faked. A real parse took 11–14s in B's harness, which C's parse animation covers.

(CR-1: the abort signal for `evaluateExchange` was **accepted in v2**, and the local workaround is removed. Without a signal, calls still time out at 20s: SDK timeout, 1 retry.)

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
pnpm --filter @friction/intelligence test       # 42 tests: templates, classify (+LLM fallback/cache), evaluate, chat, parse, validate
pnpm typecheck
pnpm harness                                    # needs .env key; ~45 calls, ~2 min; sections: levels grading classify parse exchange
pnpm --filter @friction/intelligence latency    # 10 graded rows + p50/p95
```
