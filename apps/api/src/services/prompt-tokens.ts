import { randomUUID } from 'node:crypto';
import type { UUID } from '@friction/shared';

/** What a prompt-scoped /bypass authorizes: exactly one resend of this text, in this chat, for this student. */
export interface PromptBypassGrant {
  student_id: UUID;
  node_id: UUID;
  raw_prompt: string;
  conversation_id: string;
}

export const PROMPT_TOKEN_TTL_MS = 120_000;

/**
 * One-use tokens for the sandbox "bypass this prompt" flow (contract v4). In memory on purpose: a restart
 * may discard them (the student just asks again). Tokens and raw text never leave this class except as the
 * opaque token string handed back to the student's own client.
 */
export class PromptTokens {
  private readonly grants = new Map<string, PromptBypassGrant & { expires: number }>();

  constructor(private readonly clock: () => number = Date.now) {}

  get size(): number {
    return this.grants.size;
  }

  issue(grant: PromptBypassGrant): string {
    this.sweep();
    const token = randomUUID();
    this.grants.set(token, { ...grant, expires: this.clock() + PROMPT_TOKEN_TTL_MS });
    return token;
  }

  /**
   * Validate and consume in one synchronous step (no await between the check and the delete), so two
   * concurrent requests can never both win. A mismatch or an invalid grant does NOT consume the token.
   * Returns the grant, or null.
   */
  consume(token: string, expect: Omit<PromptBypassGrant, 'node_id'>, stillValid: (g: PromptBypassGrant) => boolean): PromptBypassGrant | null {
    const g = this.grants.get(token);
    if (!g) return null;
    if (g.expires <= this.clock()) {
      this.grants.delete(token);
      return null;
    }
    if (g.student_id !== expect.student_id || g.raw_prompt !== expect.raw_prompt || g.conversation_id !== expect.conversation_id) return null;
    if (!stillValid(g)) return null;
    this.grants.delete(token);
    return g;
  }

  /** Drop one student's tokens (per-student demo reset). */
  clearStudent(studentId: UUID): void {
    for (const [t, g] of this.grants) if (g.student_id === studentId) this.grants.delete(t);
  }

  clear(): void {
    this.grants.clear();
  }

  private sweep(): void {
    const t = this.clock();
    for (const [k, g] of this.grants) if (g.expires <= t) this.grants.delete(k);
  }
}
