/**
 * Bypass = one use of the quota (teacher notified, via POST /bypass) + re-send the same prompt unmodified.
 * Contract v4: requested with scope 'prompt' (quota + teacher notification only; mastery and pause untouched).
 * A pre-v4 server ignores scope and pauses the concept; background reports that as scope_applied 'concept'.
 *
 * Everything is checked before the quota is spent AND again after the server answers (and once more inside
 * sendUnmodified, right before Send): the user may have switched chats, typed a new draft, turned Friction
 * off or started another send while waiting. Then nothing is sent or armed; the badge says the bypass was
 * used and offers the original question to copy. Quota is never re-requested automatically.
 */
import type { BadgeState } from './badge';
import type { BypassResendResult, BypassResult } from './messages';
import type { SendInterceptor } from './send-interceptor';

/** The last message in this tab that got friction: what a bypass re-sends. `conv` is its logical conversation id. */
export interface BypassTarget {
  raw: string;
  node_id: string;
  concept: string | null;
  conv: string;
}

const ARMED_TTL_MS = 2 * 60 * 1000;

const REASONS = {
  disabled: 'Friction was turned off',
  stale: 'you switched chats',
  draft: 'you started a new draft',
  busy: 'another message was sending',
  sent: 'another message was sent',
  no_composer: 'the message box was not found',
  changed: 'the page changed',
} as const;
type Reason = keyof typeof REASONS;

export function createBypassFlow(deps: {
  interceptor: Pick<SendInterceptor, 'canSendUnmodified' | 'sendUnmodified'>;
  /** Logical id of the chat now on screen (conversation tracker). */
  currentConversation(): string | null;
  /** Consent toggle (Settings.enabled), kept current by the content script. */
  isEnabled(): boolean;
  requestBypass(node_id: string): Promise<BypassResult>;
  badge: { set(state: BadgeState): void; setBusy(busy: boolean): void };
  isContextInvalidated(err: unknown): boolean;
  now?(): number;
}) {
  const now = deps.now ?? Date.now;
  let target: BypassTarget | null = null;
  /** Text that must go out unmodified on the next send in `conv` (a bypass whose automatic re-send didn't go through). */
  let armed: { text: string; conv: string; until: number } | null = null;
  let bypassing = false;
  /** Count of messages that went out in this tab (any mode); a change during a bypass means the user moved on. */
  let sends = 0;

  const sameChat = (t: BypassTarget) => deps.currentConversation() === t.conv;
  /** Why `t` can't be re-sent right now, or null. */
  function blocker(t: BypassTarget): Reason | null {
    if (!deps.isEnabled()) return 'disabled';
    if (!sameChat(t)) return 'stale';
    const can = deps.interceptor.canSendUnmodified(t.raw);
    return can === 'ok' ? null : can;
  }

  function spentNotSent(t: BypassTarget, r: Extract<BypassResult, { ok: true }>, reason: Reason): BypassResendResult {
    deps.badge.set({ kind: 'spent', remaining: r.remaining_quota, reason: REASONS[reason], prompt: t.raw });
    return { ok: true, remaining_quota: r.remaining_quota, resent: false, scope_applied: r.scope_applied, not_sent_reason: REASONS[reason], prompt: t.raw };
  }

  async function run(): Promise<BypassResendResult> {
    const t = target;
    if (!t) return { ok: false, code: 'no_prompt', message: 'Nothing to bypass in this tab yet.' };
    if (bypassing) return { ok: false, code: 'busy', message: 'Bypass already in progress.' };
    // Check everything BEFORE spending a bypass from the quota.
    const before = blocker(t);
    if (before === 'stale') {
      target = null;
      deps.badge.set({ kind: 'ready' });
      return { ok: false, code: 'stale', message: 'That message was in another chat.' };
    }
    if (before === 'disabled') return { ok: false, code: 'disabled', message: 'Friction is turned off.' };
    if (before === 'draft') {
      deps.badge.set({ kind: 'error', message: 'clear your draft to bypass' });
      return { ok: false, code: 'draft', message: 'Send or clear your new draft first, then bypass.' };
    }
    if (before === 'no_composer') return { ok: false, code: 'no_composer', message: 'Message box not found. Reload your AI chat tab.' };
    if (before) return { ok: false, code: 'busy', message: 'Wait for the current message to send, then bypass.' };
    bypassing = true;
    deps.badge.setBusy(true);
    const sendsBefore = sends;
    try {
      let r: BypassResult;
      try {
        r = await deps.requestBypass(t.node_id);
      } catch (e) {
        deps.badge.set(deps.isContextInvalidated(e) ? { kind: 'reload' } : { kind: 'error', message: 'server unreachable' });
        return { ok: false, code: 'offline', message: 'Friction server is unreachable.' };
      }
      if (!r.ok) {
        deps.badge.set({ kind: 'error', message: r.code === 'quota_exhausted' ? 'no bypasses left' : 'bypass failed' });
        return r;
      }
      if (target === t) target = null; // one bypass per prompt
      // The quota is spent. Re-check: the user may have moved on while the server answered.
      const after = blocker(t) ?? (sends !== sendsBefore ? 'sent' : null);
      if (after) return spentNotSent(t, r, after);
      const sent = await deps.interceptor.sendUnmodified(t.raw, () => deps.isEnabled() && sameChat(t) && sends === sendsBefore);
      if (sent === 'aborted') return spentNotSent(t, r, blocker(t) ?? (sends !== sendsBefore ? 'sent' : 'changed'));
      if (sent === 'not-sent') armed = { text: t.raw, conv: t.conv, until: now() + ARMED_TTL_MS }; // left in the composer: the next Send (within 2 min) goes out unmodified
      deps.badge.set({ kind: 'bypassed', concept: t.concept, remaining: r.remaining_quota, conceptPaused: r.scope_applied === 'concept' });
      return { ok: true, remaining_quota: r.remaining_quota, resent: sent === 'sent', scope_applied: r.scope_applied };
    } finally {
      bypassing = false;
      deps.badge.setBusy(false);
    }
  }

  return {
    run,
    setTarget(t: BypassTarget | null) {
      target = t;
    },
    getTarget: () => target,
    /** A message went out (the interceptor's onSent, any mode except 'not-sent'). */
    noteSent() {
      sends++;
    },
    getArmed: () => armed,
    /** The chat on screen changed (or may have): drop the target and armed text if they belong to another chat. */
    onConversation(conv: string | null) {
      if (target && target.conv !== conv) {
        target = null;
        deps.badge.set({ kind: 'ready' });
      }
      if (armed && armed.conv !== conv) armed = null;
    },
    /** For the interceptor: true = send `raw` unmodified (the armed bypassed prompt, same chat, not expired). Consumes it. */
    skipIntercept(raw: string): boolean {
      if (armed && (now() > armed.until || armed.conv !== deps.currentConversation())) armed = null;
      if (!armed || raw !== armed.text.trim()) return false;
      armed = null;
      return true;
    },
  };
}
