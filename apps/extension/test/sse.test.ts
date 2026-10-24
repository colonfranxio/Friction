import { describe, expect, it } from 'vitest';
import { parseSse } from '../src/lib/sse';

describe('parseSse', () => {
  it('parses events, data, comments and defaults', () => {
    const evs = parseSse(': hello\n\nevent: a\ndata: 1\n\ndata: x\ndata: y\n\n');
    expect(evs).toEqual([
      { event: 'a', data: '1' },
      { event: 'message', data: 'x\ny' },
    ]);
  });
  it('handles CRLF and missing trailing blank line', () => {
    expect(parseSse('event: b\r\ndata: 2')).toEqual([{ event: 'b', data: '2' }]);
  });
});
