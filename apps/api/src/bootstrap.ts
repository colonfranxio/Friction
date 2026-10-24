import type { Intelligence } from '@friction/shared';
import type { Ctx } from './context';
import type { Config } from './env';
import { EventBus } from './events';
import { KeyedMutex } from './lib/mutex';
import { createDemoMatcher, type DemoMatcher } from './services/demo-cache';
import { createInterceptService } from './services/intercept';
import { PromptTokens } from './services/prompt-tokens';
import type { Store } from './store/store';

export interface CtxInit {
  config: Config;
  intel: Intelligence;
  intelligenceMode: 'fake' | 'real';
  store: Store;
  demoMatcher?: DemoMatcher;
  /** Injected in tests to control prompt-token expiry. */
  clock?: () => number;
}

/** Wires the dependency graph. index.ts uses it for the server, tests use it with a memory store. */
export function createCtx(init: CtxInit): Ctx {
  const bus = new EventBus();
  const mutex = new KeyedMutex();
  const base = { config: init.config, intel: init.intel, store: init.store, bus, mutex };
  return {
    ...base,
    intelligenceMode: init.intelligenceMode,
    promptTokens: new PromptTokens(init.clock),
    demoMatcher: init.demoMatcher ?? createDemoMatcher(),
    interceptService: createInterceptService(base),
  };
}
