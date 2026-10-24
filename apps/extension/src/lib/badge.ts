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
  /** A bypass was used but the re-send was cancelled (chat/draft/consent/send changed); offers the question to copy. */
  | { kind: 'spent'; remaining: number; reason: string; prompt: string }
  /** Bypass failed; show why. */
  | { kind: 'error'; message: string }
  /** The extension was reloaded/updated; this tab's content script is orphaned until the page reloads. */
  | { kind: 'reload' };

const DOT = { amber: '#6D4AFF', green: '#E0A100', grey: '#8F86A8', teal: '#0E7A7A' };
/** The pill's tiny card glyph: its shape and fill carry the state, so colour is never the only cue. */
export type BadgeMark = 'learning' | 'mastered' | 'ticket' | 'idle' | 'alert';
const MARK: Record<string, BadgeMark> = { [DOT.amber]: 'learning', [DOT.green]: 'mastered', [DOT.grey]: 'idle', [DOT.teal]: 'ticket' };

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
      return { text: `Friction · ${what}${s.concept ? ` · ${s.concept}` : ''}${left}`, dot: DOT.teal };
    }
    case 'spent':
      return { text: `Friction · bypass used (${s.remaining} left), not sent: ${s.reason}`, dot: DOT.amber };
    case 'error':
      return { text: `Friction · ${s.message}`, dot: DOT.amber };
    case 'reload':
      return { text: 'Friction updated · reload this tab', dot: DOT.amber };
    default:
      return { text: 'Friction · ready', dot: DOT.green };
  }
}

/** The Bypass button shows only while the last message got friction (L1–L3). */
export function badgeMark(s: BadgeState): BadgeMark {
  return s.kind === 'error' || s.kind === 'reload' ? 'alert' : MARK[badgeText(s).dot] ?? 'idle';
}

export function canBypass(s: BadgeState): boolean {
  return s.kind === 'active' && s.level < 4;
}

export interface BadgeOptions {
  onBypass?(): void;
}

export function mountBadge(
  doc: Document,
  opts: BadgeOptions = {},
): { set(state: BadgeState): void; setBusy(busy: boolean): void; setPromptBypass(on: boolean): void; host: HTMLElement } {
  const host = doc.createElement('friction-badge');
  host.setAttribute('data-friction', 'badge');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { all: initial; position: fixed; right: 12px; bottom: 12px; z-index: 2147483646; pointer-events: none; }
      .pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px;
        background: #FFFFFF; color: #231B3A; border: 1.5px solid #E2DCEC; box-shadow: 0 2px 10px rgba(35,27,58,.12);
        font: 700 12px/1.2 Nunito, ui-rounded, system-ui, sans-serif; max-width: 440px; white-space: nowrap; }
      .text { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .mark { width: 9px; height: 12px; border-radius: 2.5px; flex: none; transform: rotate(-8deg); box-sizing: border-box; }
      .mark[data-mark="learning"] { background: #6D4AFF; border: 1.5px solid #4B2FB8; }
      .mark[data-mark="mastered"] { background: #E0A100; border: 1.5px solid #B07A00; }
      .mark[data-mark="ticket"] { background: #E6F4F3; border: 1.5px dashed #0E7A7A; transform: none; }
      .mark[data-mark="idle"] { background: #EBE7F2; border: 1.5px dashed #8F86A8; transform: none; }
      .mark[data-mark="alert"] { background: #FFFFFF; border: 1.5px solid #6D4AFF; }
      .bypass { pointer-events: auto; margin-left: 4px; padding: 2px 10px; border-radius: 999px; border: 1.5px dashed #0E7A7A;
        background: #E6F4F3; color: #0E7A7A; font: 800 11px/1.4 Nunito, ui-rounded, system-ui, sans-serif; cursor: pointer; }
      .bypass:hover { background: #D6EEEC; }
      .bypass:focus-visible { outline: 2px solid #A993FF; outline-offset: 2px; }
      .bypass:disabled { opacity: .5; cursor: default; }
      .bypass[hidden] { display: none; }
    </style>
    <div class="pill"><span class="mark" aria-hidden="true"></span><span class="text"></span>
      <button class="bypass" type="button" title="Re-send this message without friction. On this server it also pauses friction on this concept until reset. Uses one bypass; your teacher is notified." hidden>Bypass</button>
      <button class="bypass copy" type="button" title="Copy your original question" hidden>Copy question</button></div>`;
  const mark = root.querySelector('.mark') as HTMLElement;
  const text = root.querySelector('.text') as HTMLElement;
  const btn = root.querySelector('.bypass') as HTMLButtonElement;
  const copy = root.querySelector('.copy') as HTMLButtonElement;
  let copyText = '';
  copy.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void navigator.clipboard?.writeText(copyText).then(
      () => (copy.textContent = 'Copied'),
      () => (copy.textContent = 'Copy failed'),
    );
  });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!btn.disabled) opts.onBypass?.();
  });
  const set = (state: BadgeState) => {
    const t = badgeText(state);
    text.textContent = t.text;
    mark.dataset.mark = badgeMark(state);
    btn.hidden = !opts.onBypass || !canBypass(state);
    copyText = state.kind === 'spent' ? state.prompt : '';
    copy.hidden = !copyText;
    copy.textContent = 'Copy question';
  };
  const setBusy = (busy: boolean) => {
    btn.disabled = busy;
    btn.textContent = busy ? 'Bypassing…' : 'Bypass';
  };
  set({ kind: 'ready' });
  (doc.body ?? doc.documentElement).appendChild(host);
  /** Tooltip honesty: per-prompt only when the bypass gate is on (status.prompt_bypass); cautious wording by default. */
  const setPromptBypass = (on: boolean) => {
    btn.title = on
      ? 'Re-send this message without friction (uses one bypass; your teacher is notified).'
      : 'Re-send this message without friction. On this server it also pauses friction on this concept until reset. Uses one bypass; your teacher is notified.';
  };
  return { set, setBusy, setPromptBypass, host };
}
