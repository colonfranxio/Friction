/** Everything site-specific lives behind this interface, so a site change touches one file. */
export interface RequestMatch {
  /** The site's conversation id, taken from the request URL. null if not present. */
  conversationId: string | null;
}

export interface SiteAdapter {
  name: 'claude_web' | 'chatgpt_web';
  /** Is this fetch the "send a message" request? */
  matchRequest(url: string, method: string): RequestMatch | null;
  /** Prompt text from the parsed JSON body, or null if this body has none (e.g. retries). */
  readPrompt(body: unknown): string | null;
  /** Returns a copy of the body with the prompt replaced. */
  writePrompt(body: unknown, prompt: string): unknown;
  /** Full assistant text from the raw streamed (SSE) response body. */
  parseStream(raw: string): string;
  /** CSS selectors (first match wins) for rendered assistant messages, newest last. */
  assistantMessageSelectors: string[];
  /** CSS selectors for rendered user message bubbles (where the friction block must be hidden). */
  userMessageSelectors: string[];
}
