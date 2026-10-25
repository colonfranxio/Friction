/**
 * Hides the ⟦friction⟧…⟦/friction⟧ block wherever the chat site renders it (e.g. user bubbles after a reload).
 * Works on text nodes, so it handles a block split across several nodes/paragraphs.
 * Never touches editable areas (the composer) or our own badge.
 */
import { FRICTION_CLOSE, FRICTION_OPEN } from '@friction/shared';

function isSkipped(node: Node): boolean {
  let el: Element | null = node.parentElement;
  while (el) {
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SCRIPT' || tag === 'STYLE') return true;
    if (el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '') return true;
    if (el.getAttribute('data-friction') === 'badge') return true;
    el = el.parentElement;
  }
  return false;
}

function textNodes(root: Node): Text[] {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const out: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

/** Removes every complete friction block under `root`. Returns how many were removed. */
export function stripFrictionBlocks(root: Node): number {
  let removed = 0;
  // Re-scan after each removal; blocks are rare, so this stays cheap.
  for (let guard = 0; guard < 20; guard++) {
    const nodes = textNodes(root).filter((n) => !isSkipped(n));
    const startIdx = nodes.findIndex((n) => n.data.includes(FRICTION_OPEN));
    if (startIdx === -1) break;
    let endIdx = -1;
    for (let i = startIdx; i < nodes.length; i++) {
      const from = i === startIdx ? nodes[i].data.indexOf(FRICTION_OPEN) : 0;
      if (nodes[i].data.indexOf(FRICTION_CLOSE, from) !== -1) {
        endIdx = i;
        break;
      }
    }
    if (endIdx === -1) break; // incomplete block (still streaming); try again on the next mutation

    const start = nodes[startIdx];
    const openAt = start.data.indexOf(FRICTION_OPEN);
    if (startIdx === endIdx) {
      const closeAt = start.data.indexOf(FRICTION_CLOSE, openAt) + FRICTION_CLOSE.length;
      start.data = start.data.slice(0, openAt).trimEnd() + start.data.slice(closeAt);
    } else {
      start.data = start.data.slice(0, openAt).trimEnd();
      for (let i = startIdx + 1; i < endIdx; i++) nodes[i].data = '';
      const end = nodes[endIdx];
      end.data = end.data.slice(end.data.indexOf(FRICTION_CLOSE) + FRICTION_CLOSE.length);
    }
    removed++;
  }
  return removed;
}

/** Watches the document and strips blocks as they appear. Throttled to one pass per frame. */
export function startHidingInjected(doc: Document): () => void {
  let scheduled = false;
  const run = () => {
    scheduled = false;
    if (doc.body) stripFrictionBlocks(doc.body);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    (doc.defaultView?.requestAnimationFrame ?? ((f: () => void) => setTimeout(f, 16)))(run);
  };
  const obs = new MutationObserver(schedule);
  obs.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
  schedule();
  return () => obs.disconnect();
}
