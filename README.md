# Friction (CalHacks 13.0, Team We'll Figure It Out)

An extension plus dashboard that makes AI tools teach instead of tell. It adjusts how much help claude.ai gives based on each student's mastery of an educator-defined skill tree.

- **Product:** [PRD.md](PRD.md) · **Design:** [design.md](design.md)
- **Build plan and ownership:** [PLAN.md](PLAN.md)
- **Contracts:** [docs/contracts.md](docs/contracts.md) · **Screens:** [docs/ui-layouts.md](docs/ui-layouts.md)
- **Agent prompts:** [docs/agents/](docs/agents/)

## Quickstart
```bash
npm i -g pnpm@9          # or: corepack enable (macOS/Linux)
pnpm install
cp .env.example .env     # Windows: copy .env.example .env   (then add ANTHROPIC_API_KEY)
pnpm dev:mock            # mock API on :8788 (full contract, fake AI)
pnpm smoke:mock          # in a second terminal
```

Works on **Windows, macOS and Linux** (Node ≥ 22.9). All commands are `pnpm` scripts, with no shell-specific syntax. See the Windows notes in [AGENTS.md](AGENTS.md).

## Students: download and run the Chrome extension

You need desktop Google Chrome and a Claude account. This build supports **claude.ai**. Your teacher/demo organizer must provide your Student ID and a running Friction backend with your course loaded. The extension alone does not run the backend. The current build permits local backend addresses only; hosted classroom access still needs deployment configuration.

### Download

If your organizer gives you a built extension ZIP, download and extract it (Windows: right-click → **Extract All**). Find the extracted folder containing `manifest.json`, `content.js` and `background.js`.

Otherwise, download the source from [GitHub](https://github.com/colonfranxio/Friction) using **Code → Download ZIP**, extract it, and open a terminal in the extracted repository folder containing `package.json`. Install Node ≥ 22.9 and pnpm 9, then build:

```text
npm install -g pnpm@9
pnpm install --frozen-lockfile
pnpm build:ext
```

The extension folder is now `apps/extension/dist`. Windows ARM/Snapdragon users should follow the [x64 Node instructions below](#windows-arm64-for-example-snapdragon-laptops) before installing dependencies. There is no Chrome Web Store installation in this setup.

### Load and connect

1. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
2. Click **Load unpacked** and select the folder containing the built `manifest.json`: `apps/extension/dist` for a source build. Select the extracted folder for a prebuilt ZIP, not the ZIP itself.
3. Click Chrome's puzzle-piece icon and pin **Friction**, then open it and expand **Settings**.
4. Enter the **Student ID** supplied by your organizer. For a local demo, set **API URL** to `http://127.0.0.1:8787` and **Dashboard URL** to `http://127.0.0.1:5173`. These point to servers on your own computer, not your teacher's computer. Use an **API READY SHA** only if your organizer supplies an approved value; it controls supported bypass behavior. Click **Save** and check **Friction enabled**.
5. Open or refresh [claude.ai](https://claude.ai), sign in, and ask about a concept from your assigned course. Check the Friction badge for a concept/level. **Open learning map** in the extension shows your progress. Turning Friction off stops its API requests.

### Start the local services, if you are running the demo yourself

Use the repository folder and your existing `.env` from the organizer (real intelligence needs the API key and model settings from `.env.example`; never share those secrets). Keep these running in two separate terminals:

```text
pnpm dev:api
```

```text
pnpm dev:dash
```

Both must use the same backend configuration. If someone else manages the services on your demo computer, ask them to start them instead.

### If it says “Friction offline”

Open `http://127.0.0.1:8787/health` in your browser. If it does not respond, start the API or ask your organizer for help. Check the extension's API URL, leave the server terminal open, and refresh Claude. Offline requests pass through to Claude without tutoring. An online prompt outside the loaded course may also receive no friction.

After an update, rebuild with `pnpm build:ext` (or extract the new built ZIP), click **Reload** on Friction at `chrome://extensions`, and refresh every open Claude tab. Keep the loaded extension folder in place. A detailed demo walkthrough will follow once the final UI is accepted.

| Path | What | Owner |
|---|---|---|
| `packages/shared` | Frozen contract: types, API, rules, client, seed, fakes | Lead |
| `packages/intelligence` | Claude-powered parse / classify / prompts / grading | Agent B |
| `apps/api` | Hono API :8787, JSON store, SSE | Agent A |
| `apps/dashboard` | Vite + React dashboard :5173 | Agent C |
| `apps/extension` | Chrome MV3 extension for claude.ai | Agent D |

## Optional: Moss curriculum retrieval (sponsor integration)

The API can optionally use [Moss](https://docs.moss.dev) to connect a student's everyday wording to the concepts in their course. When a prompt matches **no keywords**, Moss suggests up to 3 course concepts to the existing Claude classifier. Claude makes the final choice from the full concept list, and can choose none. The backend still sets the assistance level, and only quiz grading changes mastery.

- **On by default** whenever the API runs with real intelligence (`USE_REAL_INTELLIGENCE=1`) and `MOSS_PROJECT_ID`/`MOSS_PROJECT_KEY` are set. Without credentials, or in fake mode, the API runs without Moss. To turn it off, set `USE_MOSS_RETRIEVAL=0` and restart.
- **Behavior:** the API serves immediately and indexes up to two active courses in the background (about 0.5–2s each). Edits are detected within about 1s, and stale queries fall back immediately. Cold, stale, failed or slow (>200ms) retrieval uses the existing classifier. Keyword matches and pending quiz answers never call Moss.
- **Indexed data:** concept name, mastery criteria and keywords are sent to Moss. No student histories, transcripts, grades or prompts are indexed (prompts are used only as search queries). If you have Moss credentials in `.env` but don't want this, set `USE_MOSS_RETRIEVAL=0`.
- **Logs:** `[moss] {"state":"ready"|"retrieved"|"fallback",...}` with candidate node IDs and timings. No prompts, student IDs or credentials.
- **Live evidence (paid; private port, in-memory store):** `pnpm --filter @friction/api moss:live` → `apps/api/harness/results/<timestamp>-<sha>/moss-live.json`.
- **Limits:** no accuracy gain shown on the 8-skill seed course ([docs/moss-live-results.md](docs/moss-live-results.md)). A permanently hung native call pauses Moss preparation (the API keeps serving). See [docs/moss-implementation-handoff.md](docs/moss-implementation-handoff.md) and [docs/checkpoints/MOSS-integration.md](docs/checkpoints/MOSS-integration.md).

### Windows ARM64 (for example, Snapdragon laptops)

The pinned Moss native core ships a Windows **x64** binary, with no Windows ARM64 binary. Under ARM64 Node, it can fail with `Cannot find native binding` and repeated `[moss]` fallback/unavailable logs. The API continues serving through its existing classifier, without Moss retrieval.

Use portable **Windows x64 Node of the same version**, running under Windows emulation. Stop the existing Friction servers, extract x64 Node, then run this in PowerShell from the repository root, replacing the example directory with your extracted path:

```powershell
$env:Path = "C:\path\to\node-v24.19.0-win-x64;$env:Path"
node -p process.arch   # must print x64
pnpm install --frozen-lockfile
```

Use that x64 Node environment for **every** Friction command, including builds, the API and dashboard. Repeat the PATH step and architecture check in each new terminal. After reinstalling native dependencies for x64, do not run those builds or servers under ARM64 Node; switching architecture requires reinstalling the matching dependencies. No lockfile edit is needed: it already includes `@moss-js/moss-core-win32-x64-msvc`.
