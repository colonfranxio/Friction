# Demo runbook: elementary fractions + Moss

Branch `moss-integration`. Syllabus: [fixtures/elementary-syllabus.md](../fixtures/elementary-syllabus.md) (Grade 5 fractions). Unlike the React demo syllabus, it is **not cached**: Claude parses it live, so "Claude builds the tree" is literally true.

## Setup (once per recording)

1. `.env`: `USE_REAL_INTELLIGENCE=1`, `USE_MOSS_RETRIEVAL=1`, `DEMO_MODE=1`, Claude and Moss credentials.
2. `pnpm dev:api`, then `pnpm dev:dash`. Wait for `[moss] {"state":"ready",...}` in the API terminal.
3. Dashboard **Reset** (a full reset removes earlier uploads).
4. Upload the syllabus: paste the `.md` text, or a PDF printed from it. The live parse takes **15–18s**, so cut that in the edit.
5. Wait about 3s after the tree appears. The API log shows a new `warming` then `ready` revision for the uploaded course.

Don't use the API's student-only reset (`POST /demo/reset {student_id}`) after an upload. It drops the uploaded course's progress (known A bug). The dashboard's Reset is a full reset and is safe.

## Verified flow (real API, real Claude, Moss on; 2026-10-24)

| Beat | Input | Observed |
|---|---|---|
| Ask (new sandbox chat) | "My teacher says 2/4 and 1/2 are the same but 2/4 has bigger numbers. How can that be?" | `[moss] retrieved candidates:3` in ~10ms → **Equivalent Fractions, L1**, quiz attached. Socratic pizza example, one hint, ends with a "why" question, no answer given. |
| Answer (same chat) | "They are the same amount. If you cut each half of the pizza into 2 smaller pieces you get 2 pieces out of 4. Multiplying the top and bottom by 2 just makes more, smaller pieces, the amount stays the same." | Graded `correct` → **L4** (node turns green). Reply opens "Exactly right!". |
| Same question, new chat | (same as Ask) | L4, full direct explanation, no quiz. |
| Use bypass | Any other concept | Quota 3 → 2. Teacher activity shows `bypass`, `intercept`, `graded`, with no child text exposed. |

Other child-worded questions that routed through Moss to the right concept at L1: "If I eat 3 slices of a pizza cut into 8, what do the two numbers in 3/8 mean?" (What a Fraction Is), "Why can't I just add the tops and the bottoms when I do 1/2 plus 1/3?" (Adding Unlike Fractions), "Which is more, 3/4 of a cake or 5/8 of a cake?" (Comparing Fractions).

## Caveats

- Real model output varies. Rehearse the exact ask/answer pair. In an earlier session one fixed answer was graded `partial` (no promotion), so rerun the take if that happens.
- Only one question per concept per chat gets a check question. Don't pre-ask the demo question in another chat before recording.
- DEMO_MODE promotes L1 → L4 on one correct answer (a demo shortcut; normal mode moves one level).
- The uploaded course has only the demo student (no classmates in the teacher's class panel).
- The L2/L3 teaching instructions are worded for code ("pseudocode", "find the bug"). The demo only shows L1 and L4.
