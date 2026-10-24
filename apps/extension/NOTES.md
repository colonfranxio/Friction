# claude.ai integration notes (Agent D)

Status as of 2026-10-24: **shapes below are best-known, NOT yet confirmed by a live capture.**
Everything site-specific lives in `src/adapters/claude.ts`; update it and `test/fixtures/claude/` together.

| Thing | Current assumption | Confirmed? |
|---|---|---|
| Send endpoint | `POST https://claude.ai/api/organizations/{org}/chat_conversations/{uuid}/completion` | ❌ |
| Conversation id | the `{uuid}` in that URL (exists even for a brand-new chat) | ❌ |
| Prompt field | JSON body `prompt` (string) | ❌ |
| Stream format | SSE; text in `content_block_delta.delta.text` (or legacy `completion`) | ❌ (parser accepts both) |
| Assistant message selector | `[data-testid="assistant-message"]`, `.font-claude-response`, `.font-claude-message`, `[data-is-streaming]` | ❌ |
| User message selector | `[data-testid="user-message"]`, `.font-user-message` | ❌ |
| Request rewrite accepted by server | unknown: this is the CP1 go/no-go | ❌ |

## How to capture (human, ~2 minutes, logged-in Chrome)

1. Open https://claude.ai, open DevTools (F12) → **Console**, paste and press Enter:

```js
(() => {
  const orig = window.fetch; window.__cap = [];
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init && init.method) || (typeof input === 'object' && input.method) || 'GET';
    const body = init && typeof init.body === 'string' ? init.body : null;
    const res = await orig(input, init);
    if (method === 'POST' && /completion/.test(url)) {
      res.clone().text().then((t) => {
        window.__cap.push({ url, method, body: body ? JSON.parse(body) : null, response: t });
        console.log('[friction capture] captured', window.__cap.length);
      });
    }
    return res;
  };
  console.log('Capture on. Send "say hi in 3 words", then a follow-up in the same chat, then run: copy(JSON.stringify(window.__cap, null, 2))');
})();
```

2. Send **"say hi in 3 words"**, wait for the reply, then send a **follow-up in the same chat**.
3. Run `copy(JSON.stringify(window.__cap, null, 2))` and paste the result to Agent D (or into a file).
   If nothing was captured, claude.ai grabbed `fetch` before the console ran. Instead use **Network** tab →
   filter `completion` → right-click the request → *Copy as fetch* + copy the **Response** text.
4. Selector check (same console):

```js
['[data-testid="assistant-message"]','.font-claude-response','.font-claude-message','[data-is-streaming]','[data-testid="user-message"]','.font-user-message']
  .map((s) => [s, document.querySelectorAll(s).length])
```

Agent D sanitizes (fake UUIDs, no personal text) before committing.

## Load the extension (human)
`pnpm --filter @friction/extension build` → chrome://extensions → Developer mode → **Load unpacked** → `apps/extension/dist`
(Windows: `apps\extension\dist`). After each rebuild, click the reload icon on the Friction card **and** reload the claude.ai tab.
For the mock: run `pnpm dev:mock:ext` and set the popup's API URL to `http://127.0.0.1:8789`.
