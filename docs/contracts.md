# Friction Contracts (v3)

**Source of truth for shapes is code:** `packages/shared/src/*`. This doc explains the **behavior** those shapes must have. If this doc and the code disagree, the code wins. File a change request.

The reference implementation of every rule below is `scripts/mock-api.ts`. `pnpm smoke` checks the main ones.

---

## 1. Packages and imports

| Import | What it gives you |
|---|---|
| `@friction/shared` constants | `PORTS`, `FRICTION_OPEN/CLOSE`, `INTERCEPT_BUDGET_MS`, `EXTENSION_TIMEOUT_MS`, `QUIZ_WINDOW_MS`, `DEMO_JUMP_MIN_CONFIDENCE`, `DEFAULT_BYPASS_QUOTA`, `DEMO_PARSE_DELAY_MS`, `CHAT_HEADERS`, `ICON_KEYWORDS`, `LEVEL_LABELS`, `CONTRACT_VERSION` |
| types | `User`, `Tree`, `Pillar`, `SkillNode`, `Edge`, `StudentNodeState`, `ChatLog`, `BypassEvent`, `EvaluationResult`, `BloomLevel`, `Verdict`, … |
| API | `ENDPOINTS` + every request/response type + `ServerEvent` + `ApiErrorBody` |
| client | `createFrictionClient(baseUrl)`, `ApiError` |
| rules | `computeNextLevel`, `computeNodeStatuses`, `computeDepths`, `wouldCreateCycle`, `wrapInjected`, `stripInjected`, `hasInjected`, `readInjectedLevel`, `clampLevel`, `isMastered` |
| intelligence | the `Intelligence` interface (A ↔ B boundary) + its input/output types |
| seed / fakes | `buildSeed()`, `SEED_IDS`, `DEMO_PROMPTS`, `fakeIntelligence` |

Packages are consumed as TypeScript source (no build step). Vite, tsx and esbuild all handle it.

## 2. Ports and environment

API **8787** · mock **8788** (D's private mock **8789**) · dashboard **5173**. Clients use `http://127.0.0.1:<port>`, not `localhost` (Windows IPv6 quirk); `DEFAULT_API_URL` already does. All env vars are listed in `.env.example`. Model IDs are **only** read from `MODEL_*` env vars.

## 3. Entities and node status

- Every ID is a UUID except `conversation_id`, which is the site's own ID string.
- **Bloom mapping:** L1 = Remember + Understand (Socratic) · L2 = Apply (Scaffolder) · L3 = Analyze + Evaluate (Challenger) · L4 = Create (Normal).
- **Node status** (`computeNodeStatuses`): **locked** if any prerequisite is not mastered · **mastered** if level ≥ `required_blooms_level` · otherwise **active**. Badge text = `level/required_blooms_level`.
- `position: null` means the dashboard computes the layout. Once an educator drags a node, its position is saved.
- Every student on a tree has one `StudentNodeState` per node. New nodes create L1 rows for every student on that tree.

## 4. `/intercept`: the hot path

Input `InterceptRequest`, output `InterceptResponse`. The server finds the tree from `users.active_tree_id`. The whole call must finish in `INTERCEPT_BUDGET_MS` (4s).

1. **Find a pending quiz.** It's the most recent `ChatLog` for this student with `quiz_pending = true` on the active tree:
   - with a `conversation_id`: same conversation only;
   - with a null `conversation_id`: the latest one created within `QUIZ_WINDOW_MS` (10 min).
2. **Run in parallel, inside the budget:**
   - `classifyTopic(raw_prompt, nodes)`, skipped when a pending quiz exists;
   - `evaluateExchange(...)` when a pending quiz exists **and** its node isn't paused. Quiz text = the pending log's `llm_response`, else `previous_assistant_text`, else `null`. (Sandbox: `/chat` saves `llm_response` itself. Extension: sends `previous_assistant_text` read from the page and never calls `/responses`.) `EvaluateInput.signal?: AbortSignal` supports explicit operation cancellation. Do not abort a grade merely because the intercept response budget expired: late grading must still apply under rule 4.5. The fake grader accepts this optional field without needing network cancellation.
3. **Resolve the node:** pending quiz's node › classification result › **conversation stickiness** (the node of the latest log in the same conversation) › none.
4. **No node:** return `{intercept_id:null, node_id:null, level:null, injected_prompt: raw_prompt, quiz_attached:false, graded:null}`, log nothing, emit nothing.
5. **Grade result:**
   - Arrived within the budget: write `verdict/confidence/rationale` onto the **pending** log; if verdict ≠ `not_an_answer`, set its `quiz_pending=false`; set the level to `new_level` (unless paused); emit `student_state` (if changed) and `activity` (kind `graded`); return `graded` and pass `feedback:{verdict}` into the prompt.
   - **Late** (rule 4.6): don't wait. The level used for this turn is the current one, `graded` is null, and there's no feedback. When the grade lands, apply it exactly as above. This applies even in DEMO_MODE.
6. **Level for this turn:** `paused ? 4 : current_blooms_level`.
7. **Quiz:** `includeQuiz = level < 4 && no open quiz_pending log exists for this student+node`.
8. **Prompt:** `injected_prompt = buildFrictionPrompt({raw_prompt, level, node, includeQuiz, feedback})`.
9. **Log:** insert a `ChatLog` with `quiz_pending = includeQuiz` and emit `activity` (kind `intercept`). Return `intercept_id = log.id`.

**Timeouts:** classification that misses the budget counts as no match. Never return L4 because of a timeout. Serialize intercepts per student (a simple mutex) so two fast sends can't double-grade.

## 5. Friction prompt format

`injected_prompt` is a **verbatim replacement** for the student's whole prompt:

```
<raw prompt exactly as typed>

⟦friction⟧
<instruction body: must contain a line "Level: N"; tells the AI never to mention or quote this block>
⟦/friction⟧
```

- Always built with `wrapInjected(raw, body)`. Removed for display with `stripInjected(text)`.
- **L4 with no feedback ⇒ `injected_prompt === raw_prompt`** (no block at all).
- L4 with feedback ⇒ a block that only asks the AI to briefly confirm the answer, then help fully.
- L3 must tell the student the answer contains exactly one deliberate bug to find.
- When `includeQuiz` is true, the AI must end with one short, natural check-for-understanding question about the node's concept.

## 6. Progression (`computeNextLevel`)

| Verdict | Effect |
|---|---|
| `correct` | +1 (max 4). **DEMO_MODE** and confidence ≥ 0.7: straight to **4** |
| `lazy` (asks for the answer at L3+ without engaging) | −1 if level ≥ 3, else unchanged |
| `partial`, `incorrect` | unchanged; quiz resolved, so a new quiz is attached next turn |
| `not_an_answer` | unchanged; **quiz stays pending** |

B computes `new_level` with `computeNextLevel`. A writes it. Paused nodes are never graded and never change.

## 7. Bypass

`POST /bypass {student_id, node_id}`:
- quota 0 ⇒ **409 `quota_exhausted`**;
- else quota −1, `paused = true`, close any pending quiz on that node, insert a `BypassEvent`, emit `student_state` + `bypass` (with `student_name`, `concept_name`), and return `{remaining_quota}`.
- Later intercepts on that node return **L4**. Paused lasts until `/demo/reset` (good enough for the MVP).

## 8. Parse and the demo cache

`POST /trees/parse` (PDF base64 without a `data:` prefix, or text):
- **DEMO_MODE cache:** if the input matches the demo syllabus (sha256 of `fixtures/demo-syllabus.pdf` bytes, or of the trimmed, LF-normalized text of `fixtures/demo-syllabus.md`), reset the seed tree to `buildSeed()` state for all its students, wait `DEMO_PARSE_DELAY_MS`, and return `{tree_id: SEED_IDS.tree, cached: true}`. The mock does this for **any** input.
- **Otherwise:** `parseSyllabus` → validate (keys unique, deps valid, drop cycle-causing edges) → create tree, pillars, nodes, edges with new UUIDs → set the **demo student's** `active_tree_id` to it, with L1 states → `{tree_id, cached:false}`.
- LLM failure ⇒ 502 `llm_error`. Over 90s ⇒ 504 `llm_timeout`.

## 9. Realtime: `GET /events?tree_id=…` (Server-Sent Events)

Each message is `event: <type>` plus `data: <JSON>`. Comment pings (`: ping`) are sent every 15s.

| Event | Emitted when |
|---|---|
| `student_state` | a level or paused flag changes |
| `bypass` | a bypass is used |
| `activity` | an intercept is logged, or a quiz is graded (no raw text) |
| `tree_updated` | node/edge/pillar edits, parse, or demo reset. **Clients refetch tree + students.** |
| `student_seen` | heartbeat (cut from the MVP; optional) |

## 10. Sandbox chat: `POST /chat`

Runs the §4 intercept on the last user message (`app_source:'sandbox'`, the request's `conversation_id`). Replaces that message with `injected_prompt`, streams `Intelligence.chat()` as `text/plain`, and saves the full text as the log's `llm_response`. Headers: `X-Friction-Intercept-Id`, `X-Friction-Node-Id`, `X-Friction-Level` (empty when no node). They're exposed via CORS.

From v3, optional `CHAT_HEADERS.quizAttached` (`X-Friction-Quiz-Attached`) reports the exact `InterceptResponse.quiz_attached` for that turn as `"true"` or `"false"`. When emitted, it must be exposed via CORS. It is false for unmatched prompts and L4 turns. Do not infer it from `level < 4`: a lower-level turn with an already-pending quiz may attach none. Both the mock and real API emit it; C owns the remaining UI rollout. Clients retain the existing fallback hint if connecting to an older server without it and must not claim exact attachment from the level alone. The original three headers remain required.

## 11. Privacy

Only prompts that match a node are logged. If the popup's consent toggle is off, the extension doesn't call the API at all. Educator endpoints (`/trees/:id/students`, `/trees/:id/activity`) **never** return `raw_prompt`, `injected_prompt` or `llm_response`.

## 12. Errors and CORS

Non-2xx responses have the body `{ "error": { "code": ErrorCode, "message": string } }`. Codes: `bad_request` 400 · `not_found` 404 · `quota_exhausted` 409 · `cycle` 409 · `demo_only` 404 · `llm_error` 502 · `llm_timeout` 504 · `internal` 500.
CORS: allow `http://localhost:5173` and `chrome-extension://*` (`*` is fine in DEMO_MODE). Methods GET, POST, PATCH, DELETE, OPTIONS. Expose the `CHAT_HEADERS`.

## 13. Changing the contract

Contracts change only at checkpoints, are **additive only** (new optional fields or new endpoints), and are applied by the human lead. The lead bumps `CONTRACT_VERSION`, logs it in `docs/contracts-CHANGELOG.md`, and updates the mock. Between checkpoints, agents work around gaps locally and file a change request in their status file.
