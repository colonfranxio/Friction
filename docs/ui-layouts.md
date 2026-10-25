# Friction UI Layouts (what the finished product looks like)

Every screen in the MVP, who owns it, and what's on it. Visual language comes from [design.md](../design.md): lavender ground, concept cards, Fraunces headings and Nunito UI. [Concept Cards](design/CONCEPT-CARDS.md) is the current visual handoff. The primary demo starts with teacher tree creation, then student views and the extension; the sandbox is a secondary surface.

| Screen | Route / surface | Owner |
|---|---|---|
| Educator canvas | dashboard `/educator/:treeId` | C |
| Student view | dashboard `/student/:studentId` | C |
| Sandbox chat | dashboard `/sandbox` | C |
| Upload dialog, inspector, class panel, activity, toasts | dashboard overlays/panels | C |
| Extension popup (primary student workflow) | `chrome-extension://…/popup.html` | D |
| On-page badge on claude.ai | injected shadow-DOM pill | D |

Default route `/` redirects to `/educator/33333333-3333-4333-8333-333333333333` (`SEED_IDS.tree`).

---

## Design tokens (C defines these in `src/styles/tokens.css`; D reuses the values in the popup and badge)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F4F1FA` | page/canvas ground |
| `--surface` | `#FFFFFF` | cards and panels |
| `--border` | `#E2DCEC` | borders |
| `--text` | `#231B3A` | primary ink |
| `--muted` | `#5E5675` | supporting text |
| `--locked` | `#8F86A8` | hatched slate locked cards |
| `--active` | `#6D4AFF` | violet learning cards |
| `--mastered` | `#E0A100` | gold mastered cards |
| `--alert` / bypass | `#0E7A7A` | teal tickets and teacher notification accents |
| font | Fraunces / Nunito | titles and logo / UI |

Errors keep their distinct warm treatment. Status text, hatching, borders and padlocks reinforce colour.

Level chip text comes from `LEVEL_LABELS` in shared: `L1 · Socratic`, `L2 · Scaffolder`, `L3 · Challenger`, `L4 · Normal`.

---

## 1. App shell (all dashboard pages)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ◆ Friction   React Fundamentals ▾        [ Educator | Student | Sandbox ]   ● Live │  ← TopBar 56px
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│                             page content                                       │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```
- The segmented control switches routes: Student goes to `/student/<SEED_IDS.demoStudent>`.
- `● Live` is violet while the SSE connection is open and grey with "Reconnecting…" otherwise.

## 2. Educator canvas: `/educator/:treeId`

The teacher opens this view first to upload a syllabus and create the tree. The toolbar retains Upload syllabus, + Node, Edit mode, Viewing as and demo-only Reset. The right panel retains Class/Activity tabs or the selected concept's inspector.

### 2a. Concept cards and prerequisite rows

- Each concept is a 132 × 172px card: state kicker, emblem/icon, title (two lines), progress meter and current/required badge. Layout reserves 178px including the shadow edge. Major/minor metadata no longer changes the visible card size.
- Mastered is gold with MASTERED ★; learning is violet with a slight tilt; locked is hatched slate with a padlock. Hover/focus exposes mastery criteria. Educator Class view retains the focus count.
- One centred, evenly spaced row per prerequisite depth. Order follows syllabus module order and API concept order, adjusted beneath prerequisites. Rounded prerequisite edges remain; module columns/banners are removed.
- Saved positions are ignored. Cards cannot be dragged; no canvas pan/zoom. The tree scrolls vertically, starts at the learning frontier, and returns there on viewer changes without jumping on live updates or edits.
- Scale is at most 1 and shrinks as needed to fit every card, including below 0.5 on narrow canvases (human-approved integration correction). Verify card bounds, not merely page overflow.
- “Back to what you're learning” appears only when the frontier leaves view. Ctrl+scroll zooms the browser page, not the tree.

### 2b. Viewing, editing and inspector

Class view uses shared majority status and focus counts; selecting a student uses that student's mastery. Class rows show progress, last seen and bypass tickets. Activity shows educator-safe verdict/confidence/rationale and teal bypass notifications; no raw questions or replies.

Edit mode supports creating/deleting concepts, editing name/module/criteria/required level/size/icon/keywords, connecting prerequisites and keyboard deletion of selected edges. A cycle returns the existing loop toast. Clicking the required-level badge still changes the required level. **Drag positioning and inline module renaming are removed intentionally.** Module assignment remains in the inspector; modules still exist in the API.

### 2c. Upload and live progress

The upload dialog accepts PDF or text and shows parsing/loading/error/retry states, then navigates to the returned tree. The populated canvas uses concept cards, not pillar columns or circles. Reset is shown only when health reports demo mode.

Mastery flips to gold with confined confetti, and unlocked children turn face up. Reduced motion skips decorative transitions, preserving live updates. Bypass toast uses a teal ticket, student/concept and remaining ×N count and auto-dismisses as before.

## 3. Student view: `/student/:studentId`

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ TopBar                                                                         │
├──────────────────────────────────────────────────────────────┬─────────────────┤
│                                                              │ Alex Chen       │
│              same canvas, read-only,                         │ 3 of 8 mastered │
│              colored by THIS student's state                 │ ▓▓▓▓▓░░░░░      │
│                                                              │                 │
│                                                              │ Now learning    │
│                                                              │ ⟳ React useEffect│
│                                                              │ L1 · Socratic   │
│                                                              │ "Identify and…" │
│                                                              │                 │
│                                                              │ Tickets  ×3     │
├──────────────────────────────────────────────────────────────┴─────────────────┤
│ legend                                                                         │
└────────────────────────────────────────────────────────────────────────────────┘
```
- "Now learning" = the most recently updated active node.
- Live via SSE. When a concept becomes mastered: the card flips gold with contained confetti and unlocked children turn face up. Reduced motion skips decorative effects while retaining live state.
- **This is the screen shown side by side with claude.ai in the demo.**

## 4. Sandbox: `/sandbox` (secondary testing/fallback surface)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ TopBar                                                                         │
├──────────────────────────────────────────────────────┬─────────────────────────┤
│  Student: [Alex Chen ▾]                 [New chat]   │ Friction for this turn  │
│                                                      │                         │
│        ┌──────────────────────────────────────┐      │ Concept  React useEffect│
│        │ How do I stop my useEffect from…     │ you  │ Level    L1 · Socratic  │
│        └──────────────────────────────────────┘      │ Quiz     attached       │
│  ┌──────────────────────────────────────────────┐    │                         │
│  │ Before we fix it… Quick check: what does     │ AI │ ▸ Show hidden prompt    │
│  │ the dependency array tell React?             │    │ ┌─────────────────────┐ │
│  └──────────────────────────────────────────────┘    │ │ ⟦friction⟧          │ │
│                                                      │ │ Level: 1 (Socratic) │ │
│                                                      │ │ …                   │ │
│                                                      │ └─────────────────────┘ │
│                                                      │ [ Use bypass (3 left) ] │
│  [ Ask anything…                         ] [Send]    │  mini tree (student),   │
│                                                      │  updates live           │
└──────────────────────────────────────────────────────┴─────────────────────────┘
```
- Streams `POST /chat`. Reads `X-Friction-*` headers for the right panel. "Show hidden prompt" displays what was injected (rebuilt client-side is fine: show the level and node; the exact text is optional).
- "New chat" generates a new `conversation_id` (uuid).
- **Use bypass** → `POST /bypass` for the current turn's node; shows the remaining quota, or "No bypasses left" on 409.
- The mini tree is the student view (same live SSE data), so the demo works on one screen: ask → push back → answer → card turns gold.

## 5. Extension popup (primary student workflow)

- Gold-card logo and Fraunces brand heading on lavender ground, with Nunito controls and supporting text. Toolbar icons at 16/32/48/128px use the same tilted card mark; `build.mjs` copies them.
- Online/offline indicator and consent toggle remain. Consent off must prevent new API actions and unload an open learning-map iframe.
- Current concept is presented as a card with the existing level chip and assistance wording. Empty/locked treatment uses hatched slate; violet denotes learning and gold normal/mastered assistance.
- Bypass is a teal ticket: label plus separate ×N stub, remaining quota and teacher-notification text. The readiness gate selects honest prompt-only versus pause-until-reset wording. Preserve 409 and offline errors.
- Copy question is available when a paid bypass cannot safely resend because the user changed chat/draft/consent/send state. Do not claim successful delivery; never overwrite their new draft.
- Open learning map opens Chrome's side panel directly from the click gesture; the toolbar popup stays the default action. Settings retain Student ID, API URL, approved API READY SHA and separate Dashboard URL. The dashboard and extension must use the same backend/store for live mastery.
- The panel inherits this palette and frames `/student/:id?embed=1`: the live map alone, with click-to-open status/level/criteria details. Close or Escape returns focus to the concept card. Consent-off, unreachable/Retry and compact API-error states remain. The full Student route is unchanged.

## 6. On-page claude.ai pill

Fixed bottom-right inside shadow DOM, 12px from the edges, with the card glyph driven by `badgeMark()`. The shell is white with an ink border; Nunito text and state marks match the popup. Only the pill's own controls receive pointer events.

| State | Treatment and behaviour |
|---|---|
| Learning L1–L3 | Violet card mark, concept/level text and eligible teal Bypass ticket |
| Normal/mastered | Gold card mark; existing no-friction wording |
| Idle/offline/disabled | Slate/dashed mark with explicit status; existing fail-open behaviour |
| Bypassed | Teal ticket mark with remaining count and scope-appropriate wording |
| Quota spent, not sent | Explicit reason and Copy question; do not arm/resend into a changed chat or draft |
| Error/reload | Distinct status text and alert treatment; never masquerade as a bypass |

The pill updates after interception. Keep hidden-prompt stripping, chat isolation, draft protection, consent and API-readiness gates intact. Styling does not change grading, mastery or HTTP contracts. Actual claude.ai conversation/reload behaviour needs the human live check after rebuilding the extension.
