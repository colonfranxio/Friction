import type { Hono } from 'hono';
import type { AcceptedResponse, InterceptRequest, ResponsesRequest } from '@friction/shared';
import type { Ctx } from '../context';
import { badRequest, notFound } from '../errors';
import { isNonEmptyString, readObject } from '../lib/http';

export function interceptRoutes(app: Hono, ctx: Ctx) {
  app.post('/intercept', async (c) => {
    const b = await readObject<InterceptRequest>(c);
    if (!isNonEmptyString(b.student_id) || typeof b.raw_prompt !== 'string') {
      throw badRequest('student_id and raw_prompt required');
    }
    const res = await ctx.interceptService({
      student_id: b.student_id,
      raw_prompt: b.raw_prompt,
      app_source: b.app_source ?? 'claude_web',
      conversation_id: b.conversation_id ?? null,
      previous_assistant_text: b.previous_assistant_text ?? null,
    });
    return c.json(res);
  });

  app.post('/responses', async (c) => {
    const b = await readObject<ResponsesRequest>(c);
    if (!isNonEmptyString(b.intercept_id) || typeof b.llm_response !== 'string') {
      throw badRequest('intercept_id and llm_response required');
    }
    const log = ctx.store.db.logs.find((l) => l.id === b.intercept_id);
    if (!log) throw notFound('intercept');
    log.llm_response = b.llm_response;
    ctx.store.save();
    const body: AcceptedResponse = { ok: true };
    return c.json(body, 202);
  });
}
