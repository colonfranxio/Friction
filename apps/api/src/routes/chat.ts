import type { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { CHAT_HEADERS, type ChatMessage, type ChatRequest } from '@friction/shared';
import type { Ctx } from '../context';
import { HttpError, badRequest } from '../errors';
import { isNonEmptyString, readObject } from '../lib/http';
import { race } from '../lib/mutex';

/**
 * POST /chat (sandbox, the main demo surface): intercept the last user message, swap in the
 * injected prompt, stream Intelligence.chat() as text/plain, save the full reply as the log's
 * llm_response (that reply is the quiz text for grading the next turn).
 */
export function chatRoutes(app: Hono, ctx: Ctx) {
  const { store, intel, config } = ctx;

  app.post('/chat', async (c) => {
    const b = await readObject<ChatRequest>(c);
    const messages = Array.isArray(b.messages) ? (b.messages as ChatMessage[]) : [];
    // Like the mock: the last *user* message is the one that gets intercepted and replaced.
    const lastIdx = messages.map((m) => m?.role).lastIndexOf('user');
    const last = messages[lastIdx];
    if (!isNonEmptyString(b.student_id) || !last || typeof last.content !== 'string') {
      throw badRequest('student_id and at least one user message required');
    }

    const ic = await ctx.interceptService({
      student_id: b.student_id,
      raw_prompt: last.content,
      app_source: 'sandbox',
      conversation_id: b.conversation_id ?? null,
    });
    const injected = messages.map((m, i) => (i === lastIdx ? { ...m, content: ic.injected_prompt } : m));

    // Pull the first chunk before sending headers so a failing model becomes a clean 502/504.
    const abort = new AbortController();
    const it = intel.chat(injected, { signal: abort.signal })[Symbol.asyncIterator]();
    let first: IteratorResult<string>;
    try {
      const r = await race(it.next(), config.chatFirstChunkTimeoutMs);
      if (!r.done) {
        abort.abort();
        throw new HttpError(504, 'llm_timeout', 'the model did not start answering in time');
      }
      first = r.value;
    } catch (e) {
      if (e instanceof HttpError) throw e;
      console.error('[chat] model failed before streaming:', (e as Error)?.message ?? e);
      throw new HttpError(502, 'llm_error', `chat failed: ${(e as Error)?.message ?? 'unknown error'}`);
    }

    c.header('Content-Type', 'text/plain; charset=utf-8');
    c.header('Cache-Control', 'no-cache');
    c.header(CHAT_HEADERS.interceptId, ic.intercept_id ?? '');
    c.header(CHAT_HEADERS.nodeId, ic.node_id ?? '');
    c.header(CHAT_HEADERS.level, ic.level ? String(ic.level) : '');

    return stream(c, async (s) => {
      let full = '';
      s.onAbort(() => abort.abort());
      try {
        let step = first;
        while (!step.done) {
          full += step.value;
          await s.write(step.value);
          step = await it.next();
        }
      } catch (e) {
        if (!abort.signal.aborted) console.error('[chat] stream error:', (e as Error)?.message ?? e);
      } finally {
        const log = ic.intercept_id ? store.db.logs.find((l) => l.id === ic.intercept_id) : undefined;
        if (log && full) {
          log.llm_response = full;
          store.save();
        }
      }
    });
  });
}
