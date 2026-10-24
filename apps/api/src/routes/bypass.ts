import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import type { BypassEvent, BypassRequest, BypassResponse } from '@friction/shared';
import type { Ctx } from '../context';
import { HttpError, badRequest, notFound } from '../errors';
import { isNonEmptyString, readObject } from '../lib/http';

export function bypassRoutes(app: Hono, ctx: Ctx) {
  const { store, bus, mutex, promptTokens } = ctx;

  app.post('/bypass', async (c) => {
    const b = await readObject<BypassRequest>(c);
    if (!isNonEmptyString(b.student_id) || !isNonEmptyString(b.node_id)) throw badRequest('student_id and node_id required');
    // Contract v4: omitted or "concept" is the legacy behavior (pause the node until reset).
    if (b.scope !== undefined && b.scope !== 'concept' && b.scope !== 'prompt') throw badRequest('scope must be "concept" or "prompt"');
    const prompt = b.scope === 'prompt';
    // The sandbox binding (raw_prompt + conversation_id) is all-or-nothing and only valid with prompt scope.
    // Validated before anything is charged or changed.
    const binding = b.raw_prompt !== undefined || b.conversation_id !== undefined;
    if (binding && (!prompt || !isNonEmptyString(b.raw_prompt) || !isNonEmptyString(b.conversation_id))) {
      throw badRequest('a sandbox prompt bypass needs scope "prompt" plus both raw_prompt and conversation_id');
    }

    // Same per-student lock as /intercept, so a bypass can't interleave with a grade in flight.
    const body = await mutex.run(b.student_id, async (): Promise<BypassResponse> => {
      const db = store.db;
      const u = db.users.find((x) => x.id === b.student_id);
      const n = db.nodes.find((x) => x.id === b.node_id);
      if (!u || !n) throw notFound('student or node');
      if (u.bypass_quota <= 0) throw new HttpError(409, 'quota_exhausted', 'no bypasses left');
      const s = db.states.find((x) => x.student_id === u.id && x.node_id === n.id);
      if (!s) throw notFound('student_state');
      const at = new Date().toISOString();
      u.bypass_quota -= 1;
      // Prompt scope spends the quota but leaves mastery and any existing concept pause exactly as they were.
      if (!prompt) s.paused = true;
      s.updated_at = at;
      for (const l of db.logs) if (l.student_id === u.id && l.node_id === n.id) l.quiz_pending = false;
      const ev: BypassEvent = { id: randomUUID(), student_id: u.id, node_id: n.id, remaining_quota: u.bypass_quota, created_at: at };
      db.bypasses.push(ev);
      store.save();
      bus.publish(n.tree_id, { type: 'student_state', data: s });
      bus.publish(n.tree_id, { type: 'bypass', data: { ...ev, student_name: u.name, concept_name: n.concept_name } });
      // The token is issued once, with the charge; consuming it later costs nothing and is never refunded.
      const token = binding
        ? promptTokens.issue({ student_id: u.id, node_id: n.id, raw_prompt: b.raw_prompt!, conversation_id: b.conversation_id! })
        : undefined;
      return { remaining_quota: u.bypass_quota, ...(token ? { prompt_bypass_token: token } : {}) };
    });
    return c.json(body);
  });
}
