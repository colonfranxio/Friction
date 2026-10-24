import { CHAT_HEADERS, type BloomLevel, type ChatMessage } from '@friction/shared';

export type ChatBubble = ChatMessage & {
  id: string;
  promptId?: string;
  createdAt: number;
  concept?: string;
  nodeId?: string;
  level?: BloomLevel;
  quizAttached?: boolean;
  status?: 'streaming' | 'complete' | 'interrupted' | 'superseded';
  bypassAttempted?: boolean;
};

export function turnMetadata(headers: Headers) {
  const value = Number(headers.get(CHAT_HEADERS.level));
  const quiz = headers.get(CHAT_HEADERS.quizAttached);
  return {
    level: value >= 1 && value <= 4 ? value as BloomLevel : undefined,
    nodeId: headers.get(CHAT_HEADERS.nodeId) || undefined,
    quizAttached: quiz === 'true' ? true : quiz === 'false' ? false : undefined,
  };
}

/** Only delivered pairs belong in a future request; never replay an unseen quiz. */
export function deliveredHistory(messages: ChatBubble[]): ChatMessage[] {
  const history: ChatMessage[] = [];
  for (const reply of messages) {
    if (reply.role !== 'assistant' || reply.status !== 'complete') continue;
    const prompt = messages.find((message) => message.id === reply.promptId && message.role === 'user');
    if (prompt) history.push({ role: 'user', content: prompt.content }, { role: 'assistant', content: reply.content });
  }
  return history;
}

export function quizLabel(turn: Pick<ChatBubble, 'quizAttached' | 'status'>) {
  const exact = turn.quizAttached === true ? 'Attached' : turn.quizAttached === false ? 'Not attached' : 'Not reported · check reply (approximate)';
  return turn.status === 'interrupted' ? `${exact} · reply interrupted` : exact;
}
