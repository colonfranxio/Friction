import { createServer, type Server, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { observeEvents } from '../smoke-events';

let server: Server;
let response: ServerResponse;
let observer: Awaited<ReturnType<typeof observeEvents>> | undefined;

async function connect() {
  server = createServer((_request, res) => {
    response = res;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.flushHeaders();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
  observer = await observeEvents(`http://127.0.0.1:${address.port}/events`);
  return observer;
}

afterEach(async () => {
  // Expected parser/disconnect failures are asserted by the test below.
  await observer?.close().catch(() => {});
  observer = undefined;
  if (server) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

describe('smoke SSE observer', () => {
  it('parses fragmented CRLF frames and ignores comment pings', async () => {
    const live = await connect();
    response.write(': connected\r\n\r\nevent: tree_updated\r\ndata: {"tree_');
    response.write('id":"seed"}\r');
    response.write('\n\r\n: ping\r\n\r\n');
    expect(await live.waitFor(e => e.type === 'tree_updated', 'tree update')).toEqual({
      type: 'tree_updated', data: { tree_id: 'seed' },
    });
    expect(live.events).toHaveLength(1);
    await expect(live.close()).resolves.toBeUndefined();
  });

  it('fails verification and cleanup when a later event has malformed JSON', async () => {
    const live = await connect();
    response.write('event: tree_updated\ndata: {"tree_id":"seed"}\n\n');
    await live.waitFor(e => e.type === 'tree_updated', 'tree update');
    response.write('event: activity\ndata: INVALID_JSON\n\n');
    await expect(live.waitFor(e => e.type === 'activity', 'activity')).rejects.toBeInstanceOf(SyntaxError);
    await expect(live.close()).rejects.toBeInstanceOf(SyntaxError);
  });

  it('fails instead of accepting partial history after server disconnect', async () => {
    const live = await connect();
    response.end(': closing\n\n');
    await expect(live.waitFor(e => e.type === 'tree_updated', 'tree update')).rejects.toThrow('SSE connection closed');
    await expect(live.close()).rejects.toThrow('SSE connection closed');
  });
});
