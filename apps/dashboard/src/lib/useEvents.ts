import { useEffect, useRef, useState } from 'react';
import type { ServerEvent, ServerEventType } from '@friction/shared';
import { api } from './api';
const types: ServerEventType[] = ['student_state', 'bypass', 'activity', 'tree_updated', 'student_seen'];
export function useEvents(treeId: string | undefined, onEvent: (event: ServerEvent) => void, onOpen: () => void) {
  const [live, setLive] = useState(false);
  const handlers = useRef({ onEvent, onOpen });
  handlers.current = { onEvent, onOpen };
  useEffect(() => {
    setLive(false);
    if (!treeId) return;
    const source = new EventSource(api.eventsUrl(treeId));
    source.onopen = () => { setLive(true); handlers.current.onOpen(); };
    source.onerror = () => setLive(false);
    for (const type of types) source.addEventListener(type, (message) => {
      try { handlers.current.onEvent({ type, data: JSON.parse((message as MessageEvent).data) } as ServerEvent); }
      catch { /* Malformed messages must not close the live connection. */ }
    });
    return () => source.close();
  }, [treeId]);
  return live;
}
