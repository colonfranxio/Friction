import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivityItem, ServerEvent, StudentSummary, TreeBundle } from '@friction/shared';
import { api } from './api';
import { useEvents } from './useEvents';
export type BypassNotice = Extract<ServerEvent, { type: 'bypass' }>['data'];
export function useTreeData(treeId: string | undefined) {
  const [bundle, setBundle] = useState<TreeBundle>();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [notices, setNotices] = useState<BypassNotice[]>([]);
  const [error, setError] = useState('');
  const [treeRevision, setTreeRevision] = useState(0);
  const generation = useRef(0);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    if (!treeId) return;
    const request = ++generation.current;
    const startedAtRevision = revision.current;
    try {
      const [tree, people, feed] = await Promise.all([api.getTree(treeId), api.treeStudents(treeId), api.treeActivity(treeId)]);
      if (request !== generation.current) return;
      if (startedAtRevision !== revision.current) { void refresh(); return; }
      setBundle(tree); setStudents(people.students); setActivity(feed.items); setError('');
    } catch (err) {
      if (request === generation.current) setError(err instanceof Error ? err.message : 'Could not reach Friction.');
    }
  }, [treeId]);
  useEffect(() => {
    setBundle(undefined); setStudents([]); setActivity([]); setEnabled({}); setNotices([]); setError('');
    void refresh();
    return () => { generation.current++; };
  }, [refresh]);
  const live = useEvents(treeId, (event) => {
    revision.current++;
    switch (event.type) {
      case 'tree_updated': setTreeRevision((value) => value + 1); void refresh(); break;
      case 'student_state': setStudents((all) => all.map((student) => student.user.id === event.data.student_id
        ? { ...student, states: [...student.states.filter((s) => s.node_id !== event.data.node_id), event.data] } : student)); break;
      case 'activity': setActivity((all) => [event.data, ...all.filter((a) => a.id !== event.data.id)].slice(0, 100)); break;
      case 'bypass':
        setNotices((all) => [...all.filter((n) => n.id !== event.data.id), event.data]);
        setStudents((all) => all.map((s) => s.user.id === event.data.student_id ? { ...s, user: { ...s.user, bypass_quota: event.data.remaining_quota } } : s));
        break;
      case 'student_seen':
        setEnabled((all) => ({ ...all, [event.data.student_id]: event.data.enabled }));
        setStudents((all) => all.map((s) => s.user.id === event.data.student_id ? { ...s, user: { ...s.user, last_seen_at: event.data.last_seen_at } } : s));
    }
  }, () => { void refresh(); });
  return { bundle, students, activity, enabled, notices, live, error, refresh, treeRevision,
    dismissNotice: (id: string) => setNotices((all) => all.filter((n) => n.id !== id)) };
}
