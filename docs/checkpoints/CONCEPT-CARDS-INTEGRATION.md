# Concept-card integration

Human-requested order: dashboard `design/concept-cards` **`3cbe4f3`**, then extension `agent/extension` **`5dfafeb`**, onto main baseline **`b113cf5`**. Dashboard merge `ca73af2` precedes extension merge `6cbc158`. No contract change or Moss/API/intelligence runtime change.

The human also approved B's focused safety fixes and C's fit-all-cards correction. Integrated B `737b9ac` + `301bf70` as `6e8029a` + `990c46f`, preserving D's new styling and accessible status message while keeping B's Copy question. Additional B-owned correction `4138ed5` rechecks consent/student/API identity after health and protects replacement composers. C-owned `79d0920` permits fitting below0.5 and sets React Flow's minimum zoom accordingly. The separate map-only embed and multi-site branches are not merged.

## Behaviour and docs

- Fixed-size concept cards: gold mastered, violet learning, hatched slate locked; teal bypass tickets. Fraunces titles/brand and Nunito UI; matching card favicon/toolbar/popup/pill mark.
- Centred prerequisite-depth rows, vertical scrolling and frontier/back navigation. No module columns, drag positioning, inline module renaming or canvas pan/zoom. Saved positions are ignored. Module data/inspector assignment remain.
- Human-approved correction to the handoff's initial minimum: shrink below0.5 on narrow canvases so every card remains reachable. Vertical-only scrolling remains.
- Updated `design.md`, `docs/ui-layouts.md` §2/§5/§6, current tokens/student animation wording and secondary sandbox label, plus `docs/design/CONCEPT-CARDS.md` and C/D briefs. Demo order: teacher tree creation, then student/extension views. Detailed submission walkthrough remains deferred.

## Validation

- Frozen installation and workspace typecheck PASS.
- Root suite **314 PASS /26 files**: shared26, intelligence65, dashboard9, extension109, API93, scripts12. Initial requested design+D candidate passed287 before B fixes expanded coverage; final total includes the safety regressions.
- Both production builds PASS; after C's narrow-fit change, dashboard tests/typecheck/build rerun.
- Six dashboard browser suites on private mock: **all PASS on the final code** — demo, editing, polish/reduced motion, v4, resilience and visual. The visual suite's assertions are unchanged; E's temporary copy relocates only imports, endpoints and evidence to avoid resetting C's live services.
- Extra browser fixture with five root cards: every card's actual horizontal bounds fits teacher and sandbox views at **360/390/420/1280px**. This detects hidden clipping that a page-overflow check misses. PASS after C correction.
- Fake-backed real API v4 smoke **17/17 PASS**; extension/API **19/19 PASS** with the reviewed deployed API SHA explicitly supplied to the fixture. Native SDK/grading are not live in this test.
- Both standalone stream cancellation/failure regressions PASS. Main's Moss implementation remains unchanged.
- Independent `verify_concept_cards_merge` uses the agreed gpt-6.1-sol medium substitute. Initial review found narrow clipping and confirmed the old D bypass issues. **Final read-only source/docs review: no blocking findings**, fixes present and D styling retained. Its two stale colour phrases were corrected in the layout docs.
- Direct regression probes also PASS: consent revoked during health prevents the quota POST, and replacing the composer does not send or overwrite its draft.
- Evidence under `/tmp/friction-concept-evidence/`; generated screenshots do not replace C's committed visual references. No other agent's service/store was reset.

## Remaining limits

No API/Moss credentials or root .env in this instance: a fresh real-API rehearsal with a genuinely uploaded syllabus, real Claude/Moss calls, and a logged-in claude.ai conversation are **not verified here**. Existing release evidence is historical. A's per-student uploaded-course reset and CR-2 whole-class assignment remain separate API tasks. Conference submission deployment and extension HTTPS host support are separate from this visual merge.

## C and D handoff

- **C:** merge main before continuing, then read `docs/design/CONCEPT-CARDS.md`, `design.md` and `docs/ui-layouts.md`. `PillarHeader.tsx` is deleted; `CanvasActions.move`/`rename` are gone. Preserve fixed card layout, frontier scroll and the approved narrow-screen fitting.
- **D:** merge main into `agent/extension` before continuing. Preserve card glyph/icons, ticket labels/counts and B's integrated safety/Copy question behaviour. Reload the built extension and claude.ai tab for human testing; do not overwrite fixes with the older resend code.
- **B:** the focused safety corrections are integrated independently of the map-only feature. Rebase/merge main into future map work carefully: its prior canvas API/layout assumptions changed. Do not bulk-restore old pillar/zoom layout.
