/**
 * Holds the user's send on the AI chat site, asks Friction for the injected prompt, rewrites the
 * composer, then sends. Never blocks sending: any failure or timeout sends the original text.
 *
 * DOM operations are injected (`site`) so this is testable in happy-dom.
 */
import { FRICTION_CLOSE, FRICTION_OPEN, stripInjected } from '@friction/shared';
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
export type UnmodifiedResult = 'sent' | 'not-sent' | 'aborted';

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
  /**
   * Put `text` in the composer and send it without Friction.
   * 'sent': it went out. 'not-sent': it is in the composer but the page didn't send it.
   * 'aborted': nothing was sent and the composer is as the user left it (a draft or another send
   * appeared, or `stillValid()` turned false; it is checked before writing and right before Send).
   */
  sendUnmodified(text: string, stillValid?: () => boolean): Promise<UnmodifiedResult>;
  /** Can `text` be re-sent right now without clobbering anything? (no send in flight, composer empty or already holding `text`) */
  canSendUnmodified(text: string): 'ok' | 'busy' | 'draft' | 'no_composer';
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

/** The user's prompt with any friction block and stray ⟦friction⟧ / ⟦/friction⟧ markers removed. */
export function cleanPrompt(text: string): string {
  // Repeat until stable, so nested fragments can't rebuild a marker (e.g. "⟦fric⟦friction⟧tion⟧").
  let prev: string;
  let cur = text;
  do {
    prev = cur;
    cur = stripInjected(cur).split(FRICTION_OPEN).join('').split(FRICTION_CLOSE).join('');
  } while (cur !== prev);
  return cur.trim();
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

  /** Send the composer as-is, or after replacing its text with the cleaned prompt. */
  async function sendClean(composer: HTMLElement, typed: string, raw: string) {
    if (raw !== typed) {
      await site.setComposerText(doc, composer, raw).catch(() => false);
      await waitUntil(buttonReady, deps.settleMs ?? 300);
    }
    triggerSend(composer);
  }

  async function run() {
    const composer = site.findComposer(doc);
    const typed = composer ? site.getComposerText(composer).trim() : '';
    if (!composer || !typed) {
      triggerSend(composer); // nothing to do: behave exactly like a normal send
      return;
    }
    // Never trust a friction block the user typed or pasted (e.g. copied from an earlier message):
    // strip it and any stray markers, then treat the rest as a normal prompt. Our own re-dispatched
    // send never reaches here (letThrough), so this can't double-inject.
    const raw = cleanPrompt(typed);
    if (!raw) {
      await site.setComposerText(doc, composer, '').catch(() => false); // only a friction block: send nothing
      return;
    }
    if (deps.skipIntercept?.(raw)) {
      await sendClean(composer, typed, raw);
      deps.onSent?.('bypassed', null);
      return;
    }
    let result: InterceptRuntimeResult;
    try {
      result = await withTimeout(deps.intercept(raw), deps.timeoutMs);
    } catch {
      await sendClean(composer, typed, raw);
      deps.onSent?.('failed-open', null);
      return;
    }
    const o = result.outcome;
    if (o.passthrough || o.response.injected_prompt === raw) {
      await sendClean(composer, typed, raw);
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

  // Window capture phase runs before the site's own handlers (ProseMirror keymap, React root).
  win.addEventListener('keydown', onKeyDown, true);
  win.addEventListener('click', onClick, true);
  const uninstall = () => {
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('click', onClick, true);
  };
  return Object.assign(uninstall, {
    canSendUnmodified(text: string) {
      const composer = site.findComposer(doc);
      if (!composer) return 'no_composer' as const;
      if (busy) return 'busy' as const;
      const current = cleanPrompt(site.getComposerText(composer));
      if (current && current !== text.trim()) return 'draft' as const; // never overwrite a new draft
      return 'ok' as const;
    },
    async sendUnmodified(text: string, stillValid: () => boolean = () => true): Promise<UnmodifiedResult> {
      const composer = site.findComposer(doc);
      const want = text.trim();
      if (!composer || busy || !stillValid()) return 'aborted';
      const before = site.getComposerText(composer);
      const current = cleanPrompt(before);
      if (current && current !== want) return 'aborted'; // never overwrite a new draft
      busy = true;
      try {
        const ok = await site.setComposerText(doc, composer, text).catch(() => false);
        if (!ok) return 'not-sent';
        await waitUntil(buttonReady, deps.settleMs ?? 300);
        // Final check right before Send: the user may have typed, navigated or turned Friction off meanwhile.
        if (cleanPrompt(site.getComposerText(composer)) !== want) return 'aborted'; // they typed: leave it
        if (!stillValid()) {
          await site.setComposerText(doc, composer, before).catch(() => false); // put back what was there
          return 'aborted';
        }
        triggerSend(composer);
        const sent = await waitUntil(() => site.getComposerText(composer).trim() !== want, deps.confirmMs ?? 600);
        return sent ? 'sent' : 'not-sent';
      } finally {
        busy = false;
      }
    },
  });
}
