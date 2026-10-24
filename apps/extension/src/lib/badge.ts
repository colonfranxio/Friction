/** On-page status pill (ui-layouts §6). Shadow DOM so claude.ai's CSS can't touch it; never takes clicks. */
import { LEVEL_LABELS, type BloomLevel } from '@friction/shared';

export type BadgeState =
  | { kind: 'ready' }
  | { kind: 'active'; level: BloomLevel; concept: string | null }
  | { kind: 'none' }
  | { kind: 'offline' }
  | { kind: 'disabled' }
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
    case 'reload':
      return { text: 'Friction updated · reload this tab', dot: DOT.amber };
    default:
      return { text: 'Friction · ready', dot: DOT.green };
  }
}

export function mountBadge(doc: Document): { set(state: BadgeState): void; host: HTMLElement } {
  const host = doc.createElement('friction-badge');
  host.setAttribute('data-friction', 'badge');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { all: initial; position: fixed; right: 12px; bottom: 12px; z-index: 2147483646; pointer-events: none; }
      .pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px;
        background: #FFFFFF; color: #1F2937; border: 1px solid #E5E7EB; box-shadow: 0 2px 8px rgba(0,0,0,.08);
        font: 600 12px/1.2 Nunito, ui-rounded, system-ui, sans-serif; max-width: 360px; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis; }
      .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
      .logo { color: #F59E0B; }
    </style>
    <div class="pill"><span class="dot"></span><span class="logo">◆</span><span class="text"></span></div>`;
  const dot = root.querySelector('.dot') as HTMLElement;
  const text = root.querySelector('.text') as HTMLElement;
  const set = (state: BadgeState) => {
    const t = badgeText(state);
    text.textContent = t.text;
    dot.style.background = t.dot;
  };
  set({ kind: 'ready' });
  (doc.body ?? doc.documentElement).appendChild(host);
  return { set, host };
}
