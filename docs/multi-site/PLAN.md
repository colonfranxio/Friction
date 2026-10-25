# Friction: Multi-site Extension Plan (ChatGPT + Gemini)

Read with `AGENTS.md` (rules still apply), `PLAN.md` v5 and `apps/extension/NOTES.md`. Your personal brief: [docs/multi-site/agents/](agents/).

**Goal:** within 6 hours, the extension does on **chatgpt.com** and **gemini.google.com** what it already does on claude.ai:
- intercept the send;
- rewrite the message by level;
- grade the next answer;
- Bypass;
- turn off with the consent toggle;
- show the side-panel map.

**Not in scope:** Perplexity, Copilot, other sites; reply capture over the network; any change to the dashboard, API behavior or prompts. The sandbox stays the main demo; this is still a bonus surface.

---

## 1. Why this parallelizes cleanly

Everything site-specific already lives in one file, `apps/extension/src/site/claude.ts`. The interceptor, conversation tracker, Bypass flow, badge, popup, side panel and API don't depend on the site.

So the work splits the same way the original build did:
1. **CP0, the contract.** B freezes the seam before anyone codes against it: the adapter interface, the registry (with **stub** ChatGPT and Gemini adapters already registered), manifest hosts, `app_source` wiring and the fixture format.
2. **Disjoint ownership.** Each agent then owns files nobody else touches. Shared files (`content.ts`, `index.ts`, `manifest.json`, shared types) are touched **only by B, and only at CP0**. Adding a site never edits a shared file again: it replaces the body of its own stub.
3. **Fixtures and fakes.** Adapters are developed against captured DOM fixtures in happy-dom. The contract suite runs every enabled adapter through the real interceptor and Bypass flow. A dev API (`pnpm dev:mock:ext`, :8789) serves the live checks, so nobody waits on anybody.

No new dependencies, so `pnpm-lock.yaml` never conflicts.

---

## 2. The contract (frozen at CP0; additive changes only, through B)

### 2.1 Adapter interface: `apps/extension/src/site/types.ts`
```ts
export interface SiteAdapter extends SiteOps {            // SiteOps: lib/send-interceptor.ts (unchanged)
  id: 'claude' | 'chatgpt' | 'gemini';
  app_source: AppSource;                                   // 'claude_web' | 'chatgpt_web' | 'gemini_web'
  hosts: string[];                                         // exact hostnames, no suffix match
  selectors: { composer: string[]; send: string[]; assistant: string[] };  // tried in order
  conversationIdFromPath(pathname: string): string | null; // null on a brand-new chat
  lastAssistantText(doc: Document): string | null;         // newest reply, null if it contains ⟦friction⟧
}
```

### 2.2 Building an adapter: `apps/extension/src/site/dom.ts`
```ts
makeAdapter(spec: {
  id, app_source, hosts, selectors, conversationIdFromPath,
  setComposerText?: SiteOps['setComposerText'],   // optional per-site override
}): SiteAdapter
```
It holds the current claude.ts helpers, moved and not rewritten:
- `first`;
- `getComposerText`;
- `setComposerText` (synthetic paste, then `insertText`, then a DOM write of one `<p>` per line plus an `input` event);
- `isInComposer` / `isOnSendButton`, which **re-query on every call** (never cache an element);
- `lastAssistantText` (the last match, last 4000 characters).

### 2.3 Registry: `apps/extension/src/site/index.ts`
- `ADAPTERS = [claude, chatgpt, gemini]`. All three are imported at CP0, so this file never changes again.
- `siteFor(hostname): SiteAdapter | null`. It returns null for unknown hosts **and for adapters whose `selectors.composer` is empty**, which is the stub state.
- At CP0, `chatgpt.ts` and `gemini.ts` are stubs: correct `id`, `app_source` and `hosts`, empty selectors, `conversationIdFromPath: () => null`. On those sites the extension does nothing until the owner fills the stub in.

### 2.4 Fixture format: `apps/extension/test/fixtures/sites/<id>.html`
- A trimmed copy of the real page with placeholder text only: no names, emails or real chats.
- Must contain:
  - the composer, holding one line of text;
  - the send button **with the `disabled` attribute**;
  - **two** assistant messages, the second one's text being `Quick check: what does the dependency array tell React?`.
- `<html data-new-chat-path="…" data-chat-path="…">` gives the URL path of a new chat and of the same chat after its first send (for example `/` and `/c/<uuid>`).
- The contract suite simulates the page's own send: clicking Send or pressing Enter records the composer text, then clears it. Fixtures need no script.

### 2.5 Wire changes (B, CP0)
- `RuntimeRequest` `friction:intercept` gains `app_source: AppSource`. `background.ts` forwards it instead of hard-coding `'claude_web'`.
- `packages/shared/src/types.ts`: `AppSource` gains `'gemini_web'` (additive, needs E's review). The API already passes `app_source` through untouched.
- `manifest.json`: add `https://chatgpt.com/*`, `https://chat.openai.com/*` and `https://gemini.google.com/*` to `host_permissions` and the content-script `matches`; set `version` to `0.4.0`.
- User-facing copy names no site: "your AI chat tab" instead of "claude.ai tab".

---

## 3. Ownership (non-negotiable during this plan)

| Agent | Role | You may edit | Branch |
|---|---|---|---|
| **A** | Contract suite + live check | `apps/extension/test/site.contract.test.ts`, `apps/extension/test/helpers/site-harness.ts`, `apps/extension/test/fixtures/sites/claude.html`, `apps/extension/LIVE-CHECK.md`, `docs/status/A-platform.md` | `ms/contract` |
| **B** | Seam, generic layer, hand-off to E | everything else under `apps/extension/**` (including `site/types.ts`, `dom.ts`, `index.ts`, `claude.ts`, `content.ts`, `background.ts`, `popup.*`, `lib/**`, `manifest.json`, `build.mjs`, existing tests); `packages/shared/src/types.ts` **(CP0 only)**; `docs/multi-site/**`; `docs/status/B-intelligence.md` | `feature/multi-site` |
| **C** | Gemini adapter | **only the body of** `apps/extension/src/site/gemini.ts`; `apps/extension/test/site.gemini.test.ts`; `apps/extension/test/fixtures/sites/gemini.html`; `apps/extension/NOTES-gemini.md`; `docs/status/C-dashboard.md` | `ms/gemini` |
| **D** | ChatGPT adapter | **only the body of** `apps/extension/src/site/chatgpt.ts`; `apps/extension/test/site.chatgpt.test.ts`; `apps/extension/test/fixtures/sites/chatgpt.html`; `apps/extension/NOTES-chatgpt.md`; `docs/status/D-extension.md` | `ms/chatgpt` |
| **E** | Integrator | merges onto `multi-site` (not `main`) | `multi-site` |

**Rules:**
- A, C and D branch from `feature/multi-site` **after CP0** and push only their own branch.
- Found a bug outside your files? Write it in your status file under **Change request → B** and keep going, as with the original contract. Don't fix it yourself.
- An adapter that needs different composer writing passes `setComposerText` to `makeAdapter` inside its own file. It never edits `dom.ts`.
- No `main` merge without the human's release instruction.
- Before every push: extension typecheck and tests green, `pnpm build:ext` green, and a **checker subagent** (Sonnet 5.5, medium effort) has reviewed the diff.
- Never commit `.env`, cookies, tokens or real page content.

---

## 4. Checkpoints (hours from kickoff)

| Gate | A: Contract | B: Seam | C: Gemini | D: ChatGPT |
|---|---|---|---|---|
| **CP0 · T+0:45** Contract ready | `claude.html` fixture + `site-harness.ts` written against `claude.ts`'s current exports (they keep working after the seam) | Seam per §2 pushed on `feature/multi-site`; all 104 existing tests + `site.registry.test.ts` green; claude.ai behavior unchanged | **Live reconnaissance** with the human on gemini.google.com (probe in brief); `gemini.html` fixture captured | **Live reconnaissance** on chatgpt.com; `chatgpt.html` fixture captured |
| **CP1 · T+3h** Adapters green on fixtures | `site.contract.test.ts` green for claude; pulls `ms/chatgpt` and `ms/gemini` and reports failures to their owners | Generic hardening (brief §B2) + regressions; reviews change requests | `gemini.ts` filled in; own tests + contract suite green on `gemini.html` | `chatgpt.ts` filled in; own tests + contract suite green on `chatgpt.html` |
| **CP2 · T+5h** Live on real sites | `LIVE-CHECK.md` written; runs it with the human and fills in the results table | Merges A, C, D into `feature/multi-site`; full gates; **MULTI-SITE READY** to E | Live fixes from the check (own file only) | Live fixes from the check (own file only) |

**Gate checks (B runs them on `feature/multi-site` before telling E; E re-runs them on `multi-site`):**
- **CP0:** workspace typecheck, all tests, `pnpm build:ext`; claude.ai smoke by hand (the useEffect question gets pushback).
- **CP1:** contract suite green for every adapter that is not a stub.
- **CP2:** the human's live check (§6) passes on claude.ai (regression), chatgpt.com and gemini.google.com.

A site that fails CP2 is **turned back into a stub** (B empties its selectors, so `siteFor` returns null) rather than shipped half-working. The other sites ship.

**T+5 to T+6:** buffer, plus E's integration and review.

---

## 5. How to run it

### Kickoff
1. B does CP0 alone. Meanwhile C and D do live reconnaissance with the human, and A writes the harness. Nobody waits.
2. Human → A, C, D: "CP0 pushed." They run `git fetch && git checkout -b ms/<name> origin/feature/multi-site`.
3. Each session: "Read `docs/multi-site/agents/<X>.md` and execute it."

### At each checkpoint
Same as the original plan:
1. Builders: tests green → status file updated → checker → commit → **push your branch** → "CPn pushed".
2. B merges in the order **D → C → A** (adapters before the suite that checks them), runs the gate checks and reports.

### Human tasks (the whole list)
- **T+0:** run the DevTools probe on chatgpt.com and gemini.google.com while logged in (a new chat and an existing chat) and paste the output to D and C.
- **CP0:** quick claude.ai regression with the rebuilt extension.
- **CP2:** run `LIVE-CHECK.md` on all three sites with A. Relay the "pushed" messages.

---

## 6. Live check (A writes the full script at CP2; summary)

Per site:
1. Load `apps/extension/dist` unpacked and reload it.
2. Start the dev API (`pnpm dev:mock:ext`; set the popup API URL to `http://127.0.0.1:8789`).
3. New chat, useEffect question → Socratic pushback ending in a question.
4. Answer it → the node turns green in the side panel.
5. New chat, same question → a full answer.
6. Bypass → the quota drops and the message is re-sent unmodified.
7. Consent off → messages pass through untouched.
8. On an unrelated site → no badge.
