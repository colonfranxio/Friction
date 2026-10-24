/** Runs async functions one at a time per key (FIFO). Used to serialize /intercept per student. */
export class KeyedMutex {
  private tails = new Map<string, Promise<void>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const tail = prev.then(() => gate);
    this.tails.set(key, tail);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}

/** Resolves within `ms` or returns {done:false}; the promise keeps running either way. */
export async function race<T>(p: Promise<T>, ms: number): Promise<{ done: true; value: T } | { done: false }> {
  let t: NodeJS.Timeout | undefined;
  const timeout = new Promise<{ done: false }>((r) => (t = setTimeout(() => r({ done: false }), ms)));
  try {
    return await Promise.race([p.then((value) => ({ done: true as const, value })), timeout]);
  } finally {
    clearTimeout(t);
  }
}
