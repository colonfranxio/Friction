# Friction UI Layouts (what the finished product looks like)

Every screen in the MVP, who owns it, and what's on it. Visual language comes from [design.md](../design.md): warm light mode, rounded geometry, Nunito.

| Screen | Route / surface | Owner |
|---|---|---|
| Educator canvas | dashboard `/educator/:treeId` | C |
| Student view | dashboard `/student/:studentId` | C |
| Sandbox chat | dashboard `/sandbox` | C |
| Upload dialog, inspector, class panel, activity, toasts | dashboard overlays/panels | C |
| Extension popup (bonus) | `chrome-extension://…/popup.html` | D |
| On-page badge on claude.ai | injected shadow-DOM pill | D |

Default route `/` redirects to `/educator/33333333-3333-4333-8333-333333333333` (`SEED_IDS.tree`).

---

## Design tokens (C defines these in `src/styles/tokens.css`; D reuses the values in the popup and badge)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FDFBF7` | canvas / page |
| `--surface` | `#FFFFFF` | cards, panels |
| `--border` | `#E5E7EB` | panel borders, locked edges |
| `--text` | `#1F2937` | primary text |
| `--muted` | `#6B7280` | secondary text |
| `--locked` | `#9CA3AF` | locked nodes |
| `--active` | `#F59E0B` | in-progress nodes and edges, L1–L3 chips |
| `--mastered` | `#10B981` | mastered nodes and edges, L4 chip |
| `--alert` | `#F97316` | bypass toast accent (warm orange, not red) |
| radius | 8px lines, 12px cards, full pills | |
| font | Nunito 400/600/700/800 (loaded in `index.html`) | |

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
- `● Live` is green while the SSE connection is open and grey with "Reconnecting…" otherwise.

## 2. Educator canvas: `/educator/:treeId`

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ TopBar                                                                         │
├────────────────────────────────────────────────────────────────────────────────┤
│ [⇪ Upload syllabus] [+ Node] [✎ Edit mode ◯]   Viewing as: [Class ▾]   [↺ Reset demo] │ ← toolbar 48px
├──────────────────────────────────────────────────────────────┬─────────────────┤
│   FOUNDATIONS ✎       EFFECTS & DATA ✎      BUILDING APPS ✎  │ [Class|Activity]│
│                                                              │                 │
│      (◉) JSX & Comp.                                         │ Alex Chen   ●   │
│      [3/3]  ⓹                                                │ ▓▓▓▓▓░░░ 3/8    │
│      ╭──┴─────╮                                              │ bypass 3 left   │
│   (○) Props  (◉) useState                                    │ ─────────────── │
│   [3/3]      [4/4]  ─────────────╮                           │ Priya       ●   │
│                 │                │                           │ ▓▓▓▓▓▓▓░ 6/8    │
│                 ╰──────► (◉) React useEffect   (○) Context   │ …               │
│                           [1/4] ⓬            [2/3]          │                 │
│                          ╭──┴────────╮          │            │                 │
│                    (🔒) Data      (🔒) Custom   │            │                 │
│                     Fetching       Hooks ──────►(🔒) Perf.  │                 │
│                     [1/3]          [1/4]        [1/4]        │                 │
│                                                              │                 │
├──────────────────────────────────────────────────────────────┴─────────────────┤
│ legend:  ● mastered   ● active   ● locked                       zoom − ▢ +    │
└────────────────────────────────────────────────────────────────────────────────┘
```
- **Layout** (`src/tree/layout.ts`): one column per pillar (ordered by `Pillar.order`), column width 280px, gap 40px. `y = computeDepths()[node] × 150px + 80px`. Nodes in the same pillar at the same depth sit side by side, 100px apart. If `node.position` is set, use it.
- **Pillar header:** uppercase label pill at the top of each column. In edit mode, clicking ✎ renames it inline (`PATCH /pillars/:id`).
- **Viewing as:**
  - `Class` (default): node colors show the **class majority** status; the ⓹ chip is the number of students whose current focus is that node (heatmap).
  - Picking a student: colors and badges show that student's state.
- **Right panel (320px)**, tabs:
  - **Class:** students sorted by progress. Each row: name, last-seen dot (green < 2 min, grey otherwise, `○ Friction off` when the heartbeat says disabled), mastered/total bar, bypasses left. Clicking a row sets "Viewing as".
  - **Activity:** `ActivityItem` feed, newest first. `Alex Chen · React useEffect · ✓ correct (0.92) → L4`, expand for the rationale. Bypass items have an orange left border.
  - **Inspector:** replaces the tabs when a node is selected (§2b).
- **Edit mode** on: nodes draggable (save on drag end with `PATCH position`), connect handle → `POST /edges` (a 409 shows a toast "That would create a loop"), select an edge + Backspace → `DELETE`, `+ Node` opens the inspector blank.
- **Reset demo:** only shown when `/health` reports `demo: true`.

### 2a. Node anatomy
```
        ⓬            ← class count chip (educator, Class view only)
      ╭─────╮
      │  ⟳  │        ← circle: major 72px / minor 52px, icon from ICON_KEYWORDS (lucide), white glyph
      ╰─────╯           fill: locked #9CA3AF + small 🔒 overlay · active #F59E0B · mastered #10B981
      [ 1/4 ]        ← pill badge: current/required (click in edit mode → required-level picker 1–4)
   React useEffect   ← label, 13px 700, max 2 lines
```
Hover: scale 1.06, a 2px float, and a tooltip with the mastery criteria and the student's level chip.

### 2b. Inspector (right panel)
```
┌ React useEffect ───────────────── ✕ ┐
│ Concept    [React useEffect       ] │
│ Pillar     [Effects & Data ▾]       │
│ Mastery    [Identify and prevent  ] │
│            [an infinite render…   ] │
│ Required   (1)(2)(3)(●4)            │
│ Size       (● major)(○ minor)       │
│ Icon       [refresh ▾]              │
│ Keywords   useeffect × dependency…  │
│ ─────────────────────────────────── │
│ Recent checks on this node          │
│ Alex  ✓ correct 0.92  2m ago        │
│ Priya ~ partial 0.55  9m ago        │
│ [Delete node]            [Save]     │
└─────────────────────────────────────┘
```

### 2c. Upload dialog
```
┌ Generate a skill tree ─────────────────────── ✕ ┐
│  ┌───────────────────────────────────────────┐  │
│  │      ⇪  Drop a syllabus PDF here          │  │
│  │         or click to choose                │  │
│  └───────────────────────────────────────────┘  │
│  — or paste text —                              │
│  [                                          ]   │
│                               [Generate tree]   │
└─────────────────────────────────────────────────┘
```
While parsing: the dialog shows empty pillar columns filling with grey ghost circles one by one, with the line "Reading syllabus… finding concepts… linking prerequisites…". On success, it closes and navigates to `/educator/<tree_id>`; nodes animate in pillar by pillar.

### 2d. Bypass toast (top-right, stacks, auto-hides after 8s)
```
┌──────────────────────────────────────────┐
│ ▍⚠  Alex Chen used a bypass              │
│ ▍   on Context API · 2 left              │
└──────────────────────────────────────────┘
```

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
│                                                              │ Bypasses  ●●●   │
├──────────────────────────────────────────────────────────────┴─────────────────┤
│ legend                                                                         │
└────────────────────────────────────────────────────────────────────────────────┘
```
- "Now learning" = the most recently updated active node.
- Live via SSE. When a node becomes mastered: the padlock dissolves on the children, the node pulses, particles burst inside the node radius, the badge ticks 1/4 → 4/4, and newly unlocked edges draw outward.
- **This is the screen shown side by side with claude.ai in the demo.**

## 4. Sandbox: `/sandbox` (MAIN DEMO SURFACE)

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
- The mini tree is the student view (same live SSE data), so the demo works on one screen: ask → push back → answer → node turns green.

## 5. Extension popup (D, bonus), 360 × ~460px

```
┌──────────────────────────────────┐
│ ◆ Friction              ● Online │   ← ● grey "Offline" when /health fails
├──────────────────────────────────┤
│ Friction enabled          [ ●━ ] │   ← consent toggle; off = no API calls at all
│                                  │
│ Current concept                  │
│ ⟳ React useEffect                │
│ ┌────────────────┐               │
│ │ L1 · Socratic  │  Max friction │
│ └────────────────┘               │
│                                  │
│ [ Use a bypass (3 left) ]        │   ← POST /bypass for the current node; 409 → "No bypasses left"
│ Bypass skips friction for this   │
│ concept and notifies your teacher│
├──────────────────────────────────┤
│ ▸ Settings                       │
│   Student ID [2222…2222       ]  │
│   API URL    [http://127.0.0.1:8787] │
│                    v0.1 · CP1    │
└──────────────────────────────────┘
```

## 6. On-page badge on claude.ai (D)

Fixed at the bottom-right, inside a shadow DOM so claude.ai's CSS can't touch it, 12px from the edges:
```
 ╭──────────────────────────────────────╮
 │ ◆ Friction · L1 Socratic · useEffect │      active (amber dot)
 ╰──────────────────────────────────────╯
 ╭──────────────────────────╮
 │ ◆ Friction · no friction │                  no node matched / L4 (green dot)
 ╰──────────────────────────╯
 ╭──────────────────────────╮
 │ ◆ Friction offline       │                  API unreachable (grey dot); prompts pass through unchanged
 ╰──────────────────────────╯
```
It updates after every intercept. It never blocks clicks on claude.ai's own UI (`pointer-events: none` except on the pill itself).
