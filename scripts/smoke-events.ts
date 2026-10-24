import type { ServerEvent } from '@friction/shared';

/** Subscribe before mutations so live-update checks cannot pass by polling state. */
export async function observeEvents(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    controller.abort();
    throw new Error(`SSE subscription failed: HTTP ${response.status}`);
  }
  const events: ServerEvent[] = [];
  let failure: unknown;
  const reader = response.body.getReader();
  const consume = (async () => {
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) throw new Error('SSE connection closed before verification completed');
        buffer += decoder.decode(value, { stream: true });
        let boundary: RegExpExecArray | null;
        while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
          const frame = buffer.slice(0, boundary.index);
          buffer = buffer.slice(boundary.index + boundary[0].length);
          const lines = frame.split(/\r?\n/);
          const type = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
          const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (type && data) events.push({ type, data: JSON.parse(data) } as ServerEvent);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) failure = error;
    } finally {
      reader.releaseLock();
    }
  })();
  return {
    events,
    async waitFor(predicate: (event: ServerEvent) => boolean, description: string) {
      const deadline = Date.now() + 8_000;
      while (Date.now() < deadline) {
        if (failure) throw failure;
        const found = events.find(predicate);
        if (found) return found;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error(`Missing SSE event: ${description}`);
    },
    async close() {
      controller.abort();
      await consume;
      if (failure) throw failure;
    },
  };
}
