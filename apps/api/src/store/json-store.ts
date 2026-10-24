import { existsSync, mkdirSync, readFileSync, renameSync as renameSyncFs } from 'node:fs';
import { rename, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { freshDb, type DB, type Store } from './store';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Windows can throw transient EPERM/EBUSY on rename (antivirus, indexer): retry 3x, 50ms apart. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (attempt >= 3 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw e;
      await sleep(50);
    }
  }
}

function load(path: string): DB {
  if (!existsSync(path)) return freshDb();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<DB>;
    const seed = freshDb();
    return {
      users: parsed.users ?? seed.users,
      trees: parsed.trees ?? seed.trees,
      pillars: parsed.pillars ?? seed.pillars,
      nodes: parsed.nodes ?? seed.nodes,
      edges: parsed.edges ?? seed.edges,
      states: parsed.states ?? seed.states,
      logs: parsed.logs ?? [],
      bypasses: parsed.bypasses ?? [],
    };
  } catch (e) {
    // Corrupt file: keep it for inspection and start from the seed.
    const backup = `${path}.corrupt-${Date.now()}`;
    try {
      renameSyncFs(path, backup);
    } catch {
      /* ignore */
    }
    console.error(`[store] could not read ${path} (${(e as Error).message}); moved to ${backup}, reseeding`);
    return freshDb();
  }
}

/**
 * In-memory object mirrored to a JSON file. Writes are coalesced and serialized:
 * write `<path>.tmp`, then rename over the real file. Pass `path = null` for a memory-only store (tests).
 */
export function createJsonStore(path: string | null): Store {
  if (path) mkdirSync(dirname(path), { recursive: true });
  let db: DB = path ? load(path) : freshDb();
  let dirty = false;
  let running: Promise<void> | null = null;

  async function drain(): Promise<void> {
    try {
      while (dirty) {
        dirty = false;
        await mkdir(dirname(path!), { recursive: true });
        const tmp = `${path}.tmp`;
        await writeFile(tmp, JSON.stringify(db));
        await renameWithRetry(tmp, path!);
      }
    } catch (e) {
      console.error('[store] write failed:', (e as Error).message);
    } finally {
      running = null;
    }
  }

  const store: Store = {
    get db() {
      return db;
    },
    save() {
      if (!path) return;
      dirty = true;
      running ??= drain();
    },
    reset() {
      db = freshDb();
      store.save();
    },
    flush() {
      return running ?? Promise.resolve();
    },
  };
  // Persist the seed on first run so the file exists immediately.
  if (path && !existsSync(path)) store.save();
  return store;
}
