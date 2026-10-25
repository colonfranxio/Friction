# Concept cards: visual redesign and handoff

Requested directly by the human (2026-10-24) after the Paper explorations in `docs/design/figma-brief/` (sketch "S3 Concept Cards"). This replaces the green/amber circle look described in `design.md` and the column tree in `docs/ui-layouts.md` §2. No contract change: same data, the same three node states, and the same four levels.

## Where it lives

| Surface | Branch | Commit |
|---|---|---|
| Dashboard (educator, student, sandbox) | `design/concept-cards` (off `main` at `b113cf5`) | the "Dashboard: concept-card skill tree…" commit and its follow-up |
| Extension (popup, claude.ai pill, side panel, toolbar icon) | `agent/extension` | `b3a2365` and its follow-up icon commit |

## The system

- **Palette** (`apps/dashboard/src/styles/tokens.css`):

  | Role | Name | Hex |
  |---|---|---|
  | Background | ground | `#F4F1FA` |
  | Text | ink | `#231B3A` |
  | Secondary text | muted | `#5E5675` |
  | Mastered | gold | `#E0A100` (ink `#7A5400`) |
  | Learning | violet | `#6D4AFF` (ink `#4B2FB8`) |
  | Locked | slate | `#8F86A8`, with hatching |
  | Bypass | teal | `#0E7A7A` |

  Errors keep their warm colour so they never look like a bypass.
- **Type:** Fraunces (card titles, headlines, logo) and Nunito (UI).
- **Logo:** a tilted gold card with an ink border. It is used for the favicon, the dashboard top bar, the extension toolbar icon, the popup header and the claude.ai pill mark.
- **Node = card.**
  - Every card is the same size, 132 × 172px.
  - It shows a kicker (LOCKED / LEARNING / MASTERED ★), an emblem with the concept icon (plus a padlock when locked), the title (two lines), a progress meter and the `level/required` badge.
  - Learning cards tilt a little.
  - State is never shown by colour alone: the kicker text, fill, border style and padlock each carry it too.
- **Mastery moment:** the card flips to its gold face with confetti; unlocked children turn face up. Reduced motion skips both.
- **Bypass:** a teal "ticket" with a ×N count, shown everywhere a bypass appears. The design rule is scarce, legitimate, and visible to the teacher, never alarming.

## Tree layout and navigation (`apps/dashboard/src/tree/layout.ts`, `SkillTreeCanvas.tsx`)

- **No module columns or banners.** Each row is one prerequisite level (`computeDepths`).
- **Centring and spacing:** every row is centred on one axis, with even spacing.
- **Row order:** syllabus order (module order, then the order the API returns concepts), shifted so each card sits under its prerequisites.
- **Saved positions:** `node.position` is ignored. The layout is standard for every course.
- **Navigation:** vertical scroll only, like a page. There is no zoom and no pan. Scale is fixed at 1 and only shrinks (to no less than 0.5) when the widest row would not fit the window's width.
- **Opening position:** opens scrolled to the learning frontier (the first row still in progress). It returns there when the viewer changes, but not on live updates or edits. A "Back to what you're learning" button appears once the frontier is scrolled out of view.

## Behaviour that changed (decide if any should come back)

1. **Module renaming.** Educators can no longer rename modules from the canvas, and module names are not shown in the tree. Modules still exist; the inspector still assigns each concept to one.
2. **Dragging.** Drag-to-position is removed, and saved positions are ignored.
3. **Zoom.** Ctrl+scroll over the tree now zooms the whole page (browser zoom), not the tree.

## Test changes (dashboard)

- `test/layout.test.ts` checks the centred rows, even spacing, parents above children, and that saved positions are ignored.
- `test/editing.browser.ts` checks that cards can't be dragged and that nothing is saved. It no longer renames a pillar, and it scrolls the tree before drawing connections.
- `test/visual.browser.ts` checks the tree is centred in its window and that the back button appears only after scrolling away. Its `ui-review` screenshots are refreshed.

## Verified

- **Dashboard:** typecheck, 9 unit tests, and the demo, editing, polish, v4, resilience and visual browser suites, run on a private mock (:8788) and a private dashboard (:5174).
- **Bigger course:** layout checked on the mock with 14 concepts and a 5-card row: no sideways overflow at 1440px or 1280px.
- **Extension:**
  - typecheck and 82 tests pass
  - built and loaded unpacked in Chrome for Testing
  - the service worker starts
  - the popup reports "Online" against the real API (:8787)
  - the icons are served
  - the pill mounts on claude.ai ("Friction · ready")
- **Not verified:**
  - a real CS160 upload: it isn't in the real store, and uploading would spend real Claude calls
  - a live claude.ai conversation behind login

## Next steps by owner

- **E:**
  - merge `design/concept-cards` into `main`, then `agent/extension`
  - update `design.md` and `docs/ui-layouts.md` §2, §5 and §6 from this page
  - do one rehearsal pass on the real API with an uploaded syllabus
- **C:** merge `main`, then read this page. The dashboard files under `src/tree/`, `src/styles/` and `src/pages/TreePage.tsx` changed. `PillarHeader.tsx` is deleted, and `CanvasActions` no longer has `move` or `rename`.
- **D:** pull `agent/extension`. `popup.html`, `popup.ts`, `sidepanel.html` and `src/lib/badge.ts` are restyled, and the new `badgeMark()` drives the pill's card glyph. `icons/` and the manifest `icons`/`default_icon` entries are new, and `build.mjs` copies the icons. Behaviour and wording are unchanged.
- **A:** unchanged, still open from MOSS-release: `POST /demo/reset {student_id}` restores seed states even when the student's active course is an uploaded one.
