/**
 * Holds the user's send on claude.ai, asks Friction for the injected prompt, rewrites the
 * composer, then sends. Never blocks sending: any failure or timeout sends the original text.
 *
 * DOM operations are injected (`site`) so this is testable in happy-dom.
 */
import type { InterceptRuntimeResult } from '../background-types';

export interface SiteOps {
  findComposer(doc: Document): HTMLElement | null;
  findSendButton(doc: Document): HTMLButtonElement | null;
  isInComposer(target: EventTarget | null, doc: Document): boolean;
  isOnSendButton(target: EventTarget | null, doc: Document): boolean;
  getComposerText(el: HTMLElement): string;
  setComposerText(doc: Document, el: HTMLElement, text: string): Promise<boolean>;
}

export type SendMode = 'injected' | 'passthrough' | 'failed-open';

export interface InterceptorDeps {
  doc: Document;
  win: Window;
  site: SiteOps;
  /** Ask the service worker. May reject. */
  intercept(raw: string): Promise<InterceptRuntimeResult>;
  timeoutMs: number;
  /** Delay before re-triggering send, so the editor/React can update the button state. */
  settleMs?: number;
  onSent?(mode: SendMode, result: InterceptRuntimeResult | null): void;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

export function installSendInterceptor(deps: InterceptorDeps): () => void {
  const { doc, win, site } = deps;
  let busy = false; // a send is being processed; swallow extra Enters/clicks
  let letThrough = false; // our own re-dispatched send must not be intercepted

  const isSendKey = (e: KeyboardEvent) =>
    e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && !e.isComposing && e.keyCode !== 229;

  function triggerSend(composer: HTMLElement | null) {
    letThrough = true;
    try {
      const btn = site.findSendButton(doc);
      if (btn && !btn.disabled) {
        btn.click();
      } else if (composer) {
        composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
      }
    } finally {
      letThrough = false;
    }
  }

  async function run() {
    const composer = site.findComposer(doc);
    const raw = composer ? site.getComposerText(composer).trim() : '';
    const sleep = () => new Promise((r) => setTimeout(r, deps.settleMs ?? 30));
    if (!composer || !raw) {
      triggerSend(composer);
      return;
    }
    let result: InterceptRuntimeResult;
    try {
      result = await withTimeout(deps.intercept(raw), deps.timeoutMs);
    } catch {
      triggerSend(composer);
      deps.onSent?.('failed-open', null);
      return;
    }
    const o = result.outcome;
    if (o.passthrough || o.response.injected_prompt === raw) {
      triggerSend(composer);
      deps.onSent?.('passthrough', result);
      return;
    }
    const ok = await site.setComposerText(doc, composer, o.response.injected_prompt).catch(() => false);
    if (!ok) {
      await site.setComposerText(doc, composer, raw).catch(() => false);
      await sleep();
      triggerSend(composer);
      deps.onSent?.('failed-open', result);
      return;
    }
    await sleep();
    triggerSend(composer);
    deps.onSent?.('injected', result);
  }

  function hold(e: Event) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (busy) return;
    busy = true;
    run().finally(() => (busy = false));
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (letThrough || !isSendKey(e) || !site.isInComposer(e.target, doc)) return;
    hold(e);
  };
  const onClick = (e: MouseEvent) => {
    if (letThrough || !site.isOnSendButton(e.target, doc)) return;
    hold(e);
  };

  // Window capture phase runs before claude.ai's own handlers (ProseMirror keymap, React root).
  win.addEventListener('keydown', onKeyDown, true);
  win.addEventListener('click', onClick, true);
  return () => {
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('click', onClick, true);
  };
}
