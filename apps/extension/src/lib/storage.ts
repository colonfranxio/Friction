/** Typed chrome.storage.local access. State lives here, not in memory: MV3 service workers sleep. */
import { DEFAULT_API_URL, SEED_IDS } from '@friction/shared';
import type { LastIntercept } from './messages';

export interface Settings {
  studentId: string;
  apiUrl: string;
  /** Consent toggle. false = the extension never calls the API. */
  enabled: boolean;
  /** A's exact 40-char API READY SHA, set only after E approves it. Empty = legacy concept bypass on real APIs. */
  promptBypassReadySha: string;
}

export const DEFAULT_SETTINGS: Settings = {
  studentId: SEED_IDS.demoStudent,
  apiUrl: DEFAULT_API_URL,
  enabled: true,
  promptBypassReadySha: '',
};

export async function getSettings(): Promise<Settings> {
  const s = await chrome.storage.local.get(['studentId', 'apiUrl', 'enabled', 'promptBypassReadySha']);
  return {
    studentId: typeof s.studentId === 'string' && s.studentId ? s.studentId : DEFAULT_SETTINGS.studentId,
    apiUrl: typeof s.apiUrl === 'string' && s.apiUrl ? s.apiUrl.replace(/\/$/, '') : DEFAULT_SETTINGS.apiUrl,
    enabled: typeof s.enabled === 'boolean' ? s.enabled : DEFAULT_SETTINGS.enabled,
    promptBypassReadySha: typeof s.promptBypassReadySha === 'string' ? s.promptBypassReadySha.trim() : '',
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(patch);
}

export async function getLastIntercept(): Promise<LastIntercept | null> {
  const { lastIntercept } = await chrome.storage.local.get('lastIntercept');
  return (lastIntercept as LastIntercept | undefined) ?? null;
}

export async function setLastIntercept(v: LastIntercept): Promise<void> {
  await chrome.storage.local.set({ lastIntercept: v });
}
