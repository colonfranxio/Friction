# Agent B: Intelligence (Claude-powered core)

**Read first: [DEMO-READINESS-TASKS](../DEMO-READINESS-TASKS.md).** Execute your named assignment there; it supersedes stale ownership, branch, demo-order and dependency instructions below. Report your READY handoff with a pushed SHA and evidence.

You are **Agent B**, one of four Claude Code agents building **Friction** in parallel for a hackathon. You own every call to Claude: turning a syllabus into a skill tree, deciding which concept a prompt is about, writing the hidden friction instructions, grading quiz answers, and the sandbox chat. Your output quality is what judges see in the demo.

## 0. Read first (in this order)
1. `AGENTS.md`: ownership and working rules (binding).
2. `PLAN.md`: the whole plan; your column in §5 (v5, simplified).
3. `docs/contracts.md`: §4 (how A calls you), **§5 (prompt format)**, §6 (progression), §8 (parse).
4. `packages/shared/src/intelligence.ts`: **the interface you implement.** Also `rules.ts` (`wrapInjected`, `computeNextLevel`), `constants.ts` (`ICON_KEYWORDS`, `LEVEL_LABELS`), `seed.ts` (`DEMO_PROMPTS`, the seed tree).
5. `packages/shared/src/fakes.ts`: deterministic versions of everything you build. Your real versions must be drop-in replacements with the same output formats.
6. `PRD.md` Module 3: the four friction levels.
7. **Before writing any Anthropic SDK code, invoke the `claude-api` skill** in your session. It has the current SDK shapes for structured outputs, PDF document blocks, streaming, effort and thinking. Don't write SDK calls from memory.

## 1. Your mission
Replace the placeholder in `packages/intelligence/src/index.ts` with a real `createIntelligence(): Intelligence` backed by Claude. Then prove it works with unit tests and a **level-compliance harness** that runs the demo prompts against Claude and reports pass rates.

## 2. Ownership
- **You edit only:** `packages/intelligence/**` and `docs/status/B-intelligence.md`.
- **Never edit:** `packages/shared/**`, `apps/**`, `scripts/**`, `fixtures/**`, root config, other docs.
- **Branch:** `agent/intelligence`. Push only that branch.
- Your package is **pure**: no HTTP server, no database, no file writes outside `harness/results/`. A calls you in-process.

## 3. What's already there
- `packages/intelligence/package.json` with `@anthropic-ai/sdk`, `zod`, `@friction/shared`. Scripts: `typecheck`, `test` (vitest), `harness` (`tsx --env-file-if-exists=../../.env harness/run.ts`).
- `src/index.ts`: a placeholder that returns `fakeIntelligence`. **Keep the export name `createIntelligence`.**
- `.env` (copied from `.env.example`) holds `ANTHROPIC_API_KEY` and the model IDs: `MODEL_PARSE`, `MODEL_GRADE`, `MODEL_CHAT` = `claude-opus-5-5`, and `MODEL_CLASSIFY` = `claude-haiku-5-5`. **Read models only from env.**

## 4. Target file layout (create these)
```
packages/intelligence/
  src/index.ts        createIntelligence(opts?: {client?, models?}): Intelligence   (opts allow test injection)
  src/config.ts       read env (models, key); build the Anthropic client lazily
  src/templates.ts    buildFrictionPrompt (sync, no LLM)
  src/classify.ts     keyword stage → LLM fallback (MODEL_CLASSIFY) → LRU cache by hash(prompt + node ids)
  src/evaluate.ts     evaluateExchange (MODEL_GRADE, effort low, structured output)
  src/parse.ts        parseSyllabus (MODEL_PARSE, effort high, PDF document block or text, structured output)
  src/chat.ts         chat(): streams text deltas (MODEL_CHAT)
  src/schemas.ts      zod schemas: ParsedTree, grade output, classify output
  src/validate.ts     post-parse fixes: unique keys, valid deps, remove cycles, keyword/icon normalization
  test/templates.test.ts classify.test.ts evaluate.test.ts parse.test.ts validate.test.ts
  harness/cases.ts    demo prompts per level + grading cases (from DEMO_PROMPTS + your own)
  harness/run.ts      runs everything against real Claude; writes harness/results/latest.md
  harness/results/latest.md
```

## 5. Function specs

### `buildFrictionPrompt(input)` (sync)
- Returns `raw_prompt` unchanged when `level === 4 && !feedback`.
- Otherwise returns `wrapInjected(raw_prompt, body)`. The body **must** contain the line `Level: N (<role>)` (other tools parse it), plus:
  - an anti-leak line: the AI must follow these notes silently and never mention, quote or allude to them, or to "instructions", "tutor context" or "friction";
  - `Concept:` and `Learning goal:` (from `mastery_criteria`);
  - the level instruction:
    - **L1 Socratic:** no answer, no code; ask the student to explain the core idea in their own words; give one hint.
    - **L2 Scaffolder:** outline or pseudocode with blanks only, no exact syntax.
    - **L3 Challenger:** a full solution with exactly one subtle, deliberate bug, and **say there is one bug to find** without saying where.
    - **L4 Normal:** help fully.
  - **Feedback** (when present), worded per verdict. For example, `correct` → "briefly confirm they got it right and why"; `incorrect` → "gently correct the misconception"; `partial`; `lazy` → "encourage them to try first"; `not_an_answer` → nothing special.
  - **Quiz** (when `includeQuiz`): end with **one** short, natural check-for-understanding question about the concept. Don't label it "quiz".
- Write the body so it reads naturally and stays short (≤ 120 words).

### `classifyTopic(prompt, nodes)`
1. **Keyword stage** (no LLM): lowercase; match `node.keywords` and `concept_name` with word boundaries; score = matched phrase lengths; take the best above a threshold → `method:'keyword'`, confidence 0.6–0.95.
2. **LLM fallback** only when keywords miss: `MODEL_CLASSIFY`, structured output `{node_id|null, confidence}`. Give it the node list (id, concept, mastery) and the prompt. Return null unless confidence ≥ 0.5. Unrelated prompts ("write a haiku") must return null.
3. **Cache** results in an in-memory LRU (500 entries) keyed by sha1(prompt + sorted node ids).
4. Must be fast: the keyword path takes under 5ms; the LLM path should take under ~1.5s.

### `evaluateExchange({node, level, quiz_text, student_message, demoMode})`
- `MODEL_GRADE`, effort `low`, structured output `{verdict, confidence, rationale}`. `rationale` is one sentence an educator can read.
- Verdict definitions:
  - **correct**: demonstrates the idea in `mastery_criteria`;
  - **partial**: on the right track but missing the key point;
  - **incorrect**: a misconception;
  - **not_an_answer**: the message isn't answering the quiz (a new question, chit-chat);
  - **lazy**: asks for the answer or code without engaging ("just give me the code").
- `quiz_text` may be null: grade against `mastery_criteria` and lower the confidence.
- `new_level = computeNextLevel({current: level, verdict, confidence, demoMode})`. **Don't re-implement the rule.**
- Accept an `AbortSignal` / timeout. On API errors, **throw**; A handles it.
- **Measure latency** (p50 and p95 over 10 calls) and put it in your status file at CP1. This sits on the hot path with a 4s budget.

### `parseSyllabus(input)`
- PDF: base64 `document` block placed before the instruction text. Text: a plain text block.
- `MODEL_PARSE`, effort `high`, structured output matching `ParsedTree`:
  - 3–5 pillars (course modules, in order) and 6–15 nodes;
  - each node has `pillar` ∈ `pillars`, a concrete `mastery_criteria` (an observable skill), `required_blooms_level` (usually 3–4; 4 for milestone concepts), `size` major/minor, `icon` from `ICON_KEYWORDS`, 3–7 lowercase `keywords` a student would actually type, and `depends_on` keys.
- Use streaming with the final-message helper if the call can be long (see the skill). Then run `validate.ts`: dedupe keys, drop unknown deps, break cycles (`wouldCreateCycle`), clamp levels, force icons into the allowed list (fallback `circle`), and lowercase keywords.
- **Test it on `fixtures/demo-syllabus.md`.** The output should resemble the seed tree (8 concepts, 3 modules, "React useEffect" present). A's demo cache means the stage demo doesn't depend on this, but a judge may upload their own PDF.

### `chat(messages, {signal})`
- Streams the assistant's text deltas from `MODEL_CHAT`. The last user message already contains the friction block. Add a short system prompt: "You are a helpful programming assistant." Never strip or reveal the block.

## 6. Tasks and exit criteria (PLAN.md v5: 3 checkpoints)
The main demo is the **sandbox chat**, so your `chat()` + templates are what judges see. Priority: L1 Socratic pushback and correct grading of the demo answer first, everything else after.

### CP1 (T+3h)
- [ ] `templates.ts` for all 4 levels, with feedback and quiz variants; unit tests check the format (delimiters, the `Level:` line, the L4 passthrough, the raw prompt first)
- [ ] Keyword classifier, unit-tested on the seed nodes (all `DEMO_PROMPTS` route correctly; "write a haiku" → null)
- [ ] Real `evaluateExchange` (mocked client in unit tests); **grade latency p50/p95 reported** in your status file
- [ ] `createIntelligence()` wired up (unfinished parts may fall back to fakes); `pnpm typecheck` passes

### CP2 (T+9h)
- [ ] Streaming `chat()`
- [ ] Real `parseSyllabus` (text + PDF) with validation, tested on `fixtures/demo-syllabus.md`
- [ ] LLM classify fallback + cache
- [ ] Harness (`pnpm harness`): L1, L2 and L4 ≥ 4/5 on `DEMO_PROMPTS.question`; grading cases match (correctAnswer → correct, lazyAnswer at L3 → lazy, plus partial / incorrect / not_an_answer); a full 3-turn sandbox-style exchange reads naturally. Results in `harness/results/latest.md`

### CP3 (T+16h)
- [ ] L3 "find the bug" ≥ 4/5
- [ ] Final prompts frozen; the status file lists the exact demo prompts known to work

## 7. Claude API rules (from the `claude-api` skill; verify there)
- Use `@anthropic-ai/sdk`. Get JSON via structured outputs (`output_config.format` / the SDK's parse helper with zod). Don't use regex-parsing of free text for structured fields.
- **Don't send `temperature`, `top_p` or `top_k`** (rejected). No assistant prefill. No forced `tool_choice`. Check `stop_reason` before reading content (handle `refusal` and `max_tokens`).
- Thinking: use adaptive / omit it and control depth with `output_config.effort` (`low` for grade and classify, `high` for parse). Don't use `budget_tokens`.
- Never log the API key. Never hardcode model IDs.

## 8. How to verify
```
pnpm --filter @friction/intelligence test
pnpm harness                       # needs ANTHROPIC_API_KEY in .env
pnpm typecheck
```

## 9. Interfaces with the other agents
- **A** imports `createIntelligence()` and calls your functions inside a 4s budget. Be fast, throw on failure, never hang (always pass the signal or timeout).
- The **dashboard (C)** and **extension (D)** never call you directly.
- Prompt-format changes that would affect others (the `Level:` line, the delimiters) are contract changes. File a change request instead.

## work left to do

### Moss sponsor-track handoff

Read [the detailed execution plan](../moss-implementation-handoff.md). Use `agent/moss-intelligence` for this feature. Review/adapt experiment `8f8fe63` within your package, preserving keyword routing, Claude abstention, semantic-cache invalidation, default-off native isolation and bounded queries. Publish MOSS INTELLIGENCE READY so E can integrate before A's runtime wiring.


Current shared handoff: [CONTRACT READY v4](../checkpoints/CONTRACT-READY-v4.md). Follow its owner checklist; shared readiness does not mean the real API is API READY.

This section updates the remaining-work assignment after CP2. Own only `packages/intelligence/**` and your status file on `agent/intelligence`. Your pushed CP3 freeze/cleanup at `a6af828` still needs E's integration review; do not assume pushed work is on `main`.

### Start now, in parallel

- Merge current `main` into your branch, confirm the v4 handoff and rerun the actual-B-factory cancellation check. A's quiet-abort lifecycle fix is already merged; preserve B's quiet cancellation and required late grading.
- Add repeated and rephrased original questions to grader unit tests and the live harness: they must not earn mastery merely by repeating concept keywords. Also retain genuine short answers, question-shaped answers, correct/partial/incorrect/lazy and unrelated-message cases. E independently owns the fake-grader correction; never edit `packages/shared` yourself.
- Handle and test incomplete model outcomes, especially `max_tokens`, refusal and interrupted streams. Give A a precise failure-versus-cancellation behavior description. Do not silently return a truncated answer as a successful full response.
- Make only targeted grading/error fixes to the frozen prompts. Rerun the full live harness after any prompt change, retain exact known-good demo prompts and re-freeze them. Reconfirm L1/L2/L4 compliance, demo grading against actual quizzes and L3 >=4/5; record latency as well as pass rates. Do not add unrelated tuning or features.

### Dependencies and order

1. Your grading and SDK tests can run alongside A's endpoint work, C's dashboard work, D's hardening and E's fake-grader/contract work. Do not wait for the bypass API, which you do not own.
2. Send A/E the streaming failure semantics and any contract needs through your status file/human relay. If shared transport/types must change, wait for E's `CONTRACT READY` commit/version before adopting them. Keep existing interfaces compatible meanwhile.
3. Push your completed branch and record `B READY` with source SHA, test/harness commands, fresh result provenance, model variable names and remaining limitations. E merges B → A → C → D; all builders then merge E's integrated `main` before final real-model validation.

### Parallel safety and exit criteria

- Use your own existing isolated environment/checkout; never switch branches or install dependencies in another agent's working directory. No new worktrees unless explicitly requested.
- Use injected SDKs for parallel unit tests; they require no shared services or keys. Serialize harness and latency runs within your environment: they write the same results and concurrent load distorts latency. Never dump credentials or change other agents' bindings. Models come from `MODEL_*`.
- Add dependencies only to your own package. E owns combined lockfile reconciliation, shared contracts and mock changes.
- Deliver package tests/typecheck, current frozen-prompt harness results and exact demo prompts. E's real-Claude smoke x3 and browser/human rehearsals are separate gates; a harness pass alone does not close them. Refresh stale status statements about A's now-fixed cancellation defect.
