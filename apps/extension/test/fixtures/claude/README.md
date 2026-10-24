# claude.ai traffic fixtures

⚠ **SYNTHETIC: not yet captured from the live site.** They match the best-known claude.ai shapes
(URL `POST /api/organizations/{org}/chat_conversations/{uuid}/completion`, body field `prompt`,
streamed SSE in either the legacy `completion` format or the Messages-style `content_block_delta` format).

Replace them with real, sanitized captures (see `../../../NOTES.md` → "How to capture"). Keep the same
file names so the tests pick them up. Sanitize: fake org/conversation UUIDs, no cookies/headers/personal text.
