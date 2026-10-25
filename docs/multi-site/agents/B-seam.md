# Agent B: Seam, generic layer, hand-off (multi-site)

You are **Agent B**. You freeze the contract every other agent codes against (CP0), keep the site-agnostic layer correct on three sites (CP1), and merge and hand off to E (CP2).

## 0. Read first
1. `docs/multi-site/PLAN.md`, all of it. §2 is the contract you are building and §3 says what you own.
2. `apps/extension/src/site/claude.ts`, `src/content.ts`, `src/lib/send-interceptor.ts` (`SiteOps`), `src/background.ts:55-70`, `src/lib/messages.ts`.

## 1. Ownership
Everything under `apps/extension/**` **except**:
- A's files: `test/site.contract.test.ts`, `test/helpers/site-harness.ts`, `test/fixtures/sites/claude.html`, `LIVE-CHECK.md`;
- the **bodies** of `src/site/chatgpt.ts` (D) and `src/site/gemini.ts` (C), and their tests, fixtures and NOTES.

You also own `packages/shared/src/types.ts` (CP0 only), `docs/multi-site/**` and `docs/status/B-intelligence.md`, on branch `feature/multi-site`.

## 2. Work

### B1. CP0: contract (T+0 to T+0:45). Nobody else can start coding until this is pushed
- [ ] Write the failing test `test/site.registry.test.ts`:
  - `siteFor('claude.ai')?.id === 'claude'`
  - `siteFor('evil.com')` and `siteFor('notclaude.ai')` are `null`
  - `siteFor('chatgpt.com')` and `siteFor('gemini.google.com')` are `null` (the stubs are disabled)
  - every `ADAPTERS` entry has non-empty `hosts` and a correct `app_source`
- [ ] `site/types.ts`, `site/dom.ts` (`makeAdapter`, moving claude.ts's helpers **as is**) and `site/index.ts`, per PLAN §2.1–2.3.
- [ ] `claude.ts`: `export const claude = makeAdapter({...})` with today's selectors and regex. **Keep its named exports** (`findComposer`, `conversationIdFromPath`, …) as thin re-exports, so the existing tests and A's harness don't change.
- [ ] Stubs `chatgpt.ts` and `gemini.ts`: id, app_source and hosts from PLAN §2.3, empty selectors, plus a header comment: `// OWNER: Agent D|C. Fill in the makeAdapter spec; do not edit other files.`
- [ ] `content.ts`: `const site = siteFor(location.hostname); if (!site) return;` before anything is installed (no badge, no listeners), and send `app_source: site.app_source` with the intercept.
- [ ] `messages.ts` and `background.ts` (forward `m.app_source`), `shared/types.ts` (`'gemini_web'`), `manifest.json` hosts and `0.4.0`, and the copy changes (`popup.ts:113`, `bypass-flow.ts:85`, comments that say claude.ai).
- [ ] Gates: workspace `pnpm typecheck`, extension tests (104 existing + registry), `pnpm build:ext`, claude.ai smoke by hand. Checker → commit → push `feature/multi-site` → "CP0 pushed".

### B2. CP1: generic hardening (T+0:45 to T+3h)
On new sites, the shared code must hold under conditions claude.ai never showed. Add a regression test for each one in the existing test files, using a fake page like `test/send-interceptor.test.ts:21`.
- [ ] **Composer node replaced** between sends (SPA navigation): the interceptor and `sendUnmodified` find the new node, and nothing holds the old one.
- [ ] **The site's chat path differs from `/chat/<uuid>`:** the conversation tracker's first-turn aliasing works with any `idFromPath`. Test with a `/c/<uuid>` and an `/app/<hex>` parser.
- [ ] **Popup / side panel on an unsupported tab:** the Bypass button says "Open a supported AI chat (Claude, ChatGPT, Gemini)" instead of failing silently.
- [ ] **hide-injected:** confirm it strips `⟦friction⟧` blocks from any element (no claude-only selectors). Add a test with ChatGPT-style and Gemini-style message wrappers.
- [ ] Read A's, C's and D's status files for **Change request → B** items and fix them here. Tell the requester when a fix is pushed.
- [ ] Checker → push → "CP1 pushed".

### B3. CP2: merge and hand off (T+3h to T+5h)
- [ ] Merge `origin/ms/chatgpt`, `origin/ms/gemini` and `origin/ms/contract`, in that order. By construction they don't touch your files; any conflict means someone broke ownership, so send it back instead of resolving it.
- [ ] Workspace typecheck, all tests and `pnpm build:ext`. The contract suite must be green for every adapter that isn't a stub.
- [ ] After the human's live check (`LIVE-CHECK.md`), turn any site that failed back into a stub: empty its `selectors`, with a one-line note in its file.
- [ ] Checker. Update `docs/status/B-intelligence.md` with **MULTI-SITE READY**: SHA, the sites that passed live, the contract change (`AppSource += 'gemini_web'`, the `app_source` field on the runtime message) and the remaining human checks. Push and tell E.

## 3. Verify
`pnpm --filter @friction/extension test`, then `pnpm build:ext`, then load `apps/extension/dist` and ask claude.ai the useEffect question. The claude.ai behavior must be identical to `bc4997e`.
