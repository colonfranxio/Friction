import type { Hono } from 'hono';
import { CONTRACT_VERSION, type HealthResponse } from '@friction/shared';
import type { Ctx } from '../context';

export function healthRoutes(app: Hono, ctx: Ctx) {
  app.get('/health', (c) => {
    const body: HealthResponse = {
      ok: true,
      contract_version: CONTRACT_VERSION,
      mode: { intelligence: ctx.intelligenceMode, demo: ctx.config.demo, server: 'api' },
    };
    return c.json(body);
  });
}
