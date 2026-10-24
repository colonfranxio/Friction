/**
 * Holds the user's send on claude.ai, asks Friction for the injected prompt, rewrites the
 * composer, then sends. Never blocks sending: any failure or timeout sends the original text.
 *
 * DOM operations are injected (`site`) so this is testable in happy-dom.
 */
import { FRICTION_OPEN } from '@friction/shared';
import type { InterceptRuntimeResult } from '../background-types';

export interface SiteOps {
  findComposer(doc: Document): HTMLElement | null;
  findSendButton(doc: Document): HTMLButtonElement | null;
  isInComposer(target: EventTarget | null, doc: Document): boolean;
  isOnSendButton(target: EventTarget | null, doc: Document): boolean;
  getComposerText(el: HTMLElement): string;
  setComposerText(doc: Document, el: HTMLElement, text: string): Promise<boolean>;
}

export type SendMode = 'injected' | 'passthrough' | 'failed-open' | 'not-sent' | 'bypassed';

export interface InterceptorDeps {
  doc: Document;
  win: Window;
  site: SiteOps;
  /** Ask the service worker. May reject. */
  intercept(raw: string): Promise<InterceptRuntimeResult>;
  timeoutMs: number;
  /** Max wait for the Send button to become enabled after the rewrite (React can lag). */
  settleMs?: number;
  /** Max wait for the composer to empty after sending; if it doesn't, the original text is restored. */
  confirmMs?: number;
  onSent?(mode: SendMode, result: InterceptRuntimeResult | null): void;
  /** Called with the trimmed text before intercepting; true = send it unmodified (a bypassed prompt). */
  skipIntercept?(raw: string): boolean;
}

export interface SendInterceptor {
  (): void; // uninstall
  /** Put `text` in the composer and send it without Friction. Resolves true when it went out. */
  sendUnmodified(text: string): Promise<boolean>;
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

async function waitUntil(cond: () => boolean, maxMs: number, stepMs = 25): Promise<boolean> {
  const end = Date.now() + maxMs;
  while (!cond()) {
    if (Date.now() >= end) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return true;
}

export function installSendInterceptor(deps: InterceptorDeps): SendInterceptor {
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

  const buttonReady = () => {
    const b = site.findSendButton(doc);
    return !!b && !b.disabled;
  };

  /**
   * Send the (rewritten) composer, then confirm it actually went out. If the composer still holds the
   * friction block (e.g. Claude was streaming and the send was ignored), put the original text back.
   */
  async function sendAndConfirm(composer: HTMLElement, raw: string): Promise<boolean> {
    await waitUntil(buttonReady, deps.settleMs ?? 300);
    triggerSend(composer);
    const sent = await waitUntil(() => !site.getComposerText(composer).includes(FRICTION_OPEN), deps.confirmMs ?? 600);
    if (!sent) await site.setComposerText(doc, composer, raw).catch(() => false);
    return sent;
  }

  async function run() {
    const composer = site.findComposer(doc);
    const raw = composer ? site.getComposerText(composer).trim() : '';
    if (!composer || !raw || raw.includes(FRICTION_OPEN)) {
      // Nothing to do (or already injected): behave exactly like a normal send.
      triggerSend(composer);
      return;
    }
    if (deps.skipIntercept?.(raw)) {
      triggerSend(composer);
      deps.onSent?.('bypassed', null);
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
      await waitUntil(buttonReady, deps.settleMs ?? 300);
      triggerSend(composer);
      deps.onSent?.('failed-open', result);
      return;
    }
    const sent = await sendAndConfirm(composer, raw);
    deps.onSent?.(sent ? 'injected' : 'not-sent', result);
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
  const uninstall = () => {
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('click', onClick, true);
  };
  return Object.assign(uninstall, {
    async sendUnmodified(text: string): Promise<boolean> {
      const composer = site.findComposer(doc);
      if (!composer || busy) return false;
      busy = true;
      try {
        const ok = await site.setComposerText(doc, composer, text).catch(() => false);
        if (!ok) return false;
        await waitUntil(buttonReady, deps.settleMs ?? 300);
        triggerSend(composer);
        return await waitUntil(() => site.getComposerText(composer).trim() !== text.trim(), deps.confirmMs ?? 600);
      } finally {
        busy = false;
      }
    },
  });
}
