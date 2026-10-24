/** Popup UI (ui-layouts §5). All data comes from the service worker. */
import { LEVEL_LABELS } from '@friction/shared';
import type { BypassResendResult, RuntimeRequest, StatusResponse, TabRequest } from './lib/messages';
import { getSettings, saveSettings } from './lib/storage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const send = <T,>(m: RuntimeRequest) => chrome.runtime.sendMessage(m) as Promise<T>;

async function render() {
  let s: StatusResponse;
  try {
    s = await send<StatusResponse>({ type: 'friction:status' });
  } catch {
    $('status').textContent = 'Offline';
    $('status-dot').style.background = '#9CA3AF';
    $<HTMLButtonElement>('bypass').disabled = true;
    return;
  }
  $('status').textContent = !s.enabled ? 'Paused' : s.online ? 'Online' : 'Offline';
  $('status-dot').style.background = s.online ? '#10B981' : '#9CA3AF';
  $<HTMLInputElement>('enabled').checked = s.enabled;

  const last = s.last;
  if (last?.node_id && last.level) {
    const lvl = s.paused ? 4 : last.level;
    $('concept').textContent = last.concept_name ?? 'Current concept';
    $('chip').textContent = `L${lvl} · ${LEVEL_LABELS[lvl].role}`;
    $('chip').className = lvl === 4 ? 'chip chip-green' : 'chip';
    $('friction').textContent = s.paused ? 'Bypassed' : LEVEL_LABELS[lvl].friction;
    $('current').hidden = false;
    $('no-current').hidden = true;
  } else {
    $('current').hidden = true;
    $('no-current').hidden = false;
  }

  const btn = $<HTMLButtonElement>('bypass');
  const quota = s.bypass_quota;
  // Honest wording: a prompt-scoped bypass skips one message; the legacy one pauses the concept until reset.
  const what = s.prompt_bypass ? 'message' : 'concept';
  btn.textContent = quota === null ? `Bypass this ${what}` : `Bypass this ${what} (${quota} left)`;
  $('bypass-note').textContent = s.prompt_bypass
    ? 'Re-sends your last message to Claude without friction. Uses one bypass and notifies your teacher.'
    : 'Re-sends your last message without friction and pauses friction on this concept until reset. Uses one bypass and notifies your teacher.';
  btn.disabled = !s.online || !s.enabled || !last?.node_id || s.paused || quota === 0;
}

async function init() {
  const settings = await getSettings();
  $<HTMLInputElement>('student').value = settings.studentId;
  $<HTMLInputElement>('api').value = settings.apiUrl;
  $<HTMLInputElement>('ready-sha').value = settings.promptBypassReadySha;
  $<HTMLInputElement>('dash').value = settings.dashboardUrl;

  // Learning map: chrome.sidePanel.open needs the click's user gesture, so resolve the window first
  // and call open() synchronously from the handler (no await before it).
  let windowId: number | undefined;
  chrome.windows?.getCurrent?.().then((w) => (windowId = w.id)).catch(() => {});
  $('open-map').addEventListener('click', () => {
    $('map-msg').textContent = '';
    if (!chrome.sidePanel?.open) {
      $('map-msg').textContent = 'Your Chrome is too old for side panels (needs Chrome 116+).';
      return;
    }
    if (windowId === undefined) {
      $('map-msg').textContent = 'Couldn’t find this window. Close and reopen the popup, then try again.';
      return;
    }
    chrome.sidePanel.open({ windowId }).then(
      () => window.close(),
      (e) => ($('map-msg').textContent = `Chrome didn’t open the side panel (${String(e?.message ?? e)}).`),
    );
  });

  $<HTMLInputElement>('enabled').addEventListener('change', async (e) => {
    await saveSettings({ enabled: (e.target as HTMLInputElement).checked });
    await render();
  });

  $('bypass').addEventListener('click', async () => {
    const btn = $<HTMLButtonElement>('bypass');
    if (btn.disabled) return;
    btn.disabled = true; // no double bypass on double-click
    $('msg').textContent = '';
    try {
      // The claude.ai tab does the bypass itself: it knows the prompt to re-send.
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error('no tab');
      const r = (await chrome.tabs.sendMessage(tab.id, { type: 'friction:bypass-resend' } satisfies TabRequest)) as BypassResendResult;
      const scopeNote = r.ok && r.scope_applied === 'concept' ? ' Friction stays off for this concept until reset.' : '';
      $('msg').textContent = !r.ok
        ? r.message
        : (r.resent
            ? `Re-sent without friction. ${r.remaining_quota} left. Your teacher has been notified.`
            : `Bypass used (${r.remaining_quota} left). Your message is in the box; press Send and it goes out without friction.`) + scopeNote;
    } catch {
      $('msg').textContent = 'Open your claude.ai tab (reload it if needed), then click Bypass.';
    }
    await render();
  });

  $('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings({
      studentId: $<HTMLInputElement>('student').value.trim(),
      apiUrl: $<HTMLInputElement>('api').value.trim().replace(/\/$/, ''),
      promptBypassReadySha: $<HTMLInputElement>('ready-sha').value.trim(),
      dashboardUrl: $<HTMLInputElement>('dash').value.trim().replace(/\/+$/, ''),
    });
    $('msg').textContent = 'Settings saved.';
    await render();
  });

  $('version').textContent = `v${chrome.runtime.getManifest().version}`;
  await render();
}

void init();
