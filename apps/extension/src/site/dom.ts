/**
 * DOM operations shared by every site adapter. A site only supplies selectors and its URL format
 * (and, if its editor needs it, its own setComposerText). Elements are re-queried on every call:
 * chat sites replace the composer node when you switch chats.
 */
import { FRICTION_OPEN } from '@friction/shared';
import type { SiteOps } from '../lib/send-interceptor';
import type { SiteAdapter, SiteSelectors } from './types';

const MAX_ASSISTANT_CHARS = 4000;

function first<T extends Element>(doc: ParentNode, sels: string[]): T | null {
  for (const s of sels) {
    const el = doc.querySelector<T>(s);
    if (el) return el;
  }
  return null;
}

export function getComposerText(el: HTMLElement): string {
  return (el.innerText ?? el.textContent ?? '').replace(/ /g, ' ');
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const log = (strategy: string) => (console.debug('[friction] composer rewritten via', strategy), true);

/** Did the composer end up containing `text` (whitespace-insensitive)? */
function composerHas(el: HTMLElement, text: string): boolean {
  return norm(getComposerText(el)) === norm(text);
}

function selectAll(doc: Document, el: HTMLElement) {
  el.focus();
  const sel = doc.getSelection();
  if (!sel) return;
  const range = doc.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Replace the composer's content. Tries, in order:
 *  1. a synthetic paste (ProseMirror turns lines into paragraphs),
 *  2. execCommand('insertText'),
 *  3. direct DOM write + input event (ProseMirror/Quill re-read DOM changes).
 * Returns true only if the composer ends up holding the text.
 */
export async function setComposerText(doc: Document, el: HTMLElement, text: string): Promise<boolean> {
  const settle = () => new Promise((r) => setTimeout(r, 0));

  try {
    selectAll(doc, el);
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    await settle();
    if (composerHas(el, text)) return log('paste');
  } catch {
    /* DataTransfer/ClipboardEvent unsupported: next strategy */
  }

  try {
    selectAll(doc, el);
    if (typeof doc.execCommand === 'function' && doc.execCommand('insertText', false, text)) {
      await settle();
      if (composerHas(el, text)) return log('insertText');
    }
  } catch {
    /* next strategy */
  }

  const lines = text.split('\n');
  el.replaceChildren(
    ...lines.map((line) => {
      const p = doc.createElement('p');
      p.textContent = line;
      return p;
    }),
  );
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
  await settle();
  return composerHas(el, text) ? log('dom') : false;
}

export function makeAdapter(spec: {
  id: SiteAdapter['id'];
  app_source: SiteAdapter['app_source'];
  hosts: string[];
  selectors: SiteSelectors;
  conversationIdFromPath(pathname: string): string | null;
  setComposerText?: SiteOps['setComposerText'];
}): SiteAdapter {
  const { selectors } = spec;
  const findComposer = (doc: Document) => first<HTMLElement>(doc, selectors.composer);
  const findSendButton = (doc: Document) => first<HTMLButtonElement>(doc, selectors.send);
  return {
    id: spec.id,
    app_source: spec.app_source,
    hosts: spec.hosts,
    selectors,
    conversationIdFromPath: spec.conversationIdFromPath,
    findComposer,
    findSendButton,
    isInComposer(target, doc) {
      const c = findComposer(doc);
      return !!c && target instanceof Node && (c === target || c.contains(target));
    },
    isOnSendButton(target, doc) {
      const b = findSendButton(doc);
      return !!b && target instanceof Node && (b === target || b.contains(target));
    },
    getComposerText,
    setComposerText: spec.setComposerText ?? setComposerText,
    lastAssistantText(doc) {
      for (const sel of selectors.assistant) {
        const all = doc.querySelectorAll<HTMLElement>(sel);
        const last = all[all.length - 1];
        const text = (last?.innerText ?? last?.textContent ?? '').trim();
        if (text && !text.includes(FRICTION_OPEN)) return text.slice(-MAX_ASSISTANT_CHARS);
      }
      return null;
    },
  };
}
