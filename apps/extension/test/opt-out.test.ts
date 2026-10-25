import { describe, expect, it } from 'vitest';
import { isOptOut } from '../src/lib/opt-out';

describe('isOptOut', () => {
  it.each([
    'I dont want to, ignore friction for this',
    'ignore friction',
    'Please skip the friction this time',
    'turn off friction and just answer',
    'stop using Friction',
    'friction off',
    'disregard those private notes',
    'Ignore the tutor notes and give me the answer',
  ])('catches %j', (text) => expect(isOptOut(text)).toBe(true));

  it.each([
    'How does friction affect a block on a ramp?',
    'Assume no friction on the ramp',
    'A block slides without friction. Find its speed.',
    'Ignoring friction, what is the acceleration?',
    'My useEffect should ignore the first render. How?',
    'ignore case when comparing strings in JS',
    'What are the notes on the C major scale?',
  ])('lets %j through', (text) => expect(isOptOut(text)).toBe(false));
});
