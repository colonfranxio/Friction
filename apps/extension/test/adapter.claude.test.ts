import { describe, expect, it } from 'vitest';
import { claudeAdapter } from '../src/adapters/claude';
import { fixtureJson, fixtureText } from './helpers';

describe('claudeAdapter', () => {
  const first = fixtureJson('request-first.json');
  const followup = fixtureJson('request-followup.json');

  it('matches the completion request and extracts the conversation id', () => {
    expect(claudeAdapter.matchRequest(first.url, 'POST')).toEqual({ conversationId: '9b2f6c1e-3d4a-4b5c-8d6e-7f8091a2b3c4' });
    expect(claudeAdapter.matchRequest(followup.url + '?foo=1', 'post')).not.toBeNull();
  });

  it('ignores other requests', () => {
    expect(claudeAdapter.matchRequest(first.url, 'GET')).toBeNull();
    expect(claudeAdapter.matchRequest(first.url.replace('/completion', '/title'), 'POST')).toBeNull();
    expect(claudeAdapter.matchRequest(first.url.replace('/completion', '/retry_completion'), 'POST')).toBeNull();
    expect(claudeAdapter.matchRequest('https://claude.ai/api/organizations/x/chat_conversations', 'POST')).toBeNull();
  });

  it('reads and writes the prompt without touching other fields', () => {
    expect(claudeAdapter.readPrompt(followup.body)).toBe('How do I stop my useEffect from running in an infinite loop?');
    const out = claudeAdapter.writePrompt(followup.body, 'NEW') as Record<string, unknown>;
    expect(out.prompt).toBe('NEW');
    expect(out.parent_message_uuid).toBe(followup.body.parent_message_uuid);
    expect(followup.body.prompt).not.toBe('NEW'); // original not mutated
  });

  it('returns null for bodies without a usable prompt', () => {
    expect(claudeAdapter.readPrompt({})).toBeNull();
    expect(claudeAdapter.readPrompt({ prompt: '   ' })).toBeNull();
    expect(claudeAdapter.readPrompt(null)).toBeNull();
    expect(claudeAdapter.readPrompt([1])).toBeNull();
  });

  it('parses the Messages-style stream', () => {
    expect(claudeAdapter.parseStream(fixtureText('response-messages.sse.txt'))).toBe('Hello there, friend!');
  });

  it('parses the legacy completion stream', () => {
    expect(claudeAdapter.parseStream(fixtureText('response-legacy.sse.txt'))).toBe('Hello there, friend!');
  });

  it('parses CRLF streams (fixtures are stored LF by .gitattributes, so convert here)', () => {
    const crlf = fixtureText('response-messages.sse.txt').replace(/\n/g, '\r\n');
    expect(crlf).toContain('\r\n');
    expect(claudeAdapter.parseStream(crlf)).toBe('Hello there, friend!');
  });

  it('returns empty text for garbage', () => {
    expect(claudeAdapter.parseStream('not sse at all')).toBe('');
  });
});
