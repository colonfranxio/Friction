# Friction — Build Plan v4 (4 parallel agents, MVP)

Read with [PRD.md](PRD.md) (what & why), [design.md](design.md) (look & feel), [docs/contracts.md](docs/contracts.md) (behavior rules), [docs/ui-layouts.md](docs/ui-layouts.md) (every screen).

**Status:** contracts frozen at `CONTRACT_VERSION = 1`. The shared package, mock API and smoke test are built and verified: `pnpm smoke` passes 11/11 against the mock. The four agents start from here.

---

## 1. The MVP in one paragraph

A student uses claude.ai normally. A Chrome extension catches each prompt just before it's sent and asks our API which concept it's about and what level the student is at for that concept. Then it quietly appends instructions: Socratic at L1, scaffold at L2, find-the-bug at L3, normal at L4. The AI ends its reply with a check question. The student's next message is graded as the answer. A correct answer moves the student up, and the educator's skill tree updates live. Educators create the tree by uploading a syllabus PDF.

**Demo (must work):** PDF → tree · L1 pushback on claude.ai · quiz answer → node turns green live · same question in a new chat → full answer · bypass → educator alert. **Safety net:** a `/sandbox` chat page that runs the same pipeline without claude.ai.

---

## 2. Problems found in v2/v3 and how v4 solves them

| # | Problem | Solution (now in contracts/code) |
|---|---|---|
| 1 | **Supabase was a human blocker** (create project, keys, RLS, realtime publication) and depends on venue Wi-Fi for every DB read. | **The API owns a local JSON-file store** (`apps/api/data/db.json`), seeded from `packages/shared/src/seed.ts`. **Live updates are Server-Sent Events** from the API (`GET /events`). No accounts or RLS, nothing to configure. A `Store` interface keeps Supabase as an optional swap after CP3. |
| 2 | Next.js added SSR/app-router complexity to what is a client-only dashboard. | **Vite + React SPA** on 5173 (React Router, React Flow, Tailwind, framer-motion). |
| 3 | No lead session existed to own shared files or merge mid-build. | **A fifth session, Agent E (Integrator)**, owns `main`, `packages/shared`, `scripts/` and `docs/`. It merges at each checkpoint, verifies, applies change requests, and reports (§7, [docs/agents/E-integrator.md](docs/agents/E-integrator.md)). Builders never touch lead-owned files. |
| 4 | Lockfile and dependency bottleneck: "only the lead adds deps." | All expected deps are **pre-installed now**. If an agent needs more, it adds them to **its own** `package.json` only. On merge, a lockfile conflict is fixed with `pnpm install` (§7). |
| 5 | Port clash between the mock API and the real API. | Real API **8787**, mock **8788**, dashboard **5173** (`PORTS` in shared). |
| 6 | Agents could drift on shapes, rules or prompt format. | Single source of truth in `packages/shared`: types, endpoint contract, a **typed client**, **progression and status rules as functions**, `wrapInjected`/`stripInjected`, seed data and fakes. Nobody re-implements a rule. |
| 7 | Nobody owned the recorded claude.ai traffic. | **D owns it** (`apps/extension/test/fixtures/`). D captures it in the first hour, using Claude in Chrome if available, otherwise by asking the human. |
| 8 | The answer turn may not match the quiz's concept. | **Pending-quiz precedence**: an open quiz in the same conversation decides the node. |
| 9 | Vague follow-ups ("explain more") would escape friction. | **Conversation stickiness**: no match falls back to the conversation's last node. |
| 10 | A slow grade could silently drop the demo's promotion. | A **late grade still applies** when it lands, and the dashboard updates via SSE. |
| 11 | Grading lacked the quiz text if `/responses` was lost. | `previous_assistant_text` from the DOM is a fallback. |
| 12 | The AI's reply to the answer was incoherent: the level changed but the AI didn't know why. | `feedback: {verdict}` is passed into the friction prompt on the answer turn, so the AI says "Correct!" before moving on. |
| 13 | A live parse takes 15–40s on stage, and the parsed tree had no classmates. | **DEMO_MODE parse cache**: the demo syllabus (`fixtures/demo-syllabus.md`/`.pdf`) re-activates the **seed tree**, which already has 15 classmates. There's a 3s fake "parsing" animation. Other files parse live. |
| 14 | Rehearsals needed clean state. | `POST /demo/reset` (student or full). |
| 15 | The "secondary async chat-log evaluation" duplicated the grader. | **Cut.** One grader, run on the answer turn. |
| 16 | Model IDs and Claude API shapes drift. | Models come from env (`MODEL_*`). B must load the `claude-api` skill before writing SDK code. |
| 17 | The extension can't call our API from the page (claude.ai CSP, Chrome localhost blocking). | MAIN-world fetch patch → postMessage → isolated content script → service worker → API (D's brief). |
| 18 | The injected block shows after a reload. | D strips it in rendered bubbles with a `MutationObserver` (CP3). Demo hygiene: don't reload. |
| 19 | Educators seeing raw student chats is a privacy problem. | The educator API returns **ActivityItem** (verdict, confidence, rationale) and never raw prompts. |
| 20 | Smoke can't drive claude.ai. | Smoke is API-level. The claude.ai path is checked by a human in Chrome at each checkpoint. |

---

## 3. Architecture

```
 Chrome (student)                                   Laptop (runs everything locally)
┌──────────────────────────────────────┐          ┌───────────────────────────────────────────┐
│ claude.ai tab                        │          │ apps/api  (Hono, :8787)        [Agent A]  │
│  main-world.ts  fetch patch          │          │  routes ─ /intercept hot path             │
│     ⇅ postMessage                    │          │  store  ─ data/db.json (seeded)           │
│  content.ts  DOM read, badge, hide   │          │  events ─ SSE bus  ──────────────┐        │
│     ⇅ runtime.sendMessage            │  HTTP    │  uses Intelligence interface     │        │
│  background.ts  ─────────────────────┼─────────►│        │                         │        │
│  popup  (student, API URL, bypass)   │          │        ▼                         │        │
│                         [Agent D]    │          │ packages/intelligence  [Agent B] │        │
└──────────────────────────────────────┘          │  parse · classify · templates ·  │        │
                                                  │  evaluate · chat ──► Claude API  │        │
 Browser (educator / judges)                      │                                  │        │
┌──────────────────────────────────────┐   HTTP   │                                  │        │
│ apps/dashboard (Vite, :5173)         │◄─────────┼──────────── SSE /events ─────────┘        │
│  /educator/:treeId  /student/:id     │─────────►│                                           │
│  /sandbox                [Agent C]   │          │ packages/shared  (frozen contract) [Lead] │
└──────────────────────────────────────┘          └───────────────────────────────────────────┘
```

**Stack (installed):** pnpm 9 workspaces · TypeScript · Node 22 · Hono 4 + @hono/node-server · @anthropic-ai/sdk + zod · Vite 8 + React 19 + React Router 7 + @xyflow/react 12 + Tailwind 4 + framer-motion + canvas-confetti + lucide-react · esbuild + @types/chrome · vitest · tsx.

**Models (env):** `MODEL_PARSE` / `MODEL_GRADE` / `MODEL_CHAT` = `claude-opus-5-5`, `MODEL_CLASSIFY` = `claude-haiku-5-5` (fallback classifier only; keywords run first).

---

## 4. Final repository layout and ownership

**Legend:** 🔒 Lead = Agent E, the Integrator (builders never edit) · 🅰 Platform · 🅱 Intelligence · 🅲 Dashboard · 🅳 Extension · ✅ = exists now · ⬜ = the owning agent creates it

```
Friction/
├── PLAN.md  PRD.md  design.md  README.md  AGENTS.md  CLAUDE.md          🔒 ✅
├── package.json  pnpm-workspace.yaml  tsconfig.base.json  .env.example  🔒 ✅
├── .gitignore                                                           🔒 ✅
├── pnpm-lock.yaml                 shared; regenerate on conflict (§7)      ✅
│
├── docs/
│   ├── contracts.md               behavior rules                       🔒 ✅
│   ├── contracts-CHANGELOG.md                                          🔒 ✅
│   ├── ui-layouts.md              every screen, wireframed             🔒 ✅
│   ├── agents/
│   │   ├── A-platform.md          agent prompts                        🔒 ✅
│   │   ├── B-intelligence.md                                           🔒 ✅
│   │   ├── C-dashboard.md                                              🔒 ✅
│   │   └── D-extension.md                                              🔒 ✅
│   └── status/
│       ├── A-platform.md          each agent owns ONLY its own file    🅰 ✅
│       ├── B-intelligence.md                                           🅱 ✅
│       ├── C-dashboard.md                                              🅲 ✅
│       └── D-extension.md                                              🅳 ✅
│
├── fixtures/
│   ├── demo-syllabus.md           demo syllabus (text)                 🔒 ✅
│   └── demo-syllabus.pdf          print of the .md (human, optional)   🔒 ⬜
│
├── scripts/
│   ├── mock-api.ts                full contract on :8788 (reference)   🔒 ✅
│   ├── smoke.ts                   PRD demo at API level                🔒 ✅
│   ├── setup-worktrees.sh         optional one-machine setup           🔒 ✅
│   └── tsconfig.json                                                   🔒 ✅
│
├── packages/
│   ├── shared/                    THE CONTRACT                         🔒 ✅
│   │   └── src/ constants.ts types.ts api.ts intelligence.ts rules.ts
│   │            client.ts seed.ts fakes.ts index.ts
│   │
│   └── intelligence/                                                   🅱
│       ├── package.json  tsconfig.json                                    ✅
│       ├── src/index.ts           createIntelligence(): Intelligence      ✅ (placeholder → fakes)
│       ├── src/config.ts          env + Anthropic client                  ⬜
│       ├── src/templates.ts       buildFrictionPrompt                     ⬜
│       ├── src/classify.ts        keywords → Haiku fallback → cache       ⬜
│       ├── src/evaluate.ts        quiz grading                            ⬜
│       ├── src/parse.ts           PDF/text → ParsedTree                   ⬜
│       ├── src/chat.ts            streaming chat (sandbox)                ⬜
│       ├── src/schemas.ts         zod schemas for structured outputs      ⬜
│       ├── test/*.test.ts                                                 ⬜
│       └── harness/ run.ts cases.ts results/latest.md                     ⬜
│
└── apps/
    ├── api/                                                            🅰
    │   ├── package.json  tsconfig.json                                    ✅
    │   ├── src/index.ts           boot on API_PORT                        ✅ (placeholder)
    │   ├── src/app.ts             Hono app, CORS, error handler, routes   ⬜
    │   ├── src/env.ts                                                     ⬜
    │   ├── src/store/store.ts     Store interface                         ⬜
    │   ├── src/store/json-store.ts  file-backed, seeded                   ⬜
    │   ├── src/events.ts          SSE bus                                 ⬜
    │   ├── src/intelligence.ts    fake vs real switch                     ⬜
    │   ├── src/services/intercept.ts  hot-path algorithm                  ⬜
    │   ├── src/services/demo-cache.ts                                     ⬜
    │   ├── src/routes/*.ts        one file per resource                   ⬜
    │   ├── test/*.test.ts         endpoint tests (app.request)            ⬜
    │   └── data/db.json           runtime, gitignored                     ⬜
    │
    ├── dashboard/                                                      🅲
    │   ├── package.json tsconfig.json vite.config.ts index.html           ✅
    │   ├── src/main.tsx                                                   ✅ (placeholder)
    │   ├── src/App.tsx            router + shell                          ⬜
    │   ├── src/lib/api.ts  src/lib/useEvents.ts  src/lib/icons.ts         ⬜
    │   ├── src/pages/ EducatorPage StudentPage SandboxPage                ⬜
    │   ├── src/tree/ SkillTreeCanvas SkillNode ProgressBadge PillarHeader
    │   │             layout.ts edges.tsx                                  ⬜
    │   ├── src/panels/ Inspector ClassPanel ActivityFeed UploadDialog
    │   │               BypassToast TopBar                                 ⬜
    │   ├── src/anim/ Particles.tsx Parallax.tsx                           ⬜
    │   └── src/styles/ tokens.css index.css                               ⬜
    │
    └── extension/                                                      🅳
        ├── package.json tsconfig.json build.mjs                           ✅
        ├── src/background.ts                                              ✅ (placeholder)
        ├── manifest.json  popup.html  NOTES.md                            ⬜
        ├── src/main-world.ts  src/content.ts  src/popup.ts                ⬜
        ├── src/adapters/claude.ts   (chatgpt.ts = stretch)                ⬜
        ├── src/lib/ bridge.ts sse.ts storage.ts hide-injected.ts badge.ts ⬜
        ├── test/fixtures/claude/   recorded traffic (sanitized)           ⬜
        ├── test/*.test.ts                                                 ⬜
        └── dist/                    build output, gitignored              ⬜
```

**Hard rules:** an agent edits only paths marked with its letter, plus its own `docs/status/` file. Anything 🔒 is read-only for agents. If something under 🔒 is wrong, the agent works around it locally and files a change request (§7).

---

## 5. Who does what (summary; full detail in each agent's prompt)

| Agent | Delivers | Consumes | Prompt |
|---|---|---|---|
| **A Platform** | Real API on 8787 implementing every endpoint in `shared/src/api.ts`; JSON store; SSE; `/intercept` algorithm; demo cache; `/chat` stream | `@friction/shared`, `@friction/intelligence` | [docs/agents/A-platform.md](docs/agents/A-platform.md) |
| **B Intelligence** | Real `Intelligence` implementation (parse, classify, templates, evaluate, chat) and a level-compliance harness | `@friction/shared`, Claude API | [docs/agents/B-intelligence.md](docs/agents/B-intelligence.md) |
| **C Dashboard** | Educator canvas (edit, upload, class view, activity, alerts), student view, sandbox, all design.md polish | API (mock → real), shared client/rules | [docs/agents/C-dashboard.md](docs/agents/C-dashboard.md) |
| **D Extension** | MV3 interception on claude.ai, response capture, popup + bypass, on-page badge, hide injected text | API (mock → real), shared client/rules | [docs/agents/D-extension.md](docs/agents/D-extension.md) |
| **E Integrator** | Merges at each checkpoint, verifies (typecheck, tests, smoke, builds), applies contract changes, writes `docs/checkpoints/CPn.md`, owns the demo runbook. **Builds no features.** | All four branches | [docs/agents/E-integrator.md](docs/agents/E-integrator.md) |

Everyone can start immediately and in parallel. C and D develop against the mock (`pnpm dev:mock`). A develops against the fakes. B develops against unit tests and the harness.

---

## 6. Checkpoints (hours from agent kickoff, T0)

| Gate | A Platform | B Intelligence | C Dashboard | D Extension | Integration check (human) |
|---|---|---|---|---|---|
| **CP1 · T+3h** Skeleton | All endpoints on 8787 with fakes and the JSON store; `pnpm smoke` passes against 8787 | Templates for all 4 levels; keyword classifier; real evaluate; unit tests; grade latency measured | Seed tree renders in pillars with locked/active/mastered + badges; SSE live update works against the mock | Fixtures captured; adapter tests pass; **live on claude.ai the injected prompt reaches Claude** (against the mock) | **Go/no-go on interception** (fetch patch → text-box fallback → sandbox-first demo) |
| **CP2 · T+8h** Real intelligence | `USE_REAL_INTELLIGENCE=1` works; `/trees/parse` live + demo cache; `/chat` streams | Real parse (PDF + text), LLM classify fallback, chat stream; harness v1 results | Educator editing, upload + parse animation, class panel, activity, bypass toast, sandbox page | Popup (settings, consent toggle, bypass), `/responses` capture, badge, works against the real API | Smoke passes with real Claude; demo steps 1–2 on claude.ai |
| **CP3 · T+14h** Full loop | Late-grade apply, per-student lock, latency logs, error polish | Harness ≥4/5 on L1, L2, L4; grading matches expected verdicts | Student view polished; "viewing as" student; empty/error states | Hide-injected observer; offline badge; new-chat and multi-tab robustness | **Whole demo 3× in a row on claude.ai and in the sandbox** |
| **CP4 · T+20h** Polish + freeze | Heartbeat; final hardening | L3 "find the bug" ≥4/5 | Animations (unlock spring, hover float, tooltip, particles, badge ticker, edge pulse; parallax last) | Heartbeat; chatgpt.com adapter (stretch) | 2 rehearsals, backup recording. **No contract changes after CP4.** |

**Rule:** if CP3 isn't green, CP4 polish is frozen until it is.
**Cut order if behind:** chatgpt.com → parallax/edge pulse → heartbeat/consent → class heatmap → L3. Never cut: PDF → tree, L1 pushback, quiz → L4 live, direct answer, bypass alert, sandbox.

---

## 7. How to run the four agents (for the human)

### Kickoff
1. Commit and push this state to `main`.
2. Each agent gets its own branch, either on one machine (`scripts/setup-worktrees.sh` creates `../Friction-<agent>` worktrees and copies `.env`) or on separate machines (`git checkout -b agent/<name>`).
3. Everyone: `corepack enable` (or `npm i -g pnpm@9`), then `pnpm install`, then `cp .env.example .env` and fill in `ANTHROPIC_API_KEY` (needed by A and B).
4. Open Claude Code in that folder and send: **"Read docs/agents/<X>.md and execute it. Start now."**
5. Open a **fifth** Claude Code session in the main checkout for **Agent E**: **"Read docs/agents/E-integrator.md. You are the integrator. Wait for checkpoints; meanwhile run hourly preview merges."**

### Between checkpoints
- Agents commit small and often to `agent/<name>`, and may push **their own branch only**. Never push to `main`.
- Each agent keeps `docs/status/<X>.md` current: progress against exit criteria, change requests, blockers.

### At each checkpoint
1. **Builders (A–D):** tests and typecheck green → status file updated → commit → **push `agent/<name>`** → say "CPn pushed". Then they continue with the next checkpoint's tasks.
2. **Human:** once all four have pushed (or the time box is up), tell Agent E: **"CPn: all agents pushed."**
3. **Agent E** follows its procedure ([docs/agents/E-integrator.md](docs/agents/E-integrator.md) §2):
   - checks each branch only touched its own paths;
   - merges **B → A → C → D**; lockfile conflicts are fixed with `git checkout --theirs pnpm-lock.yaml && pnpm install`; anything else blocks that branch;
   - runs typecheck, tests, the real-API smoke test (3× from CP3) and both builds;
   - applies additive contract changes (+ mock, changelog, version bump);
   - pushes `main` and writes `docs/checkpoints/CPn.md` with a message for each agent.
4. **Human:** passes E's message to each agent (or E sends them directly, if the sessions run on the same machine), and does the live Chrome test with `apps/extension/dist`.
5. **Builders:** merge `main` into their branch, read the changelog, confirm in their status file, continue.

A branch that breaks the merge or the smoke test is **skipped, not fixed by E**. The owner gets the exact error and resubmits.

### Demo hygiene
Run `POST /demo/reset` (or the dashboard's Reset button) before going on stage. Keep `DEMO_MODE=1`. Don't reload claude.ai mid-demo. Run step 4 in a new chat. Keep the sandbox tab open behind claude.ai, a phone hotspot as backup Wi-Fi, and the backup recording on the desktop.

---

## 8. Risks still open (and what we do about them)

| Risk | Mitigation |
|---|---|
| claude.ai rejects or changes the rewritten request | Spike in D's first hours; text-box fallback; sandbox demo; recorded fixtures show what changed |
| AI reveals or ignores the hidden instructions | B's harness gates every level; the demo uses only tested prompts; pitch it as a nudge, not a lock |
| Grade latency over budget | Effort `low`; late grade still applies; B reports p50 at CP1. The human decides whether to move grading to `MODEL_CLASSIFY` (Haiku) |
| "Why not Claude/ChatGPT learning modes?" | Pitch: educator-defined curriculum, works across apps, tracked mastery that can regress, educator visibility |
| Students bypass the extension | Pitch: managed-Chromebook force-install; Phase 2 desktop sandbox; heartbeat "Friction off" indicator |
