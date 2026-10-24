import type { ServerEvent, UUID } from '@friction/shared';

type Listener = (ev: ServerEvent) => void;

/** In-process pub/sub keyed by tree id. SSE connections subscribe; services publish. */
export class EventBus {
  private listeners = new Map<UUID, Set<Listener>>();

  subscribe(treeId: UUID, fn: Listener): () => void {
    let set = this.listeners.get(treeId);
    if (!set) this.listeners.set(treeId, (set = new Set()));
    const mine = set;
    mine.add(fn);
    // Idempotent, and never drops a newer set that took over this tree id's map entry.
    return () => {
      mine.delete(fn);
      if (mine.size === 0 && this.listeners.get(treeId) === mine) this.listeners.delete(treeId);
    };
  }

  publish(treeId: UUID, ev: ServerEvent): void {
    for (const fn of [...(this.listeners.get(treeId) ?? [])]) {
      try {
        fn(ev);
      } catch (e) {
        console.error('[events] listener failed', e);
      }
    }
  }

  get size(): number {
    let n = 0;
    for (const s of this.listeners.values()) n += s.size;
    return n;
  }
}
