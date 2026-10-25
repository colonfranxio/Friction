# Agent A: Cross-site contract suite + live check (multi-site)

You are **Agent A**. You don't write site code. You prove that every adapter works with the **real** send interceptor, conversation tracker and Bypass flow, and you run the final live check with the human. A failure you find goes to the adapter's owner, not into your own fix.

## 0. Read first
1. `docs/multi-site/PLAN.md` §2.4 (the fixture format you consume) and §3 (ownership).
2. `apps/extension/test/bypass-flow.test.ts:24-86` (the fake page + real interceptor + tracker + flow harness you'll generalize) and `test/send-interceptor.test.ts:21-56`.

## 1. Ownership
**Only:**
- `apps/extension/test/site.contract.test.ts`;
- `test/helpers/site-harness.ts`;
- `test/fixtures/sites/claude.html`;
- `apps/extension/LIVE-CHECK.md`;
- `docs/status/A-platform.md`.

Branch `ms/contract` from `origin/feature/multi-site` after CP0. You may **read** other branches (`git merge origin/ms/chatgpt` locally to run the suite), but push only your own files. Bugs go to the owner as a **Change request** in your status file: B for shared code, D for ChatGPT, C for Gemini.

## 2. Work

### A1. CP0: harness on claude (T+0 to T+0:45; works before the seam lands)
- [ ] `test/fixtures/sites/claude.html` per PLAN §2.4 (start from `bypass-flow.test.ts:33`), with `data-new-chat-path="/new"` and `data-chat-path="/chat/11111111-aaaa-4aaa-8aaa-000000000001"`.
- [ ] `test/helpers/site-harness.ts`: `loadSite(adapter: SiteOps & { conversationIdFromPath }, fixtureId: string)`. It:
  - loads the fixture into `document`;
  - makes clicking Send or pressing Enter (no Shift) record `norm(composerText)` into `sent: string[]` and clear the composer;
  - wires the real `installSendInterceptor`, `createConversationTracker` (using `data-*` paths) and `createBypassFlow`, the way `bypass-flow.test.ts` does;
  - returns `{ composer(), sendButton(), sent, flow, tracker, go(path), answerBypass(), intercept: vi.fn }`.

  Before CP0, type the adapter parameter structurally and pass `import * as site from '../src/site/claude'`.

### A2. CP1: contract suite (T+0:45 to T+3h)
- [ ] `site.contract.test.ts`: `describe.each(ADAPTERS.filter((a) => a.selectors.composer.length))`, with each adapter loading `fixtures/sites/<id>.html`. A missing fixture is a **failure**, not a skip. Tests:
  1. `injects and sends once`: intercept returns an injected prompt containing `⟦friction⟧`; exactly one send, and it contains the marker.
  2. `passthrough sends the original text`.
  3. `fails open when intercept throws`: the original text is sent.
  4. `re-queries the composer after the node is replaced`: replace the composer element between two sends; both get intercepted.
  5. `waits for a send button that enables after the rewrite`: the fixture button starts `disabled` and `setTimeout(…, 10)` enables it; exactly one send.
  6. `first turn keeps the bypass target`: `go(newChatPath)`, send, then `go(chatPath)` both before and after `endSend(true)`; Bypass re-sends the prompt once.
  7. `bypass does not send into another chat`: switch the path while the bypass answer is held; nothing is sent.
  8. `lastAssistantText reads the check question`: it equals `Quick check: what does the dependency array tell React?`.
- [ ] Green on claude. Then, as `ms/chatgpt` and `ms/gemini` push, merge them **locally only**, run the suite and report the results to their owners. Don't push those merges.
- [ ] Checker → push `ms/contract` → "CP1 pushed".

### A3. CP2: live check (T+3h to T+5h)
- [ ] Write `LIVE-CHECK.md`. Per site (claude.ai as a regression, chatgpt.com, gemini.google.com), give exact clicks and expected results for PLAN §6 steps 1–8, plus a results table with one row per site, one pass/fail cell per step, and a notes column.
- [ ] Run it with the human after B's merge build. Fill in the table, and send each failure to its owner with the step, what you saw and the DevTools probe output.
- [ ] Push. Status file: the per-site results and which sites B should turn back into stubs.
