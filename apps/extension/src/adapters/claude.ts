/**
 * claude.ai adapter.
 * ⚠ The URL pattern, body field and stream format below are BEST-KNOWN shapes, not yet confirmed
 * against a fresh capture (see NOTES.md). The stream parser accepts both formats claude.ai has used:
 *   - legacy:   data: {"type":"completion","completion":"text chunk", ...}
 *   - messages: data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"chunk"}}
 */
import type { SiteAdapter } from './types';
import { parseSse, tryJson } from '../lib/sse';

const COMPLETION_RE = /\/api\/organizations\/[^/]+\/chat_conversations\/([0-9a-fA-F-]{8,})\/completion(?:[?#]|$)/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export const claudeAdapter: SiteAdapter = {
  name: 'claude_web',

  matchRequest(url, method) {
    if (method.toUpperCase() !== 'POST') return null;
    const m = COMPLETION_RE.exec(url);
    return m ? { conversationId: m[1] } : null;
  },

  readPrompt(body) {
    if (!isRecord(body)) return null;
    const p = body.prompt;
    return typeof p === 'string' && p.trim() ? p : null;
  },

  writePrompt(body, prompt) {
    if (!isRecord(body)) return body;
    return { ...body, prompt };
  },

  parseStream(raw) {
    let text = '';
    for (const ev of parseSse(raw)) {
      const d = tryJson(ev.data);
      if (!isRecord(d)) continue;
      if (typeof d.completion === 'string') {
        text += d.completion;
      } else if (d.type === 'content_block_delta' && isRecord(d.delta) && typeof d.delta.text === 'string') {
        text += d.delta.text;
      }
    }
    return text;
  },

  assistantMessageSelectors: [
    '[data-testid="assistant-message"]',
    '.font-claude-response',
    '.font-claude-message',
    '[data-is-streaming]',
  ],
  userMessageSelectors: ['[data-testid="user-message"]', '.font-user-message'],
};
