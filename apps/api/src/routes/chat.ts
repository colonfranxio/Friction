import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import { CHAT_HEADERS, type ChatLog, type ChatMessage, type ChatRequest, type InterceptResponse } from '@friction/shared';
import type { Ctx } from '../context';
import { HttpError, badRequest } from '../errors';
import { isNonEmptyString, readObject } from '../lib/http';
import { race } from '../lib/mutex';
import { activityFromLog } from '../services/activity';

/**
 * POST /chat (sandbox, the main demo surface): intercept the last user message, swap in the
 * injected prompt, stream Intelligence.chat() as text/plain, save the full reply as the log's
 * llm_response (that reply is the quiz text for grading the next turn).
 */
export function chatRoutes(app: Hono, ctx: Ctx) {
  const { store, intel, config, mutex, bus } = ctx;
  const encoder = new TextEncoder();

  /** The turn a valid prompt-bypass token buys: L4, no quiz, no grading, no mastery change, safe activity row. */
  async function promptBypassTurn(token: unknown, studentId: string, rawPrompt: string, conversationId: unknown): Promise<InterceptResponse> {
    const bad = () => badRequest('invalid, expired or mismatched prompt bypass token');
    if (typeof token !== 'string' || !isNonEmptyString(conversationId)) throw bad();
    const grant = ctx.promptTokens.consume(token, { student_id: studentId, raw_prompt: rawPrompt, conversation_id: conversationId }, (g) => {
      const db = store.db;
      const node = db.nodes.find((n) => n.id === g.node_id);
      const student = db.users.find((u) => u.id === g.student_id);
      return !!node && !!student && student.active_tree_id === node.tree_id;
    });
    if (!grant) throw bad();
    // From here the token is spent: a failure or cancellation never refunds it or re-arms it.
    return mutex.run(studentId, async () => {
      const db = store.db;
      const node = db.nodes.find((n) => n.id === grant.node_id);
      if (!node) throw bad(); // wiped by a reset between consume and here
      const log: ChatLog = {
        id: randomUUID(),
        student_id: studentId,
        node_id: node.id,
        conversation_id: conversationId,
        app_source: 'sandbox',
        level: 4,
        raw_prompt: rawPrompt,
        injected_prompt: rawPrompt,
        llm_response: null,
        quiz_pending: false,
        verdict: null,
        confidence: null,
        rationale: null,
        created_at: new Date().toISOString(),
      };
      db.logs.push(log);
      store.save();
      bus.publish(node.tree_id, { type: 'activity', data: activityFromLog(db, log, 'intercept') });
      console.log(`[intercept] student=${studentId} node="${node.concept_name}" level=L4 prompt-bypass (no grading)`);
      return { intercept_id: log.id, node_id: node.id, level: 4, injected_prompt: rawPrompt, quiz_attached: false, graded: null };
    });
  }

  app.post('/chat', async (c) => {
    const b = await readObject<ChatRequest>(c);
    const messages = Array.isArray(b.messages) ? (b.messages as ChatMessage[]) : [];
    // Like the mock: the last *user* message is the one that gets intercepted and replaced.
    const lastIdx = messages.map((m) => m?.role).lastIndexOf('user');
    const last = messages[lastIdx];
    if (!isNonEmptyString(b.student_id) || !last || typeof last.content !== 'string') {
      throw badRequest('student_id and at least one user message required');
    }

    let ic: InterceptResponse;
    if (b.prompt_bypass_token !== undefined) {
      // Contract v4: a one-use token from prompt-scoped /bypass. Validated and consumed synchronously, before
      // any await or model call; every failure is a 400 with the token left untouched (a mismatch can't burn it).
      ic = await promptBypassTurn(b.prompt_bypass_token, b.student_id, last.content, b.conversation_id);
    } else {
      ic = await ctx.interceptService({
        student_id: b.student_id,
        raw_prompt: last.content,
        app_source: 'sandbox',
        conversation_id: b.conversation_id ?? null,
      });
    }
    const injected = messages.map((m, i) => (i === lastIdx ? { ...m, content: ic.injected_prompt } : m));

    /** A quiz the student never saw (failed, aborted or empty reply) must not wait for an answer. */
    const closeQuiz = () => {
      const log = ic.intercept_id ? store.db.logs.find((l) => l.id === ic.intercept_id) : undefined;
      if (log?.quiz_pending) {
        log.quiz_pending = false;
        store.save();
      }
    };

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
      closeQuiz();
      if (e instanceof HttpError) throw e;
      console.error('[chat] model failed before streaming:', (e as Error)?.message ?? e);
      throw new HttpError(502, 'llm_error', `chat failed: ${(e as Error)?.message ?? 'unknown error'}`);
    }

    c.header('Content-Type', 'text/plain; charset=utf-8');
    c.header('Cache-Control', 'no-cache');
    c.header(CHAT_HEADERS.interceptId, ic.intercept_id ?? '');
    c.header(CHAT_HEADERS.nodeId, ic.node_id ?? '');
    c.header(CHAT_HEADERS.level, ic.level ? String(ic.level) : '');
    // Contract v3 (optional): exact boolean string for THIS turn, so the UI needn't infer it from the level.
    c.header(CHAT_HEADERS.quizAttached, String(ic.quiz_attached));

    // Contract v4: the body is a native ReadableStream so a generation failure after the first byte can
    // *error* it (the client's body reader rejects). Hono's stream() helper can only end cleanly, which a
    // client cannot tell from a finished reply. highWaterMark 0 = no read-ahead, so error() never discards
    // a chunk the client has not read yet.
    let full = '';
    let finished = false;
    let step = first;
    const finish = (complete: boolean) => {
      if (finished) return;
      finished = true;
      const log = ic.intercept_id ? store.db.logs.find((l) => l.id === ic.intercept_id) : undefined;
      if (log && full) {
        log.llm_response = full; // partial text is kept either way
        store.save();
      }
      // Failed, cut-off or empty reply: the check question may never have been shown.
      if (!complete || !full) closeQuiz();
    };
    const body = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          if (finished) return;
          try {
            if (step.done) {
              // B's chat() ends *quietly* when the signal aborts, so a normal end is not proof of a full reply.
              finish(!abort.signal.aborted);
              controller.close();
              return;
            }
            full += step.value;
            controller.enqueue(encoder.encode(step.value));
            step = await it.next();
          } catch (e) {
            if (finished) return; // the client already cancelled
            console.error('[chat] stream error:', (e as Error)?.message ?? e);
            finish(false);
            controller.error(e); // observable failure: reader.read() rejects instead of ending cleanly
          }
        },
        cancel() {
          abort.abort();
          finish(false);
        },
      },
      { highWaterMark: 0 },
    );
    return c.body(body, 200);
  });
}
