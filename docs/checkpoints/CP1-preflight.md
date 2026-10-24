# CP1 preparation — Agent E

Historical preflight record. The completed integration is recorded in [CP1.md](CP1.md).

This is a preflight record, not a completed checkpoint integration report. No builder branch has been merged. E owns `main`; builder application files and status files remain untouched.

## Branch collection

The initial checkout fetched only `main`. E explicitly fetched `refs/heads/agent/*` to discover the pushed builder branches. Future collection must also fetch this pattern; `git fetch --all` alone does not expand a narrow refspec.

| Agent | Reviewed remote commit | Ownership | Reported status |
|---|---|---|---|
| B Intelligence | `01cb60e951b78c05a5d12e1412442cae00875e2f` | Pass | CP1 complete; 22 tests and live grading latency reported |
| A Platform | `441fdf824981599edf93f47a742297cee55ca9ea` | Pass | Branch arrived during preflight; CP1 complete and 47 endpoint tests reported |
| C Dashboard | `bbd45c70a3b1839967dd2f5c4c3d4864fbcd05bd` | Pass | CP1 complete; CP2/CP3 mock checks reported, real API gate pending |
| D Extension | `cf6365dadd30dddbaa5157e232217a885e43445b` | Pass | CP1 GO reported; CP2 real API and remaining human checks pending |

These are builder claims, not E's independent runtime verification of their branches. Refresh refs and status files when the human signals that all agents have pushed. Merge B → A → C → D only then, validating each merge and rejecting ownership violations or failing branches per E's brief.

## E verification tools

- Added 18 shared tests. The root test command now executes real tests instead of failing at the empty shared suite. The unmerged API, intelligence, and extension scaffolds still report zero tests; this does not validate their implementations.
- Added three SSE observer regression tests to the root test command and scripts typecheck: fragmented CRLF frames/comment pings, malformed later events, and unexpected disconnects. Observer errors remain failures through final cleanup.
- Expanded `pnpm smoke` from 11 to 16 steps. It now requires parse notification, live mastery promotion and bypass events over an SSE connection opened before the mutations; three sandbox chat turns with response metadata and exposed CORS headers; and populated educator HTTP/SSE data without raw chat text fields.
- Fixed the mock's missing parse `tree_updated` notification to match the existing v1 contract. No shape or version change.
- Smoke resets demo data. Use a private mock port when builders are using 8788/8789. Tested command: `pnpm dev:mock --port 8790`, then `pnpm smoke --url http://127.0.0.1:8790` in a second terminal.
- The chat smoke verifies nonempty text streams and progression without `/responses`. It cannot prove that `/chat` saved the assistant reply: the fake grader also accepts a null quiz. A must cover stored reply reuse in endpoint tests. Text quality and the six visual must-haves remain browser/human gates.

## Queued contract requests — apply only at a checkpoint

1. **B:** optional `EvaluateInput.signal?: AbortSignal`. Additive and compatible with B's current local intersection type. Ensure A does not abort grading at the intercept response deadline: late grades must still apply. Discuss cancellation semantics before adoption.
2. **C:** optional `CHAT_HEADERS.quizAttached` / `X-Friction-Quiz-Attached`. The existing three headers cannot tell the UI whether this specific turn attached a quiz. If accepted, update shared constants, both chat implementations, C's consumer, CORS exposure, smoke checks and the contract/changelog together. E must return builder-side edits to their owners.

## Outstanding CP1 gates

- All four builder branches now exist and report CP1 complete. Await the human's all-agents-pushed integration signal; refresh refs again before merging.
- Independently validate merged implementations: install, root typecheck/tests, smoke against API 8787 with fake intelligence, and both builds. A mock pass does not satisfy the real API gate.
- Spawn an independent verification agent for each actual checkpoint. Sonnet 5.5 is unavailable in this session; the user accepted the proposed `gpt-6.1-sol` at medium effort. The E preflight changes also receive independent review before push.
- Human: retain D's live claude.ai GO evidence; run the Windows install/typecheck/mock-smoke check if teammates use Windows. Linux validation does not establish Windows runtime compatibility.
- At CP2, require real Claude smoke three times consecutively, all six visual must-haves, and the demo runbook/rehearsal. At CP3, require two rehearsals, backup recording and contract freeze.

## Current validation

E's unmerged baseline plus verification changes: root typecheck passed; root tests executed 21 tests successfully (18 shared + 3 SSE observer; other scaffold suites empty); dashboard and extension scaffold builds passed; all 16 smoke steps passed against E's private mock. A negative run against the original, still-running mock failed at step 3 with `Missing SSE event: parse tree_updated`, proving the new gate catches the reference defect. No real API, real Claude, Chrome extension or browser demo claim is made.

Independent review: `verify_e_cp1_preparation` (`gpt-6.1-sol`, medium) reran the shared suite (18/18), original private-mock smoke (16/16), and scripts/shared typechecks. It found a late SSE parsing/disconnection failure could be swallowed by cleanup; E fixed this, added the three observer regressions, and waited for the final sandbox intercept activity before closing/sampling the event history. The verifier reran the observer suite (3/3), scripts typecheck, and its original malformed-event reproduction, confirming the finding resolved with no new findings. It also demonstrated that constant unsuitable chat text can pass transport checks; this limitation is explicitly retained for real AI harness/browser verification rather than claimed as semantic coverage.
