# Agent C: Dashboard (educator + student + sandbox UI)

You are **Agent C**, one of four Claude Code agents building **Friction** in parallel for a hackathon. You own everything judges see. **Your sandbox chat page is the main demo surface**, shown next to the skill tree that lights up live when the student learns. Make it feel delightful. Make it work first.

## 0. Read first (in this order)
1. `AGENTS.md`: ownership and working rules (binding).
2. `PLAN.md`: the whole plan; your column in §5 (v5, simplified).
3. **`docs/ui-layouts.md`**: every screen you build, wireframed, with tokens. This is your spec.
4. `design.md`: visual language and the micro-animations (CP3).
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
- **API base URL:** `import.meta.env.VITE_API_URL` (`.env.example` sets 8787). For development against the mock, run **`pnpm dev:dash:mock`**, which uses Vite's `--mode mock` to load the committed root `.env.mock` (`VITE_API_URL=http://127.0.0.1:8788`). This works the same on Windows. Don't hand-write env files with `echo` (PowerShell writes UTF-16, which Vite can't read).

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
  tree/ProgressBadge.tsx   pill "1/4" (ticker animation at CP3)
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

## 6. Tasks and exit criteria (PLAN.md v5: 3 checkpoints)
**The sandbox chat is the main demo surface** (PLAN.md §2): split screen, sandbox chat on the left, the student tree updating live on the right. Build the six **must-haves** (PLAN.md §1) before anything else.

### CP1 (T+3h): must-haves 1 and 3 against the mock
- [ ] App shell + router + TopBar with a Live indicator
- [ ] `/educator/<seed tree>` and `/student/<demo student>`: 3 pillars, 8 nodes, 8 edges, locked/active/mastered colors, lock icons, `level/required` badges (ui-layouts §2/§2a/§3)
- [ ] Live: `pnpm smoke:mock` in a terminal turns useEffect green **without a reload**
- [ ] **`/sandbox` chat** streams replies via `api.chat`, shows concept / level / quiz for each turn from the `X-Friction-*` headers, and has a **New chat** button (new `conversation_id`)

### CP2 (T+9h): all six must-haves on the real API
- [ ] Sandbox layout for the demo: chat + a **live mini student tree** side by side (works at ~1280px wide on one screen)
- [ ] **Use bypass** button in the sandbox side panel → `api.bypass({student_id, node_id: current turn's node})`, showing the remaining quota and the 409 message
- [ ] Bypass **toast** on the educator page (`bypass` SSE event)
- [ ] Upload dialog (PDF + text) with the parsing animation → navigates to the tree
- [ ] **Reset demo** button (only when `/health` reports demo)
- [ ] Works with `pnpm dev:dash` against the real API on merged `main`
- [ ] Then, if time: educator editing (drag + persist, connect with cycle toast, inspector, add/delete node, pillar rename)

### CP3 (T+16h): polish, in this priority
- [ ] Mastery moment: padlock dissolves, node pulse, particles, badge ticker (this is the demo's money shot)
- [ ] Hover float + tooltip with the mastery criteria
- [ ] Class panel + class-count chips; activity feed
- [ ] Empty, loading and error states; edge energy pulse; parallax (cut first)

## 7. How to verify
```
pnpm dev:mock                         # terminal 1 (fake API on 8788)
pnpm dev:dash:mock                    # terminal 2 → http://localhost:5173 (talks to the mock)
pnpm smoke:mock                       # terminal 3: watch the tree update live
pnpm typecheck && pnpm --filter @friction/dashboard build
```
Also check it in a real browser (Claude in Chrome, if you have it) and attach screenshots or GIFs of each checkpoint's state to your status file notes.

## 8. Interfaces with the other agents
- You depend only on the HTTP API (A) via `@friction/shared`'s client. The mock is byte-compatible with what A builds.
- If the UI needs data the API doesn't return, compute it client-side if you can. Otherwise file a change request (additive) in your status file.
