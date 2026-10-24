/**
 * Runs in claude.ai's own JS world at document_start (manifest: world MAIN).
 * Wraps window.fetch before the page uses it. Cannot call chrome.* or our API (page CSP),
 * so it talks to content.ts over window.postMessage.
 */
import { EXTENSION_TIMEOUT_MS } from '@friction/shared';
import { claudeAdapter } from './adapters/claude';
import { bridgeRequest, type MessageTarget } from './lib/bridge';
import { createPatchedFetch } from './lib/intercept-fetch';
import type { InterceptOutcome } from './lib/messages';

declare global {
  interface Window {
    __frictionPatched?: boolean;
  }
}

if (!window.__frictionPatched) {
  window.__frictionPatched = true;
  const target = window as unknown as MessageTarget;
  const origFetch = window.fetch.bind(window);

  window.fetch = createPatchedFetch({
    origFetch,
    adapter: claudeAdapter,
    intercept: (ask) => bridgeRequest<InterceptOutcome>(target, 'intercept', ask, EXTENSION_TIMEOUT_MS),
    reportResponse: (r) => {
      bridgeRequest(target, 'responses', r, 15000).catch(() => {});
    },
    onError: (stage, err) => console.debug('[friction]', stage, err),
    onUnmatched: (url) => console.warn('[friction] unmatched completion-like POST (adapter may be outdated):', url),
  });
}
