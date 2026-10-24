import type { Intelligence } from '@friction/shared';
import type { Config } from './env';
import type { EventBus } from './events';
import type { KeyedMutex } from './lib/mutex';
import type { InterceptService } from './services/intercept';
import type { DemoMatcher } from './services/demo-cache';
import type { Store } from './store/store';

/** Everything a route needs. Built once in index.ts (or per test). */
export interface Ctx {
  config: Config;
  /** 'real' only when USE_REAL_INTELLIGENCE=1 actually loaded B's implementation. */
  intelligenceMode: 'fake' | 'real';
  intel: Intelligence;
  store: Store;
  bus: EventBus;
  mutex: KeyedMutex;
  demoMatcher: DemoMatcher;
  interceptService: InterceptService;
}
