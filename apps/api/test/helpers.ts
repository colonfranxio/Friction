import type { Hono } from 'hono';
import { fakeIntelligence, type Intelligence, type ServerEvent } from '@friction/shared';
import { createApp } from '../src/app';
import { createCtx } from '../src/bootstrap';
import type { Ctx } from '../src/context';
import type { Config } from '../src/env';
import type { Store } from '../src/store/store';
import { createJsonStore } from '../src/store/json-store';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface TestApp {
  app: Hono;
  ctx: Ctx;
  store: Store;
  events: ServerEvent[];
  call: <T = any>(method: string, path: string, body?: unknown) => Promise<{ status: number; body: T; headers: Headers }>;
}

export function makeApp(opts: { config?: Partial<Config>; intel?: Intelligence; store?: Store; demoMatches?: boolean; clock?: () => number } = {}): TestApp {
  const config: Config = {
    port: 0,
    demo: true,
    useRealIntelligence: false,
    interceptBudgetMs: 4000,
    parseDelayMs: 0,
    parseTimeoutMs: 90_000,
    chatFirstChunkTimeoutMs: 30_000,
    ...opts.config,
  };
  const store = opts.store ?? createJsonStore(null);
  const ctx = createCtx({
    config,
    intel: opts.intel ?? fakeIntelligence,
    intelligenceMode: 'fake',
    store,
    demoMatcher: () => opts.demoMatches ?? true,
    clock: opts.clock,
  });
  const app = createApp(ctx);
  const events: ServerEvent[] = [];
  for (const t of store.db.trees) ctx.bus.subscribe(t.id, (ev) => events.push(ev));

  const call: TestApp['call'] = async (method, path, body) => {
    const res = await app.request(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      /* plain text (e.g. /chat) */
    }
    return { status: res.status, body: parsed, headers: res.headers };
  };
  return { app, ctx, store, events, call };
}
