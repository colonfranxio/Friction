/** Side panel page: the student's live learning map next to the AI chat. Logic lives in lib/learning-map.ts. */
import { startLearningMap, type MapView } from './lib/learning-map';
import { getSettings } from './lib/storage';

const root = document.getElementById('root') as HTMLElement;
const WATCHED = ['enabled', 'studentId', 'dashboardUrl'];
let controller: ReturnType<typeof startLearningMap>;

function message(title: string, body: string, retry: boolean) {
  root.replaceChildren(); // removes any iframe (stops its dashboard/API/SSE work)
  const box = document.createElement('div');
  box.className = 'msg';
  const h = document.createElement('h2');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = body;
  box.append(h, p);
  if (retry) {
    const b = document.createElement('button');
    b.textContent = 'Retry';
    b.onclick = () => void controller.reload();
    box.append(b);
  }
  root.append(box);
}

function render(view: MapView) {
  switch (view.kind) {
    case 'off':
      return message('Friction is off', 'Turn Friction back on in the toolbar popup to see your learning map.', false);
    case 'invalid':
      return message('Can’t show the learning map', view.reason + ' Fix it in the popup under Settings → Dashboard URL.', false);
    case 'loading':
      return message('Loading your learning map…', '', false);
    case 'unreachable':
      return message(
        'Dashboard not reachable',
        `Nothing answered at ${new URL(view.url).origin} (also tried localhost/127.0.0.1). Start it with “pnpm dev:dash”, or set the right address in the popup under Settings → Dashboard URL.`,
        true,
      );
    case 'frame': {
      const existing = root.querySelector('iframe');
      if (existing && existing.src === view.url) return; // already showing it
      const frame = document.createElement('iframe');
      frame.src = view.url;
      frame.title = 'Your learning map';
      root.replaceChildren(frame);
      return;
    }
  }
}

controller = startLearningMap({
  getSettings,
  // Extension pages have host access to localhost/127.0.0.1, so a plain GET tells us if the dashboard is up.
  probe: async (url, signal) => {
    try {
      // no-cors: resolves (opaque) if anything answers, rejects on connection refused; needs no CORS headers.
      await fetch(new URL(url).origin + '/', { method: 'GET', mode: 'no-cors', cache: 'no-store', signal });
      return true;
    } catch {
      return false;
    }
  },
  onSettingsChange: (cb) => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !WATCHED.some((k) => k in changes)) return;
      // Consent revoked: drop the iframe immediately, before the async reload even reads storage.
      if (changes.enabled && changes.enabled.newValue === false) render({ kind: 'off' });
      cb();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },
  render,
});
