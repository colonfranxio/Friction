# Demo runbook: elementary fractions + Moss

Branch `moss-integration`. Syllabus: [fixtures/elementary-syllabus.md](../fixtures/elementary-syllabus.md) (Grade 5 fractions). Unlike the React demo syllabus, it is **not cached**: Claude parses it live, so "Claude builds the tree" is literally true.

## Setup (once per recording)

1. `.env`: `USE_REAL_INTELLIGENCE=1`, `USE_MOSS_RETRIEVAL=1`, `DEMO_MODE=1`, Claude and Moss credentials.
2. `pnpm dev:api`, then `pnpm dev:dash`. Wait for `[moss] {"state":"ready",...}` in the API terminal.
3. Dashboard **Reset** (a full reset removes earlier uploads).
4. Upload the syllabus: drag in [fixtures/elementary-syllabus.pdf](../fixtures/elementary-syllabus.pdf) (or paste the `.md` text). The live parse takes **12–18s**, so cut that in the edit.
5. Wait about 3s after the tree appears. The API log shows a new `warming` then `ready` revision for the uploaded course.

Don't use the API's student-only reset (`POST /demo/reset {student_id}`) after an upload. It drops the uploaded course's progress (known A bug). The dashboard's Reset is a full reset and is safe.

## Verified flow (real browser, real API, real Claude, Moss on; 2026-10-24)

Full Playwright run of the dashboard (`b728e46`): every beat PASS. Ask about the **first concept**, which has no prerequisites. A concept stays *locked* until its prerequisites are mastered (contract §3), so mastering a later concept would not turn it green.

| Beat | Input | Observed |
|---|---|---|
| Upload | Drag [fixtures/elementary-syllabus.pdf](../fixtures/elementary-syllabus.pdf) into **Upload syllabus** | Live Claude parse in 12–18s, 8 concepts in 3 parts; student view and sandbox switch to it. Moss re-indexes in about 0.5s. |
| Ask (new sandbox chat) | "If I eat 3 slices of a pizza cut into 8, what do the two numbers in 3/8 mean?" | `[moss] retrieved candidates:3` in about 6ms → **What a Fraction Is, L1 · Socratic**, quiz attached. Guiding questions, no answer given. |
| Answer (same chat) | "The 8 means the pizza was cut into 8 equal slices, so that is how many pieces make the whole pizza. The 3 means I ate 3 of those equal slices." | Graded `correct` → L4. The node turns **green live in educator, student and sandbox views**, and its 3 dependent concepts **unlock** (the tree grows). |
| Same question, new chat | (same as Ask) | L4 · Normal, full explanation, no quiz. |
| Use bypass | New chat: "Which is more, 3/4 of a cake or 5/8 of a cake?" (Comparing Fractions, L1), then **Use bypass (3 left)** | Teacher toast: "Alex Chen used a bypass on Comparing Fractions · 2 left". No child text anywhere on the teacher page. |

Other child-worded questions that Moss routed correctly at L1 (API probe): "My teacher says 2/4 and 1/2 are the same but 2/4 has bigger numbers. How can that be?" (Equivalent Fractions; it stays locked until What a Fraction Is is mastered), "Why can't I just add the tops and the bottoms when I do 1/2 plus 1/3?" (Adding Unlike Fractions).

## Caveats

- Real model output varies. Rehearse the exact ask/answer pair. In an earlier session one fixed answer was graded `partial` (no promotion), so rerun the take if that happens.
- A concept only gets a new check question when it has no open one, even from a different chat. Don't ask the demo question anywhere before recording (start with a fresh upload).
- DEMO_MODE promotes L1 → L4 on one correct answer (a demo shortcut; normal mode moves one level).
- The uploaded course has only the demo student (no classmates in the teacher's class panel).
- On screen: a mastered badge reads level/required (for example "4/3"). Claude sometimes draws pictures in a code block, which the dashboard labels "CODE".
- The L2/L3 teaching instructions are worded for code ("pseudocode", "find the bug"). The demo only shows L1 and L4.
