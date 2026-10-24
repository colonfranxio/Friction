/** On-page status pill (ui-layouts §6). Shadow DOM so claude.ai's CSS can't touch it. Only the Bypass button takes clicks. */
import { LEVEL_LABELS, type BloomLevel } from '@friction/shared';

export type BadgeState =
  | { kind: 'ready' }
  | { kind: 'active'; level: BloomLevel; concept: string | null }
  | { kind: 'none' }
  | { kind: 'offline' }
  | { kind: 'disabled' }
  /** The last message was re-sent without friction (one bypass used). */
  | { kind: 'bypassed'; concept: string | null; remaining: number | null; conceptPaused?: boolean }
  /** Bypass failed; show why. */
  | { kind: 'error'; message: string }
  /** The extension was reloaded/updated; this tab's content script is orphaned until the page reloads. */
  | { kind: 'reload' };

const DOT = { amber: '#F59E0B', green: '#10B981', grey: '#9CA3AF' };

export function badgeText(s: BadgeState): { text: string; dot: string } {
  switch (s.kind) {
    case 'active': {
      if (s.level === 4) return { text: `Friction · no friction${s.concept ? ` · ${s.concept}` : ''}`, dot: DOT.green };
      const role = LEVEL_LABELS[s.level].role;
      return { text: `Friction · L${s.level} ${role}${s.concept ? ` · ${s.concept}` : ''}`, dot: DOT.amber };
    }
    case 'none':
      return { text: 'Friction · no friction', dot: DOT.green };
    case 'offline':
      return { text: 'Friction offline', dot: DOT.grey };
    case 'disabled':
      return { text: 'Friction paused', dot: DOT.grey };
    case 'bypassed': {
      const left = s.remaining === null ? '' : ` · ${s.remaining} left`;
      const what = s.conceptPaused ? 'concept bypassed' : 'bypassed';
      return { text: `Friction · ${what}${s.concept ? ` · ${s.concept}` : ''}${left}`, dot: DOT.grey };
    }
    case 'error':
      return { text: `Friction · ${s.message}`, dot: DOT.amber };
    case 'reload':
      return { text: 'Friction updated · reload this tab', dot: DOT.amber };
    default:
      return { text: 'Friction · ready', dot: DOT.green };
  }
}

/** The Bypass button shows only while the last message got friction (L1–L3). */
export function canBypass(s: BadgeState): boolean {
  return s.kind === 'active' && s.level < 4;
}

export interface BadgeOptions {
  onBypass?(): void;
}

export function mountBadge(
  doc: Document,
  opts: BadgeOptions = {},
): { set(state: BadgeState): void; setBusy(busy: boolean): void; host: HTMLElement } {
  const host = doc.createElement('friction-badge');
  host.setAttribute('data-friction', 'badge');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { all: initial; position: fixed; right: 12px; bottom: 12px; z-index: 2147483646; pointer-events: none; }
      .pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px;
        background: #FFFFFF; color: #1F2937; border: 1px solid #E5E7EB; box-shadow: 0 2px 8px rgba(0,0,0,.08);
        font: 600 12px/1.2 Nunito, ui-rounded, system-ui, sans-serif; max-width: 440px; white-space: nowrap; }
      .text { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
      .logo { color: #F59E0B; }
      .bypass { pointer-events: auto; margin-left: 4px; padding: 2px 10px; border-radius: 999px; border: 1px solid #F59E0B;
        background: #FFFFFF; color: #92400E; font: 700 11px/1.4 Nunito, ui-rounded, system-ui, sans-serif; cursor: pointer; }
      .bypass:hover { background: #FEF3C7; }
      .bypass:disabled { opacity: .5; cursor: default; }
      .bypass[hidden] { display: none; }
    </style>
    <div class="pill"><span class="dot"></span><span class="logo">◆</span><span class="text"></span>
      <button class="bypass" type="button" title="Re-send this message without friction (uses one bypass; your teacher is notified)" hidden>Bypass</button></div>`;
  const dot = root.querySelector('.dot') as HTMLElement;
  const text = root.querySelector('.text') as HTMLElement;
  const btn = root.querySelector('.bypass') as HTMLButtonElement;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!btn.disabled) opts.onBypass?.();
  });
  const set = (state: BadgeState) => {
    const t = badgeText(state);
    text.textContent = t.text;
    dot.style.background = t.dot;
    btn.hidden = !opts.onBypass || !canBypass(state);
  };
  const setBusy = (busy: boolean) => {
    btn.disabled = busy;
    btn.textContent = busy ? 'Bypassing…' : 'Bypass';
  };
  set({ kind: 'ready' });
  (doc.body ?? doc.documentElement).appendChild(host);
  return { set, setBusy, host };
}
