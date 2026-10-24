# Friction — Build Plan v5 (simplified MVP)

Read with [PRD.md](PRD.md) (what & why), [design.md](design.md) (look), [docs/contracts.md](docs/contracts.md) (API behavior), [docs/ui-layouts.md](docs/ui-layouts.md) (screens). Your personal brief: [docs/agents/](docs/agents/).

**v5 changes (simplification):**
- The **sandbox chat page is the main demo surface**. We control it fully, so it can't break when claude.ai changes.
- The **claude.ai extension is a bonus**. It works on the message box (no network reverse-engineering), so a human only needs to load it once.
- **3 checkpoints instead of 4.**
- A short **must-have list**. Everything else is optional and gets cut first.
- The API contract is **unchanged** (v1), so all existing work still fits.

---

## 1. The MVP

A student asks an AI for help. Friction finds which concept the question is about and checks the student's level for it. Then it quietly adds instructions:

| Level | Mode | Instruction to the AI |
|---|---|---|
| L1 | Socratic | Don't answer; make the student explain |
| L2 | Scaffold | Outline only |
| L3 | Find the bug | Full answer with one deliberate bug, which the AI says is there |
| L4 | Normal | Help fully |

The AI ends its reply with a short check question. The student's next message is graded. A correct answer moves them up, and the educator's skill tree updates live.

### Must-have (the demo; nothing else matters until these work)
1. **Skill tree** for the seed course renders in pillars, with locked/active/mastered colors and `level/required` badges.
2. **Upload syllabus → tree** (the demo PDF/text returns the cached tree in ~3s).
3. **Sandbox chat:** asking the useEffect question at L1 gets Socratic pushback ending in a question.
4. **Answer correctly →** the node turns green **live** on the student/educator view (L4).
5. **Same question in a new chat →** a full answer, no friction.
6. **Bypass button →** quota drops, and the educator sees a toast.

### Nice-to-have, in order (cut from the bottom)
claude.ai extension · educator editing (drag/connect/inspector) · class panel and heatmap · activity feed · animations · L3 harness tuning · parallax.

### Cut entirely
ChatGPT support · heartbeat · streaming reply capture on claude.ai · Supabase · auth · desktop app (pitch only).

---

## 2. Demo script (3 min)
1. Educator page: upload the syllabus, and the tree appears.
2. Split screen with the **sandbox chat** on the left and the **student tree** on the right. Ask the useEffect question: Claude pushes back Socratically and ends with a check question.
3. Answer it, and the useEffect node turns green live.
4. **New chat**, same question: full code answer.
5. Click **Use bypass**, and the educator toast appears.
6. *(Bonus, if the extension is GO)* Show the same L1 pushback on real claude.ai with the extension on.

Fallback if anything breaks: the backup recording.

---

## 3. Architecture

```
 Sandbox chat (dashboard /sandbox) ─┐                  ┌─► packages/intelligence (B) ─► Claude API
 Extension on claude.ai (D) ────────┼──► apps/api (A) ─┤
 Educator / student views (C) ◄─SSE─┘    :8787         └─► data/db.json (local, seeded)
                                     everything typed by packages/shared (frozen contract)
```
- **API (A):** Hono on 8787, a JSON-file store, live updates over Server-Sent Events.
- **Intelligence (B):** pure functions behind one interface: parse, classify, prompt templates, grade, chat.
- **Dashboard (C):** Vite + React on 5173: educator, student and sandbox pages.
- **Extension (D):** a content script on claude.ai that rewrites the message box on send.
- **Mock API** (`pnpm dev:mock`, 8788) serves the full contract with fake AI, so nobody waits on anybody.

Models (from `.env`): Opus 5.5 for parse, grade and chat; Haiku 5.5 for the fallback classifier.

---

## 4. Ownership (who touches what)

| Path | Owner |
|---|---|
| `apps/api/**` | **A Platform** |
| `packages/intelligence/**` | **B Intelligence** |
| `apps/dashboard/**` | **C Dashboard** |
| `apps/extension/**` | **D Extension** |
| `packages/shared/**`, `scripts/**`, `fixtures/**`, `docs/**`, root config, `main` | **E Integrator** (builders read-only) |
| `docs/status/<X>.md` | each builder, its own file only |

Each builder works on `agent/<platform|intelligence|dashboard|extension>`. E owns `main`. Owned paths never overlap, so merges only ever conflict in `pnpm-lock.yaml`.

---

## 5. Checkpoints (hours from agent kickoff)

| Gate | A Platform | B Intelligence | C Dashboard | D Extension |
|---|---|---|---|---|
| **CP1 · T+3h** Runs on fakes | Every endpoint on 8787 with fakes + JSON store + SSE; `pnpm smoke` passes vs 8787 | Templates (4 levels), keyword classifier, real grader, unit tests; grade latency measured | Tree view (must-have 1) + live updates + **sandbox chat** working against the mock | Message-box injection working on claude.ai against the mock (one human try) → **GO / NO-GO** |
| **CP2 · T+9h** Full demo, real Claude | `USE_REAL_INTELLIGENCE=1`; parse (live + demo cache); `/chat` streaming | Real parse, LLM classify fallback, `chat()`; harness passes L1, L2, L4 | Upload → tree, bypass button + toast, student page, then educator editing if time | Popup (level, bypass), badge, hide injected text; works against the real API |
| **CP3 · T+16h** Polish + freeze | Error polish, per-student lock, late-grade test | L3 ≥ 4/5; final prompts frozen | Animations, class panel, activity feed | Robustness, new-chat and multi-tab handling |

**Gate checks (E runs them on merged `main`):**
- **CP1:** typecheck, tests, smoke vs 8787 with fakes.
- **CP2:** smoke with real Claude **3× in a row**, plus all six must-haves by hand in the browser.
- **CP3:** two rehearsals and a backup recording. **No contract changes after CP3.**

**Rule:** nobody works on nice-to-haves while a must-have is red.

---

## 6. How to run it

### Kickoff (once)
1. Every machine: Node ≥ 22.9, `npm i -g pnpm@9`, `pnpm install`, copy `.env.example` to `.env` and add `ANTHROPIC_API_KEY`.
2. Each builder on its own branch: `git checkout -b agent/<name>`. For several agents on one machine: `pnpm setup:worktrees <names…>`.
3. Start five Claude Code sessions:
   - **A, B, C, D:** "Read docs/agents/<X>.md and execute it."
   - **E:** "Read docs/agents/E-integrator.md. You are the integrator."
   - Suggested models: D and B on Opus 5.5; A, C and E on Sonnet 5.5.

### At each checkpoint
1. **Builders:** tests green → status file updated → commit → **push your branch** → "CPn pushed" → keep working.
2. **Human → E:** "CPn: all agents pushed."
3. **E:** merges B → A → C → D (on a lockfile conflict: `git checkout --theirs pnpm-lock.yaml && pnpm install`), runs the gate checks, pushes `main`, and writes `docs/checkpoints/CPn.md` with a message for each agent. A branch that breaks a check is **skipped and sent back**, not fixed by E.
4. **Builders:** merge `main` into their branch, read `docs/contracts-CHANGELOG.md`, continue.

### Human tasks (the whole list)
- Add `ANTHROPIC_API_KEY` to `.env`.
- At CP1: load the extension once (`chrome://extensions` → Load unpacked → `apps/extension/dist`) and ask claude.ai the useEffect question.
- Relay the "CPn pushed" and "CPn merged" messages.
- After CP3: rehearse, record the backup video, write the pitch.

### Demo hygiene
Reset first (dashboard **Reset demo** button, or `POST /demo/reset`). Keep `DEMO_MODE=1`. Run step 4 in a **new chat**.

---

## 7. Commands (identical on Windows, macOS, Linux)
```
pnpm dev:mock        mock API :8788          pnpm dev:api        real API :8787
pnpm dev:mock:ext    D's private mock :8789  pnpm dev:dash       dashboard → real API
pnpm dev:dash:mock   dashboard → mock        pnpm build:ext      extension → apps/extension/dist
pnpm smoke           demo flow vs :8787      pnpm smoke:mock     demo flow vs :8788
pnpm typecheck       pnpm test               pnpm harness        (B: prompt checks on real Claude)
```
