# Judge submission release checklist

## Current state

The human has Vercel; Render signup remains to do. No public dashboard/API, GitHub release asset or video URL has been published by this work. GitHub release operations are blocked here by the workspace's invalid `GH_TOKEN`; git push works. Do not send account credentials in chat.

Prepared: [judge guide](JUDGE-GUIDE.md), [Devpost copy and video plan](DEVPOST-DRAFT.md), root `vercel.json` for dashboard build and SPA deep links, and a manual GitHub Actions packaging workflow. These are deployment inputs, not evidence that deployment has passed.

## 1. A — public API access and limits, before public deployment

Work on a separate API branch; E reviews/merges main. Coordinate shared types with E and guest settings with C/D. Keep local demo behavior intact.

- Specify and implement a guest session that owns its own student/course/progress. Enforce isolation server-side on every read, edit, event stream, intercept, chat, bypass and reset. A random student ID in a URL alone is not access control. Use fake/private stores for tests proving guest A cannot inspect/reset/modify guest B.
- Set enforceable limits on syllabus bytes, node count, per-session and global request/model-call counts, concurrent model work, SSE connections, session lifetime and storage growth. Reject over-budget work before calling the provider. Apply limits to all paid paths, including parse, grade, classify and chat. Budget alerts alone do not cap spend. Document the chosen limits and shutdown procedure.
- Allow the exact HTTPS Vercel origin in production CORS (including preview origins only if intentionally supported); preserve text stream headers and SSE. CORS is not authorization. Keep credentials server-side and logs free of raw student text/secrets.
- Honor the host's `PORT` or document mapping it to `API_PORT`; current code reads `API_PORT` only. Add an explicit persistent database path; current path is `apps/api/data/db.json`. Use one service instance with the JSON store unless persistence/concurrency is redesigned.
- Publish API HOST READY with commit, commands, limits, guest flow and tests. Do not simply expose the current globally writable demo routes.

## 2. Human + E — Render API settings (after step 1)

1. Create Render account and connect this repository. Choose a Node Web Service from main, repository root directory, one instance, Node 24 x64/Linux. Verify current plan memory, sleeping behavior, disk support and pricing in Render before selecting a plan; free persistent storage is not assumed.
2. Build command: `pnpm install --frozen-lockfile`. Start command: `pnpm --filter @friction/api start`. Set the host port via the finalized step-1 configuration. Set health check path to `/health`.
3. Add secrets through Render's environment settings: `ANTHROPIC_API_KEY`, chosen `MODEL_PARSE`, `MODEL_GRADE`, `MODEL_CHAT`, `MODEL_CLASSIFY`; optionally `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY`. Use `.env.example` for variable names, not as a file to publish. Set `USE_REAL_INTELLIGENCE=1`, `DEMO_MODE=0`, plus the step-1 origins, guest controls and persistent database path. Verify provider access to the selected models.
4. If using Moss, verify native SDK startup on the host, both index readiness and an actual retrieval. Test explicit opt-out too. Measure cold startup/memory and keep the API responsive during indexing. Report sleeping/cold-start limits honestly.
5. Record the resulting HTTPS API origin. Test health, guest isolation, capped spending paths, parse, interception, bypass, streaming, SSE and restart/persistence. No real student dataset belongs in the public demo.

## 3. C + human — Vercel dashboard

This can be configured in parallel with A; end-to-end acceptance waits for the API.

1. Import this GitHub repository into the existing Vercel account. Keep **Root Directory at repository root**, not `apps/dashboard`; root `vercel.json` supplies the build/output/SPA rewrite settings. Use Node 24 and pnpm 9.15.
2. Set `VITE_API_URL` to the verified HTTPS Render API origin. This variable is public build-time configuration; never put API keys in `VITE_*`. Set the approved `VITE_PROMPT_BYPASS_API_READY_SHA` only after E certifies that API revision. Redeploy after changing build-time values.
3. Wire guest session creation/assignment from A's agreed interface into the entry flow; no judge should paste a shared seed ID or use another visitor's tree. Coordinate the same session with D's extension setup without embedding secrets in download assets or public URLs.
4. Verify teacher upload, editable tree, student map, loading/error recovery and live mastery. Test a copied educator deep link in a new tab: the Vercel SPA rewrite should serve the app. Record the actual dashboard URL for the guide and Devpost.

## 4. D — hosted extension, after final origins and A's guest interface

Branch separately; coordinate with B before changing active feature files. Allow only the chosen HTTPS API/dashboard hosts in manifest permissions and URL validation. The current build permits loopback HTTP, and its side-panel URL validation must be updated for hosted HTTPS. Set sensible hosted defaults and a clear guest setup path matching C. Preserve local development, consent, hidden blocks, guarded bypass/retry and draft safety. No model keys or permanent guest tokens in the ZIP. Run extension tests/typecheck/build plus actual clean-profile Chrome acceptance against the hosted services.

## 5. E — package, publish and reconcile

- Merge in dependency order: **A's public API interface → C/D integrations → final hosted configuration**. C/D can prepare independently, but must use A's agreed guest interface and coordinate overlapping files with B. The video outline and Vercel project setup can proceed in parallel.
- Run the **Package judge extension** workflow on the final reviewed main. Download its artifact and extract the outer Actions ZIP; `friction-extension.zip` inside is the judge package. It includes an `extension` folder, instructions, syllabus and source revision. Actions artifacts are build outputs, not a convenient anonymous public release link.
- Publish that ZIP and checksum as assets on a GitHub release using an authorized GitHub session. Verify anonymous download. The local package prepared during this task remains a **localhost build**, not the future hosted release. Do not put temporary cloud-workspace artifact paths on Devpost.
- Replace all availability notes in README/judge guide/Devpost draft with actual tested links and instructions. Verify every link while signed out. Keep source revision and hosted API readiness evidence aligned.

## 6. Human + B/D/E — final evidence and submission

On the credentialed Windows machine, pull final main under x64 Node, preserve existing environment/data, run `pnpm harness` serially (fresh L1–L3 compliance and ignore-friction behavior are outstanding), run three real-Claude smoke passes and verify logged-in extension-first acceptance. B reports a successful human opt-out/Bypass check on claude.ai; that does not replace full harness or final hosted-build acceptance. Test a new judge from another computer: no local servers, personal API key or development tool installation should be needed for the hosted path.

Then complete two timed rehearsals, record/upload the video and backup, and fill official Devpost requirements. Attach a real demo URL, public release download, source link and walkthrough link. Never call the deployment ready based only on a green build or health response.
