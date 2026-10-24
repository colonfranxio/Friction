import { computeNodeStatuses, type StudentSummary, type TreeBundle } from '@friction/shared';
import { levelsFor } from '../tree/layout';
import { relativeTime } from '../lib/format';
export function ClassPanel({ bundle, students, selected, enabled, onSelect }: { bundle: TreeBundle; students: StudentSummary[]; selected?: string; enabled: Record<string, boolean>; onSelect: (id: string) => void }) {
  const progress = (student: StudentSummary) => Object.values(computeNodeStatuses(bundle.nodes, bundle.edges, levelsFor(student))).filter((s) => s === 'mastered').length;
  return <><div className="panel-intro"><h2>Your classroom <span>{students.length}</span></h2><p>Small breakthroughs. Real understanding.</p></div>
    {students.length === 0 && <p className="empty-copy">No students in this tree yet.</p>}
    <div className="student-list">{[...students].sort((a, b) => progress(b) - progress(a)).map((student) => {
      const count = progress(student);
      const online = student.user.last_seen_at && Date.now() - Date.parse(student.user.last_seen_at) < 120000;
      return <button className={`student-row ${selected === student.user.id ? 'chosen' : ''}`} key={student.user.id} onClick={() => onSelect(student.user.id)}>
        <span className="student-row-heading"><span className="avatar">{student.user.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</span><strong>{student.user.name}</strong><i className={`presence ${online && enabled[student.user.id] !== false ? 'online' : ''}`} title={relativeTime(student.user.last_seen_at)} /></span>
        <span className="progress-line"><span className="progress-track"><span style={{ width: `${count / Math.max(1, bundle.nodes.length) * 100}%` }} /></span><span>{count}/{bundle.nodes.length}</span></span>
        <span className="student-meta"><span>{enabled[student.user.id] === false ? '○ Friction off' : relativeTime(student.user.last_seen_at)}</span><span>{student.user.bypass_quota} bypasses left</span></span>
      </button>;
    })}</div></>;
}
