import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, computeNodeStatuses, type CreateNodeRequest, type StudentStateResponse } from '@friction/shared';
import { BookOpen } from 'lucide-react';
import { api } from '../lib/api';
import { useTreeData } from '../lib/useTreeData';
import { levelLabel } from '../lib/format';
import { levelsFor } from '../tree/layout';
import { SkillTreeCanvas, type CanvasActions } from '../tree/SkillTreeCanvas';
import { TopBar } from '../panels/TopBar';
import { ClassPanel } from '../panels/ClassPanel';
import { ActivityFeed } from '../panels/ActivityFeed';
import { Inspector } from '../panels/Inspector';
import { UploadDialog } from '../panels/UploadDialog';
import { BypassToast } from '../panels/BypassToast';
import { Toolbar } from '../panels/Toolbar';
export function TreePage({ studentView = false }: { studentView?: boolean }) {
  const { treeId: routeTree, studentId } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState<string>();
  const [upload, setUpload] = useState(false);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  useEffect(() => { let current = true; api.health().then((health) => { if (current) setDemo(health.mode.demo); }).catch(() => {}); return () => { current = false; }; }, []);
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
  useEffect(() => { setSelection(undefined); setEditing(false); setViewing(''); }, [treeId]);
  useEffect(() => { if (selection && selection !== 'new' && data.bundle && !data.bundle.nodes.some((n) => n.id === selection)) setSelection(undefined); }, [selection, data.bundle]);
  useEffect(() => { if (!actionError) return; const timer = window.setTimeout(() => setActionError(''), 8000); return () => window.clearTimeout(timer); }, [actionError]);
  const mutate = useCallback(async (operation: () => Promise<unknown>) => {
    setBusy(true); setActionError('');
    try { await operation(); await data.refresh(); }
    catch (err) { setActionError(err instanceof ApiError && err.code === 'cycle' ? 'That would create a loop' : err instanceof Error ? err.message : 'Could not save. Please try again.'); throw err; }
    finally { setBusy(false); }
  }, [data.refresh]);
  const run = useCallback((operation: () => Promise<unknown>) => { void mutate(operation).catch(() => {}); }, [mutate]);
  const actions = useMemo<CanvasActions>(() => ({
    move: (id, position) => run(() => api.updateNode(id, { position })),
    connect: ({ source, target }) => { if (source && target) run(() => api.createEdge({ parent_node_id: source, child_node_id: target })); },
    deleteEdge: (parent, child) => run(() => api.deleteEdge(parent, child)),
    required: (id, level) => run(() => api.updateNode(id, { required_blooms_level: level })),
    rename: (id, name) => run(() => api.renamePillar(id, { name })),
  }), [run]);
  const saveNode = async (draft: CreateNodeRequest) => {
    if (!treeId) return;
    await mutate(async () => {
      if (selection === 'new') { const node = await api.createNode(treeId, draft); setSelection(node.id); }
      else if (selection) await api.updateNode(selection, draft);
    });
  };
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
      {!studentView && <Toolbar editing={editing} toggleEditing={() => { setEditing((value) => !value); if (selection === 'new') setSelection(undefined); }} add={() => setSelection('new')} upload={() => setUpload(true)} demo={demo} busy={busy} reset={() => { if (window.confirm('Reset all demo progress and remove custom trees?')) run(async () => { await api.demoReset({ full: true }); navigate('/'); }); }} students={data.students} viewing={viewing} view={setViewing} />}
      {error && <div className="error-banner" role="alert"><span>We couldn’t reach your learning tree. {error}</span><button onClick={() => { setReload((n) => n + 1); void data.refresh(); }}>Try again</button></div>}
      <div className={`tree-workspace ${studentView ? 'student-workspace' : ''}`}>
        {!data.bundle ? <div className="center-state">{!error && !(student && !student.tree_id) && <span className="loading-orbit" />}<h2>{error ? 'Your tree will be here when we reconnect.' : studentView && student && !student.tree_id ? 'No learning tree assigned yet.' : 'Connecting the dots…'}</h2></div> : <SkillTreeCanvas bundle={data.bundle} students={data.students} studentId={studentView ? studentId : viewing || undefined} editing={!studentView && editing} actions={actions} onSelect={studentView ? undefined : setSelection} />}
        <aside className="side-panel">{studentView ? <div className="student-summary"><span className="eyebrow">YOUR PROGRESS</span><h2>{currentStudent?.user.name ?? student?.user.name ?? 'Your journey'}</h2><div className="big-progress">{mastered}<span> / {data.bundle?.nodes.length ?? 0}</span></div><p>concepts mastered</p><div className="progress-track"><span style={{ width: `${mastered / Math.max(1, data.bundle?.nodes.length ?? 0) * 100}%` }} /></div><div className="learning-card"><span className="eyebrow">NOW LEARNING</span><h3>{learning?.concept_name ?? 'You’re all caught up!'}</h3>{learning && <><span className="level-chip">{levelLabel(levels[learning.id] ?? 1)}</span><p>{learning.mastery_criteria}</p></>}</div><div className="bypass-summary"><strong>A little breathing room</strong><p>Bypasses available <span aria-label={`${currentStudent?.user.bypass_quota ?? 0} bypasses available`}>{'●'.repeat(currentStudent?.user.bypass_quota ?? 0)}{'○'.repeat(Math.max(0, 3 - (currentStudent?.user.bypass_quota ?? 0)))}</span></p></div></div>
          : selection && data.bundle ? <Inspector key={`${treeId}:${selection}`} node={data.bundle.nodes.find((n) => n.id === selection)} pillars={data.bundle.pillars} activity={data.activity} editing={editing} close={() => setSelection(undefined)} save={saveNode} remove={async () => { if (selection) await mutate(async () => { await api.deleteNode(selection); setSelection(undefined); }); }} />
          : <><div className="panel-tabs"><button className={tab === 'class' ? 'current' : ''} onClick={() => setTab('class')}>Class</button><button className={tab === 'activity' ? 'current' : ''} onClick={() => setTab('activity')}>Activity</button></div>{data.bundle && (tab === 'class' ? <ClassPanel bundle={data.bundle} students={data.students} selected={viewing} enabled={data.enabled} onSelect={setViewing} /> : <ActivityFeed items={data.activity} />)}</>}
        </aside>
      </div>
    </main>{upload && <UploadDialog close={() => setUpload(false)} complete={(id) => { setUpload(false); navigate(`/educator/${id}`); void data.refresh(); }} />}
    <div className="toast-stack">{actionError && <div className="action-toast" role="alert">{actionError}<button className="icon-button" onClick={() => setActionError('')} aria-label="Dismiss error">×</button></div>}{data.notices.map((notice) => <BypassToast key={notice.id} notice={notice} dismiss={data.dismissNotice} />)}</div></>;
}
