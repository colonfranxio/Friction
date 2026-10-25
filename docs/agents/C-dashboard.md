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

## work left to do

### Moss sponsor-track handoff

Read [the detailed execution plan](../moss-implementation-handoff.md). Moss requires no new dashboard search interface or API contract. Continue your separate learning-map branch; the existing teaching-context display may show the concept selected through the normal flow. Later combined checks must point dashboard and extension at the same backend.


Current shared handoff: [CONTRACT READY v4](../checkpoints/CONTRACT-READY-v4.md). Follow its owner checklist; shared readiness does not mean the real API is API READY.

This section updates the remaining-work assignment after CP2. Own only `apps/dashboard/**` and your status file on `agent/dashboard`. Your tree, upload, sandbox, bypass/toast and existing polish are already integrated. Finish correctness and acceptance before adding more decoration.

### Start now, in parallel

- Merge current `main` and confirm the v4 handoff. Read `CHAT_HEADERS.quizAttached` per response, store it on that turn and display the exact value. Retain an explicitly approximate fallback only when the header is absent; never infer a new quiz solely from `level < 4`. Test true, false at L1 with an already-pending quiz, L4, no-match and old-server fallback. A and E's mock already emit the header; this task does not need a new contract.
- Add UI coverage for interrupted/partial replies and clear recovery behavior. The current API can finish a partial HTTP 200 response after a model error. Coordinate with A/E before relying on any new completion/error signal; do not label an interrupted reply complete or resend an unseen quiz answer automatically.
- Preserve New chat cancellation, per-turn bypass targeting, live mastery in all views, quota/toast, reset and mobile behavior. Expand the real-model acceptance checks without hardcoding the fake reply wording. Existing animations/class/activity code needs regression validation, not a rebuild.

### Dependencies and order

1. Exact v3 quiz display, UI tests and error-state preparation start immediately in parallel with A/B/D/E. Use the reference mock while A works.
2. **Wait for E's `CONTRACT READY` handoff** before implementing changed bypass scope or a new stream-failure protocol. E owns shared/client/mock changes; request missing behavior instead of editing those files or redefining contracts locally.
3. Merge that contract commit and wire the sandbox to the agreed bypass behavior against E's updated mock. Preserve existing-client fallback as specified. A's `API READY` handoff is required before claiming the new behavior works against the real endpoint.
4. Push `C READY` with SHA, tests and browser evidence. After E's B → A → C → D merge, rerun against the final API with real Claude and the human; mock screenshots alone do not satisfy CP2.

### Parallel safety and exit criteria

- Use your own existing isolated environment/checkout. Do not switch branches or install dependencies in a working directory another agent is using. No new worktrees unless explicitly requested.
- Your mock is 8788 and dashboard 5173. D uses 8789; E uses private mock 8790 and dashboard 5174 if sharing a host. Check the configured API URL, not just the dashboard port: two UIs can still mutate the same backend.
- Browser scripts and smoke reset demo data and overwrite screenshots. Serialize them per backend/store, use your own fixtures/session, and never reset another agent's rehearsal. E schedules the exclusive final API/browser test window. Keep generated evidence attributable to the run and preserve existing user files.
- Deliver dashboard tests, typecheck/build and browser regressions; validate exact quiz display, interruption/retry, upload, live progression, new chat, bypass/toast, quota/reset, responsive/reduced-motion behavior. If retaining optional educator editing, verify the complete edit/persist/cycle-error flow; otherwise defer it. Update stale status text claiming A/B are placeholders.

## Requested addition: learning map beside claude.ai (human request, 2026-10-24)

**Why:** in a real test the human found that, on claude.ai, students can't see their skill tree, so they don't know which concept to steer the conversation toward next. The Sandbox solves this with its mini tree; claude.ai has only D's level badge. D will show the student's map in a Chrome side panel (see D's brief, same heading). C supplies the page it shows.

**Priority:** nice-to-have, after must-haves and the open acceptance gates (PLAN.md rule). E schedules it. **No contract change:** it uses only the existing endpoints (`GET /students/:id`, `GET /trees/:id` bundle, students and SSE).

**C's task: an embeddable compact Student view**
- `/student/:studentId?embed=1` renders the existing Student view without the TopBar or route switcher, for a narrow panel (360–420px wide, full height, user-resizable). Without `embed=1`, nothing changes.
- Layout, top to bottom:
  1. Name and "N of M mastered" bar.
  2. **Now learning** card (as today).
  3. **Next up:** 2–3 active (unlocked, not mastered) nodes, shallowest depth first. Each shows `level/required` and the mastery criteria as a one-line hint, plus a "Try asking:" starter built on the client from `concept_name` (no new API call).
  4. The map, fitted to the width, read-only. If the map can't be legible at that width, show it collapsed behind a "Show map" toggle.
- Stays live via SSE exactly like the Student page. Mastery animations stay; reduced motion is respected.
- **Must render inside an iframe from a `chrome-extension://` page:** no frame-busting, and no `X-Frame-Options`/`frame-ancestors` that blocks it in dev or preview.
- Unknown student or API down: show the existing error/retry state in compact form, with no blank panel.
- Keep this surface read-only: no educator controls, upload/reset actions or raw chat content. "Try asking" is a visible suggestion, not an automatic send to claude.ai. Use shared status/depth rules with a stable tie-break for Next up; handle no active nodes without inventing a recommendation.
- Coordinate iframe readiness/error diagnostics with D. An iframe `load` event alone does not prove the dashboard or its API loaded successfully. If using `postMessage`, agree a small UI-only message shape and validate sender origin/source on both sides; no backend/shared contract change is needed.
- For integrated live updates, the dashboard's `VITE_API_URL` and D's stored API URL must target the **same intended backend/store**. The iframe inherits the dashboard's API configuration, not D's setting. Coordinate an isolated test window instead of resetting C's 8788 data from D's 8789 tests; changing Dashboard URL alone does not select its API.
- **Verify:**
  - browser check at 360px and 420px: no horizontal overflow, Next up lists only active nodes, and a correct answer graded elsewhere turns the node green live in the embed;
  - the full-width Student page is unchanged;
  - typecheck, build and existing browser suites still pass.

**Execution order and parallel safety (E review):** this request is accepted for the backlog; it does not close the open acceptance gates or authorize bypassing their priority. Once E schedules it, C's embed page and D's side-panel shell/settings/tests can proceed in parallel in their existing isolated checkouts and owned paths. C publishes **EMBED READY** with SHA, route, narrow-screen/error/live-update evidence and any agreed iframe signal. D's final panel integration depends on that handoff; the full Student-page fallback is temporary development scaffolding. Use C's reserved mock/dashboard ports, not D's backend. E merges C before D for this feature, then runs integrated iframe/consent checks and requests the human live-panel check. Preserve the existing API READY dependencies for bypass work; this read-only panel needs no new A/B API work.


## Concept-card integration handoff

Merge the published main into your branch before further work, then read [CONCEPT-CARDS](../design/CONCEPT-CARDS.md), [design.md](../../design.md), [UI layouts §2/§5/§6](../ui-layouts.md) and the concept-card integration report. Preserve centered prerequisite cards, vertical scrolling/frontier navigation, no drag/module rename, gold/violet/slate/teal styling, narrow-screen fitting below 0.5 when needed, and the integrated B safety fixes. C must not restore deleted PillarHeader or CanvasActions.move/rename; D must preserve card icons, ticket counts, Copy question and the new consent/composer guards when merging. Extension-first demo: teacher tree creation, then student/extension views.
