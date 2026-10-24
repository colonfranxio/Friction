import { describe, expect, it, vi } from 'vitest';
import { alternateLoopback, buildMapUrl, startLearningMap, type MapView } from '../src/lib/learning-map';

const STUDENT = '22222222-2222-4222-8222-222222222222';
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('buildMapUrl', () => {
  it('builds /student/<encoded id>?embed=1 from the dashboard URL', () => {
    expect(buildMapUrl('http://127.0.0.1:5173', STUDENT)).toEqual({ ok: true, url: `http://127.0.0.1:5173/student/${STUDENT}?embed=1` });
    expect(buildMapUrl('http://localhost:5173/', 'a b/c')).toEqual({ ok: true, url: 'http://localhost:5173/student/a%20b%2Fc?embed=1' });
    expect(buildMapUrl('http://localhost:5173/app/?x=1#h', 's')).toEqual({ ok: true, url: 'http://localhost:5173/app/student/s?embed=1' });
  });
  it('rejects non-http(s), unsupported hosts, garbage and missing student', () => {
    expect(buildMapUrl('ftp://localhost:5173', STUDENT).ok).toBe(false);
    expect(buildMapUrl('javascript:alert(1)', STUDENT).ok).toBe(false);
    const other = buildMapUrl('http://evil.example.com', STUDENT);
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.reason).toMatch(/localhost or 127\.0\.0\.1/);
    expect(buildMapUrl('not a url', STUDENT).ok).toBe(false);
    expect(buildMapUrl('http://localhost:5173', '  ').ok).toBe(false);
  });
  it('only plain http (the manifest grants http:// loopback access only)', () => {
    const r = buildMapUrl('https://localhost:5173', STUDENT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/http:\/\//);
  });
  it('strips credentials and rejects dot-only student ids', () => {
    expect(buildMapUrl('http://user:pw@localhost:5173', 's')).toEqual({ ok: true, url: 'http://localhost:5173/student/s?embed=1' });
    expect(buildMapUrl('http://localhost:5173', '..').ok).toBe(false);
    expect(buildMapUrl('http://localhost:5173', '.').ok).toBe(false);
  });
  it('rejects look-alike hosts', () => {
    expect(buildMapUrl('http://localhost@evil.com', STUDENT).ok).toBe(false);
    expect(buildMapUrl('http://127.0.0.1.evil.com', STUDENT).ok).toBe(false);
  });
  it('swaps localhost and 127.0.0.1', () => {
    expect(alternateLoopback('http://127.0.0.1:5173/student/x?embed=1')).toBe('http://localhost:5173/student/x?embed=1');
    expect(alternateLoopback('http://localhost:5173/')).toBe('http://127.0.0.1:5173/');
  });
});

function harness(initial: { enabled: boolean; dashboardUrl?: string; studentId?: string }, probe: (url: string, signal: AbortSignal) => Promise<boolean>) {
  const settings = { studentId: STUDENT, dashboardUrl: 'http://127.0.0.1:5173', ...initial };
  const views: MapView[] = [];
  let changed: () => void = () => {};
  const probeSpy = vi.fn(probe);
  const ctl = startLearningMap({
    getSettings: async () => ({ ...settings }),
    probe: probeSpy,
    onSettingsChange: (cb) => ((changed = cb), () => (changed = () => {})),
    render: (v) => views.push(v),
    probeTimeoutMs: 50,
  });
  return { settings, views, probeSpy, ctl, change: () => changed(), last: () => views[views.length - 1] };
}

describe('learning-map controller', () => {
  it('consent off: shows "off" and makes no request at all', async () => {
    const h = harness({ enabled: false }, async () => true);
    await flush();
    expect(h.last()).toEqual({ kind: 'off' });
    expect(h.probeSpy).not.toHaveBeenCalled();
    expect(h.views.some((v) => v.kind === 'frame')).toBe(false);
  });

  it('enabled + reachable: frames the student map', async () => {
    const h = harness({ enabled: true }, async () => true);
    await vi.waitFor(() => expect(h.last()).toEqual({ kind: 'frame', url: `http://127.0.0.1:5173/student/${STUDENT}?embed=1` }));
  });

  it('reloads when settings change (student or URL)', async () => {
    const h = harness({ enabled: true }, async () => true);
    await vi.waitFor(() => expect(h.last().kind).toBe('frame'));
    h.settings.studentId = 'other-student';
    h.change();
    await vi.waitFor(() => expect(h.last()).toEqual({ kind: 'frame', url: 'http://127.0.0.1:5173/student/other-student?embed=1' }));
  });

  it('consent revoked while open: switches to "off" and never frames again', async () => {
    const h = harness({ enabled: true }, async () => true);
    await vi.waitFor(() => expect(h.last().kind).toBe('frame'));
    const calls = h.probeSpy.mock.calls.length;
    h.settings.enabled = false;
    h.change();
    await vi.waitFor(() => expect(h.last()).toEqual({ kind: 'off' }));
    await flush();
    expect(h.probeSpy.mock.calls.length).toBe(calls); // no new requests while disabled
  });

  it('a stale readiness check cannot win over a newer reload (or over consent off)', async () => {
    let releaseOld!: (v: boolean) => void;
    let first = true;
    const h = harness({ enabled: true }, (_url, signal) => {
      if (first) {
        first = false;
        return new Promise<boolean>((r) => {
          releaseOld = r;
          signal.addEventListener('abort', () => r(false));
        });
      }
      return Promise.resolve(true);
    });
    await flush();
    h.settings.enabled = false; // consent revoked while the first check is pending
    h.change();
    await vi.waitFor(() => expect(h.last()).toEqual({ kind: 'off' }));
    releaseOld(true); // the old check "succeeds" late
    await flush();
    expect(h.last()).toEqual({ kind: 'off' });
    expect(h.views.some((v) => v.kind === 'frame')).toBe(false);
  });

  it('unreachable: shows Retry state; retry frames once the dashboard is up', async () => {
    let up = false;
    const h = harness({ enabled: true }, async () => up);
    await vi.waitFor(() => expect(h.last()).toEqual({ kind: 'unreachable', url: `http://127.0.0.1:5173/student/${STUDENT}?embed=1` }));
    expect(h.probeSpy).toHaveBeenCalledTimes(2); // 127.0.0.1 and the localhost fallback
    up = true;
    await h.ctl.reload();
    expect(h.last().kind).toBe('frame');
  });

  it('falls back to localhost when 127.0.0.1 refuses (and vice versa)', async () => {
    const h = harness({ enabled: true }, async (url) => url.includes('localhost'));
    await vi.waitFor(() => expect(h.last()).toEqual({ kind: 'frame', url: `http://localhost:5173/student/${STUDENT}?embed=1` }));
  });

  it('a hanging dashboard times out into the unreachable state', async () => {
    const h = harness({ enabled: true }, (_u, signal) => new Promise((r) => signal.addEventListener('abort', () => r(false))));
    await vi.waitFor(() => expect(h.last().kind).toBe('unreachable'), { timeout: 1000 });
  });

  it('invalid Dashboard URL: explains, makes no request', async () => {
    const h = harness({ enabled: true, dashboardUrl: 'https://example.com' }, async () => true);
    await flush();
    expect(h.last().kind).toBe('invalid');
    expect(h.probeSpy).not.toHaveBeenCalled();
  });

  it('dispose stops reacting to settings changes', async () => {
    const h = harness({ enabled: true }, async () => true);
    await vi.waitFor(() => expect(h.last().kind).toBe('frame'));
    h.ctl.dispose();
    const n = h.views.length;
    h.change();
    await flush();
    expect(h.views.length).toBe(n);
  });
});
