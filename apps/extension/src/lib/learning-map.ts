/**
 * Learning map in Chrome's side panel: the student's live skill tree next to claude.ai.
 * It frames the dashboard's Student page (`/student/:id?embed=1`; C's compact embed view when available,
 * otherwise the full Student page). Nothing is drawn inside claude.ai's own page.
 *
 * Pure logic + a small controller with injected dependencies so every rule is unit-testable:
 *  - consent off  → "Friction is off", no iframe, no network request at all
 *  - consent revoked while open → iframe removed immediately, in-flight checks cancelled
 *  - settings change → reload; stale checks/loads can never win over a newer one
 *  - unreachable dashboard → short message + Retry (no broken frame)
 *  - only origins the extension already has host access to (localhost / 127.0.0.1)
 */
import type { Settings } from './storage';

/** Hosts covered by the manifest's existing host_permissions. We never request broader access. */
export const ALLOWED_DASHBOARD_HOSTS = ['localhost', '127.0.0.1'];

export type MapUrl = { ok: true; url: string } | { ok: false; reason: string };

/** `${dashboardUrl}/student/<encoded id>?embed=1`, validated. No prompts, tokens or keys in the URL. */
export function buildMapUrl(dashboardUrl: string, studentId: string): MapUrl {
  let base: URL;
  try {
    base = new URL(dashboardUrl.trim());
  } catch {
    return { ok: false, reason: 'The Dashboard URL in Friction settings is not a valid address.' };
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    return { ok: false, reason: 'The Dashboard URL must start with http:// or https://.' };
  }
  if (!ALLOWED_DASHBOARD_HOSTS.includes(base.hostname)) {
    return {
      ok: false,
      reason: `Friction can only show a dashboard on localhost or 127.0.0.1 (the extension has no access to ${base.hostname}).`,
    };
  }
  if (!studentId.trim()) return { ok: false, reason: 'No student is set in Friction settings.' };
  const url = new URL(base.toString());
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/student/${encodeURIComponent(studentId.trim())}`;
  url.search = '';
  url.hash = '';
  url.searchParams.set('embed', '1');
  return { ok: true, url: url.toString() };
}

/** localhost ⇄ 127.0.0.1: Vite may bind only one of them (one machine refused 127.0.0.1, another localhost). */
export function alternateLoopback(url: string): string | null {
  const u = new URL(url);
  if (u.hostname === '127.0.0.1') u.hostname = 'localhost';
  else if (u.hostname === 'localhost') u.hostname = '127.0.0.1';
  else return null;
  return u.toString();
}

export type MapView =
  | { kind: 'off' }
  | { kind: 'loading' }
  | { kind: 'frame'; url: string }
  | { kind: 'unreachable'; url: string }
  | { kind: 'invalid'; reason: string };

export interface LearningMapDeps {
  getSettings(): Promise<Pick<Settings, 'enabled' | 'studentId' | 'dashboardUrl'>>;
  /** Resolve true if the dashboard origin answers within the signal's lifetime (no request when disabled). */
  probe(url: string, signal: AbortSignal): Promise<boolean>;
  /** Subscribe to settings changes; returns unsubscribe. */
  onSettingsChange(cb: () => void): () => void;
  render(view: MapView): void;
  probeTimeoutMs?: number;
}

export interface LearningMapController {
  reload(): Promise<void>;
  dispose(): void;
}

export function startLearningMap(deps: LearningMapDeps): LearningMapController {
  let generation = 0;
  let inFlight: AbortController | null = null;
  let disposed = false;

  async function reachable(url: string, g: number): Promise<boolean> {
    const ctrl = new AbortController();
    inFlight = ctrl;
    const timer = setTimeout(() => ctrl.abort(), deps.probeTimeoutMs ?? 2500);
    try {
      return await deps.probe(url, ctrl.signal);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
      if (inFlight === ctrl && g === generation) inFlight = null;
    }
  }

  async function reload(): Promise<void> {
    if (disposed) return;
    const g = ++generation;
    inFlight?.abort(); // cancel any older readiness check
    inFlight = null;
    const s = await deps.getSettings();
    if (g !== generation || disposed) return;
    if (!s.enabled) {
      deps.render({ kind: 'off' }); // consent off: no iframe, no requests
      return;
    }
    const built = buildMapUrl(s.dashboardUrl, s.studentId);
    if (!built.ok) {
      deps.render({ kind: 'invalid', reason: built.reason });
      return;
    }
    deps.render({ kind: 'loading' });
    const candidates = [built.url, alternateLoopback(built.url)].filter((u): u is string => !!u);
    for (const url of candidates) {
      const ok = await reachable(url, g);
      if (g !== generation || disposed) return; // a newer reload or consent change won
      if (ok) {
        deps.render({ kind: 'frame', url });
        return;
      }
    }
    deps.render({ kind: 'unreachable', url: built.url });
  }

  const unsubscribe = deps.onSettingsChange(() => void reload());
  void reload();
  return {
    reload,
    dispose() {
      disposed = true;
      generation++;
      inFlight?.abort();
      unsubscribe();
    },
  };
}
