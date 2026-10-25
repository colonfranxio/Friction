# Public API handoff for Render

Implemented by E acting as A. Local behavior is unchanged unless `PUBLIC_DEMO=1`. Public guest mode exposes only `/health`, `POST /guest`, and bearer-scoped `/g/<token>/*` routes. A health response does not certify the full hosted product.

## Render setup

Use root `render.yaml` as the configuration reference (or import it as a Blueprint). It selects one Starter instance and a **separately billed 1 GB persistent disk** at `/var/data`; verify current pricing in Render. Do not scale beyond one instance with this file ledger.

- Build: `pnpm install --frozen-lockfile`; start: `pnpm --filter @friction/api start`; health: `/health`; Node 24.
- Set `PUBLIC_DEMO=1`, `DEMO_MODE=0`, `USE_REAL_INTELLIGENCE=1`.
- Set `PUBLIC_LEDGER_PATH=/var/data/public-usage.json` and `DATABASE_PATH=/var/data/local-db.json`. Mount the disk before startup. The service refuses public startup without a ledger path and an allowed origin. The path must actually be on persistent storage; the API cannot detect a provider's ephemeral filesystem.
- Set `ALLOWED_ORIGINS` to the exact Vercel HTTPS origin (comma-separated if more than one, no trailing slash). No wildcard preview origins.
- Enter provider key and `MODEL_*` values through Render's secret environment settings.
- Leave `API_PORT` unset: Render's `PORT` is now honored. Explicit `API_PORT` still overrides it locally.
- Initial deployment uses `USE_MOSS_RETRIEVAL=0` to establish baseline memory/startup on 512 MB. This does not verify the sponsor integration. After baseline acceptance, configure Moss credentials, set it to `1`, redeploy and measure native index readiness, retrieval, memory and shutdown before claiming hosted Moss support. Each guest has its own runtime/store; never share retrieval against a different guest's store.
- Auto-deploy is disabled in the blueprint. Deploy reviewed main manually. Roll back/stop the service if limits or guest separation fail. Do not switch PUBLIC_DEMO off on the public service: that would expose the local API routes.

## Guest interface for C/D (next work)

1. Browser `POST <API origin>/guest` without a body. A successful 201 returns `{api_path, student_id, tree_id, expires_at}`. Handle 429 with an occupied/allowance message; do not loop automatic session creation.
2. Combine the configured HTTPS API origin with `api_path`, then use that as the existing `createFrictionClient` base URL. Example shape: `https://<host>/g/<64 hex characters>`. All current student/tree/events/intercept/bypass endpoints live beneath it. Different guests deliberately reuse seed entity IDs inside completely separate stores; **the token boundary provides isolation**, not those IDs.
3. Keep the guest URL secret and session-scoped. Do not put it in a public dashboard URL, analytics, screenshots or application logs. Provider access logs may contain request paths; configure access-log retention accordingly. Tokens expire after 30 minutes and all tokens are lost on process restart. No account recovery or persistent student history is promised in the public judge demo.
4. Dashboard and extension must use the **same guest URL/student**; otherwise they intentionally see different data. C owns guest creation/error/expiry and session entry UI. D owns importing the same guest settings, chosen HTTPS manifest permissions and side-panel URL support. Coordinate the handoff instead of creating separate guests in each client.
5. Full reset and server `/chat` are disabled publicly. Use the extension with claude.ai; guest syllabus uploads and progress stay private to that guest. A new guest is a fresh store. Local teacher/student behavior remains available without public mode.

## Enforced limits

| Limit | Value |
|---|---|
| Resident guest slots | 2 |
| Guest lifetime | 30 minutes; periodic expired-store/runtime cleanup |
| New sessions | 20 per UTC day, persisted |
| Requests | 150 per guest, including SSE reconnects |
| Concurrent HTTP responses | 4 per guest; stream slots released on EOF/cancel/90-second cutoff |
| Request body | 64 KiB; metadata writes 4 KiB |
| Tree nodes | 32 from parsing or manual insertion; parsed pillars max 8 |
| Intelligence operations | 20 per guest; 60 per UTC day globally, persisted before invocation |
| Concurrent intelligence operations | 1 across all guests |

Operation reservations include failed work and keyword/cache hits; they are intentionally conservative. They wrap parse, classify and grade. Public sandbox chat cannot trigger paid work. These are **operation-count limits, not a dollar-denominated spending cap**: the SDK can retry (currently up to two provider attempts for some operations), and token costs depend on model settings and input/output sizes. Parsing currently permits up to 32,000 output tokens per operation. Choose model/account budgets with that worst case in mind; the $7 Render price excludes model usage, disk and any other provider fees. Do not remove/reset the persistent ledger to work around an exhausted allowance. UTC day rollover starts a new daily allowance. Session data itself is intentionally ephemeral; only usage reservations persist across deploys.

## Acceptance

Local regression evidence covers unauthenticated route denial, two-guest data separation, disabled shared reset/chat, expiry, session/request/body caps, model-operation reservations before invocation, manual node/metadata bounds, ledger restart persistence and Render port handling. Real provider calls, Render disk/restart behavior, memory under load and hosted C/D flows require separate acceptance. Full model harness, smoke and human rehearsal gates remain open.

Integration checks: workspace typecheck and all 351 tests passed; both stream verification scripts passed. After final encoded-tree-ID and concurrency hardening, API typecheck and all 8 public-boundary tests passed again. Independent read-only review found no remaining blockers. A separate real-HTTP entrypoint smoke used fake intelligence on private port 8795 and a temporary store; no paid-provider or hosted behavior was tested. Render YAML was parsed and checked locally, not submitted to Render.

Deploy the backend for private configuration testing after attaching the disk and setting the exact origin. It is not a finished judge Try it link until C/D connect it and a clean Chrome profile on a second computer completes the walkthrough.
