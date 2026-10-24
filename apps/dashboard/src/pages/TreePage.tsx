import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { computeNodeStatuses, type StudentStateResponse } from '@friction/shared';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { api } from '../lib/api';
import { useTreeData } from '../lib/useTreeData';
import { levelLabel } from '../lib/format';
import { levelsFor } from '../tree/layout';
import { SkillTreeCanvas } from '../tree/SkillTreeCanvas';
import { TopBar } from '../panels/TopBar';
import { ClassPanel } from '../panels/ClassPanel';
import { ActivityFeed } from '../panels/ActivityFeed';
export function TreePage({ studentView = false }: { studentView?: boolean }) {
  const { treeId: routeTree, studentId } = useParams();
  const [student, setStudent] = useState<StudentStateResponse>();
  const [studentError, setStudentError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!studentView || !studentId) return;
    let current = true;
    setStudent(undefined); setStudentError('');
    api.getStudent(studentId).then((result) => { if (current) setStudent(result); }).catch((err) => { if (current) setStudentError(String(err)); });
    return () => { current = false; };
  }, [studentView, studentId, reload]);
  const treeId = studentView ? student?.tree_id ?? undefined : routeTree;
  const data = useTreeData(treeId);
  const [viewing, setViewing] = useState('');
  const [tab, setTab] = useState<'class' | 'activity'>('class');
  const currentStudent = data.students.find((s) => s.user.id === studentId);
  const levels = levelsFor(currentStudent);
  const statuses = data.bundle ? computeNodeStatuses(data.bundle.nodes, data.bundle.edges, levels) : {};
  const mastered = Object.values(statuses).filter((s) => s === 'mastered').length;
  const learning = data.bundle?.nodes.filter((n) => statuses[n.id] === 'active').sort((a, b) => {
    const updated = (id: string) => currentStudent?.states.find((s) => s.node_id === id)?.updated_at ?? '';
    return updated(b.id).localeCompare(updated(a.id));
  })[0];
  const error = studentError || data.error;
  return <><TopBar title={data.bundle?.tree.title} live={data.live} treeId={treeId} />
    <main className="workspace">
      <div className="page-heading"><div><span className="eyebrow">{studentView ? 'YOUR LEARNING JOURNEY' : 'THE BIG PICTURE'}</span><h1>{studentView ? 'A little progress. A lot of possibility.' : 'Understanding takes shape.'}</h1><p>{studentView ? 'Every concept connects to what comes next.' : 'A living map of what your class knows, and where they’re growing.'}</p></div><span className="course-tag"><BookOpen size={15} />{data.bundle?.tree.title ?? 'Skill tree'}</span></div>
      {!studentView && <div className="toolbar"><span className="toolbar-hint"><ArrowUpRight size={16} />Follow the connections. Find the breakthroughs.</span><label>Viewing as <select value={viewing} onChange={(e) => setViewing(e.target.value)}><option value="">Class</option>{data.students.map((s) => <option key={s.user.id} value={s.user.id}>{s.user.name}</option>)}</select></label></div>}
      {error && <div className="error-banner" role="alert"><span>We couldn’t reach your learning tree. {error}</span><button onClick={() => { setReload((n) => n + 1); void data.refresh(); }}>Try again</button></div>}
      <div className={`tree-workspace ${studentView ? 'student-workspace' : ''}`}>
        {!data.bundle ? <div className="center-state"><span className="loading-orbit" /><h2>{error ? 'Your tree will be here when we reconnect.' : studentView && student && !student.tree_id ? 'No learning tree assigned yet.' : 'Connecting the dots…'}</h2></div> : <SkillTreeCanvas bundle={data.bundle} students={data.students} studentId={studentView ? studentId : viewing || undefined} />}
        <aside className="side-panel">{studentView ? <div className="student-summary"><span className="eyebrow">YOUR PROGRESS</span><h2>{currentStudent?.user.name ?? student?.user.name ?? 'Your journey'}</h2><div className="big-progress">{mastered}<span> / {data.bundle?.nodes.length ?? 0}</span></div><p>concepts mastered</p><div className="progress-track"><span style={{ width: `${mastered / Math.max(1, data.bundle?.nodes.length ?? 0) * 100}%` }} /></div><div className="learning-card"><span className="eyebrow">NOW LEARNING</span><h3>{learning?.concept_name ?? 'You’re all caught up!'}</h3>{learning && <><span className="level-chip">{levelLabel(levels[learning.id] ?? 1)}</span><p>{learning.mastery_criteria}</p></>}</div><div className="bypass-summary"><strong>A little breathing room</strong><p>Bypasses available <span aria-label={`${currentStudent?.user.bypass_quota ?? 0} bypasses available`}>{'●'.repeat(currentStudent?.user.bypass_quota ?? 0)}{'○'.repeat(Math.max(0, 3 - (currentStudent?.user.bypass_quota ?? 0)))}</span></p></div></div>
          : <><div className="panel-tabs"><button className={tab === 'class' ? 'current' : ''} onClick={() => setTab('class')}>Class</button><button className={tab === 'activity' ? 'current' : ''} onClick={() => setTab('activity')}>Activity</button></div>{data.bundle && (tab === 'class' ? <ClassPanel bundle={data.bundle} students={data.students} selected={viewing} enabled={data.enabled} onSelect={setViewing} /> : <ActivityFeed items={data.activity} />)}</>}
        </aside>
      </div>
    </main></>;
}
