import { fakeIntelligence, type Intelligence } from '@friction/shared';
import type { Store } from './store/store';
import { MossRuntime, type RetrievalTrace } from './services/moss-runtime';

export interface LoadedIntelligence {
  intel: Intelligence;
  start(): void;
  close(): Promise<void>;
}

/** Moss is on by default in real mode when credentials exist; USE_MOSS_RETRIEVAL=0 turns it off.
 * Native SDK import occurs only in background prewarm. */
export async function loadIntelligence(useReal: boolean, opts: {
  store: Store;
  env?: NodeJS.ProcessEnv;
  trace?: (event: RetrievalTrace) => void;
  load?: () => Promise<typeof import('@friction/intelligence')>;
}): Promise<LoadedIntelligence> {
  const idle = (intel: Intelligence): LoadedIntelligence => ({ intel, start() {}, close: async () => {} });
  if (!useReal) return idle(fakeIntelligence);
  const env = opts.env ?? process.env;
  const module = await (opts.load ?? (() => import('@friction/intelligence')))();
  const trace = opts.trace ?? ((event) => console.log(`[moss] ${JSON.stringify(event)}`));
  const flag = (env.USE_MOSS_RETRIEVAL ?? '').trim().toLowerCase();
  if (flag === '0' || flag === 'false') {
    trace({ state: 'disabled', reason: 'flag' });
    return idle(module.createIntelligence());
  }
  if (!env.MOSS_PROJECT_ID || !env.MOSS_PROJECT_KEY) {
    trace({ state: 'disabled', reason: 'credentials' });
    return idle(module.createIntelligence());
  }
  const retrieval = new MossRuntime({ store: opts.store, fingerprint: module.curriculumFingerprint,
    createIndex: () => module.mossFromEnv(env)!, trace });
  return { intel: module.createIntelligence({ curriculumRetriever: retrieval }),
    start: () => retrieval.start(), close: () => retrieval.close() };
}
