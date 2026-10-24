# Agent C: Dashboard (educator + student + sandbox UI)

You are **Agent C**, one of four Claude Code agents building **Friction** in parallel for a hackathon. You own everything judges see in the browser except claude.ai itself: the skill tree that builds itself from a syllabus, lights up live when a student learns, and lets an educator edit it. Make it feel delightful. Make it work first.

## 0. Read first (in this order)
1. `AGENTS.md`: ownership and working rules (binding).
2. `PLAN.md`: the whole plan; your row in §5 and §6.
3. **`docs/ui-layouts.md`**: every screen you build, wireframed, with tokens. This is your spec.
4. `design.md`: visual language and the micro-animations (CP4).
5. `docs/contracts.md`: §3 (node status), §9 (SSE events), §10 (sandbox chat), §11 (privacy).
6. `packages/shared/src/*`: `createFrictionClient`, the `ServerEvent` types, `computeNodeStatuses`, `computeDepths`, `SEED_IDS`, `LEVEL_LABELS`, `ICON_KEYWORDS`, `CHAT_HEADERS`.

## 1. Your mission
Build `apps/dashboard`: a **Vite + React 19 SPA** on port 5173 with three routes (`/educator/:treeId`, `/student/:studentId`, `/sandbox`) that talks only to the API through the shared client and updates live over SSE. Until the real API is merged, develop against **the mock on :8788**, which implements the full contract with fake AI.

## 2. Ownership
- **You edit only:** `apps/dashboard/**` and `docs/status/C-dashboard.md`.
- **Never edit:** `packages/**`, other `apps/*`, `scripts/**`, `fixtures/**`, root config, other docs.
- **Branch:** `agent/dashboard`. Push only that branch.

## 3. What's already there
- `package.json` with react, react-dom, react-router-dom, @xyflow/react, framer-motion, canvas-confetti, lucide-react, @friction/shared, plus vite, @vitejs/plugin-react, tailwindcss + @tailwindcss/vite (Tailwind v4, so `@import "tailwindcss";` in CSS; no config file needed).
- `vite.config.ts` (React + Tailwind plugins, `envDir: '../../'` so it reads the root `.env`/`.env.local`, port 5173 strict). `index.html` loads Nunito. `src/main.tsx` is a placeholder.
- **API base URL:** `import.meta.env.VITE_API_URL` (`.env.example` sets 8787). For development against the mock, create a **root** `.env.local` with `VITE_API_URL=http://localhost:8788` (gitignored). Don't commit it.

## 4. Target file layout (create these)
```
apps/dashboard/src/
  main.tsx                 mount <App/>, import styles
  App.tsx                  BrowserRouter; "/" → /educator/<SEED_IDS.tree>; shell with TopBar
  lib/api.ts               const api = createFrictionClient(import.meta.env.VITE_API_URL ?? DEFAULT_API_URL)
  lib/useEvents.ts         EventSource(api.eventsUrl(treeId)); typed handlers per ServerEvent; auto-reconnect; exposes `live` boolean
  lib/useTreeData.ts       loads TreeBundle + students (+ activity); applies SSE events; refetches on tree_updated
  lib/icons.ts             ICON_KEYWORDS → lucide-react icons (fallback Circle)
  lib/format.ts            level chip text from LEVEL_LABELS, relative time
  pages/EducatorPage.tsx   canvas + toolbar + right panel (Class | Activity | Inspector)
  pages/StudentPage.tsx    read-only canvas + progress panel
  pages/SandboxPage.tsx    chat + "Friction for this turn" panel
  tree/SkillTreeCanvas.tsx React Flow wrapper: nodes/edges from data, edit mode, handlers
  tree/SkillNode.tsx       custom node (circle, icon, lock, badge, label, class-count chip)
  tree/ProgressBadge.tsx   pill "1/4" (ticker animation at CP4)
  tree/PillarHeader.tsx    column header (inline rename in edit mode)
  tree/layout.ts           pillar/depth layout (spec in ui-layouts §2)
  tree/edges.tsx           custom edge: rounded (8px) step path, colored by status
  panels/TopBar.tsx  Toolbar.tsx  ClassPanel.tsx  ActivityFeed.tsx  Inspector.tsx
  panels/UploadDialog.tsx  BypassToast.tsx
  anim/Particles.tsx       mastery burst (canvas-confetti, origin = node's screen position)
  anim/Parallax.tsx        breathing background (last)
  styles/tokens.css        CSS variables from ui-layouts "Design tokens"
  styles/index.css         @import "tailwindcss"; base styles; React Flow css import
```

## 5. Key implementation decisions (already made; follow them)
- **Data flow:** fetch with the shared client, then subscribe to SSE for the tree.
  - `student_state` → patch that state in memory.
  - `bypass` → toast + activity item.
  - `activity` → prepend to the feed.
  - `tree_updated` → refetch the tree + students.
  - `student_seen` → update last-seen.

  **No polling needed.** If SSE drops, show "Reconnecting…" and refetch on reconnect.
- **Status and colors** come only from `computeNodeStatuses(nodes, edges, levelsByNode)`. Badge = `level/required_blooms_level`.
- **Class view** (educator, "Viewing as: Class"): a node's color = the most common status across students. Class-count chip = the number of students whose **focus** is that node (focus = the active node with the lowest depth; ties → most recently updated).
- **Layout:** `tree/layout.ts`, per ui-layouts §2. Use `node.position` when set. In edit mode, save drags with `api.updateNode(id, {position})` on drag stop.
- **Editing** (React Flow built-ins):
  - `onConnect` → `api.createEdge` (on 409 `cycle`, toast "That would create a loop");
  - edge delete → `api.deleteEdge`;
  - inspector save → `api.updateNode`;
  - "+ Node" → `api.createNode`;
  - pillar rename → `api.renamePillar`;
  - badge click in edit mode → required-level picker.
- **Upload:** read the PDF with `FileReader` → base64 **without** the `data:` prefix → `api.parseTree({kind:'pdf', base64, filename})`, or text → `{kind:'text', text}`. Show the parsing animation (ui-layouts §2c) until it resolves, then navigate to `/educator/<tree_id>`. The demo syllabus returns in ~3s (cached); others can take 15–40s.
- **Sandbox:** `api.chat({student_id, conversation_id, messages})` returns a streaming `Response`. Read `res.body` with a reader + `TextDecoder`, appending into the AI bubble. Read the `X-Friction-*` headers for the side panel. "New chat" = a new `crypto.randomUUID()`. Student picker defaults to `SEED_IDS.demoStudent`.
- **Privacy:** the educator UI shows verdicts, confidence and rationale, never raw prompts (the API doesn't send them anyway).
- **Reset demo** button: only if `api.health()` returns `mode.demo === true`. It calls `api.demoReset({full: true})`.

## 6. Tasks and exit criteria

### CP1 (target T+3h): tree renders live against the mock
- [ ] App shell + router + TopBar with a working Live indicator
- [ ] `/educator/<seed tree>` renders 3 pillars, 8 nodes, 8 edges in the pillar layout, with locked/active/mastered colors, lock icons and badges, matching ui-layouts §2/§2a
- [ ] `/student/<demo student>` shows the same tree in that student's state
- [ ] Live: running `API_URL=http://localhost:8788 pnpm smoke` in a terminal visibly changes useEffect to mastered **without a page reload**

### CP2 (target T+8h): educator features + sandbox
- [ ] Edit mode: drag + persist, connect, delete edge (with cycle toast), add/delete node, inspector edits, required-level override, pillar rename
- [ ] Upload dialog (PDF + text) with the parsing animation; navigates to the new tree
- [ ] Right panel: Class tab (progress bars, bypasses left, last-seen), Activity tab, "Viewing as" selector, class-count chips
- [ ] Bypass toast on the `bypass` event
- [ ] `/sandbox` streams replies and shows concept, level and quiz for each turn

### CP3 (target T+14h): demo-grade polish
- [ ] Student page right panel ("Now learning", bypass dots), designed for a side-by-side split with claude.ai at ~900px wide
- [ ] Empty, loading and error states (API down → a friendly banner with a retry)
- [ ] Works against the real API (`VITE_API_URL=http://localhost:8787`) on merged `main`

### CP4 (target T+20h): design.md micro-animations, in this priority
- [ ] Unlock: padlock dissolves with a spring; the node fill pulses; the new edge draws outward (stroke-dashoffset)
- [ ] Hover: magnetic float/scale + the tooltip unfurls with the mastery criteria
- [ ] Mastery burst: particles bounded to the node radius on reaching L4 / mastered
- [ ] Badge ticker flip when the level changes
- [ ] Edge energy pulse on active paths (React Flow `animated` or a CSS dash animation)
- [ ] Parallax/breathing background (cut first if short on time)

## 7. How to verify
```
pnpm dev:mock                         # terminal 1 (fake API on 8788)
echo "VITE_API_URL=http://localhost:8788" > ../../.env.local   # once, from apps/dashboard (root .env.local)
pnpm dev:dash                         # terminal 2 → http://localhost:5173
API_URL=http://localhost:8788 pnpm smoke   # terminal 3: watch the tree update live
pnpm typecheck && pnpm --filter @friction/dashboard build
```
Also check it in a real browser (Claude in Chrome, if you have it) and attach screenshots or GIFs of each checkpoint's state to your status file notes.

## 8. Interfaces with the other agents
- You depend only on the HTTP API (A) via `@friction/shared`'s client. The mock is byte-compatible with what A builds.
- If the UI needs data the API doesn't return, compute it client-side if you can. Otherwise file a change request (additive) in your status file.
