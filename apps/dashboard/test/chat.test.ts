import { describe, expect, it } from 'vitest';
import { CHAT_HEADERS } from '@friction/shared';
import { deliveredHistory, quizLabel, turnMetadata, type ChatBubble } from '../src/lib/chat';

describe('chat metadata and delivered history', () => {
  it.each([['true', true], ['false', false], ['', undefined], ['unknown', undefined]] as const)('reads exact quiz header %s without inferring from level', (value, expected) => {
    const headers = new Headers({ [CHAT_HEADERS.quizAttached]: value, [CHAT_HEADERS.level]: '1' });
    expect(turnMetadata(headers).quizAttached).toBe(expected);
  });
  it('keeps absent metadata explicitly approximate at any level', () => {
    expect(turnMetadata(new Headers()).level).toBeUndefined();
    expect(turnMetadata(new Headers({ [CHAT_HEADERS.level]: '4' })).quizAttached).toBeUndefined();
    expect(quizLabel({})).toContain('approximate');
    expect(quizLabel({ quizAttached: false })).toBe('Not attached');
    expect(quizLabel({ quizAttached: true, status: 'interrupted' })).toBe('Attached · reply interrupted');
  });
  it('excludes partial, streaming and superseded pairs from future history', () => {
    const prompt: ChatBubble = { id: 'question', role: 'user', content: 'question', createdAt: 1 };
    const reply: ChatBubble = { id: 'reply', promptId: prompt.id, role: 'assistant', content: 'delivered', createdAt: 2, status: 'complete' };
    expect(deliveredHistory([prompt, reply])).toEqual([{ role: 'user', content: 'question' }, { role: 'assistant', content: 'delivered' }]);
    for (const status of ['interrupted', 'streaming', 'superseded'] as const) expect(deliveredHistory([prompt, { ...reply, status }])).toEqual([]);
    expect(deliveredHistory([reply])).toEqual([]);
  });
});
