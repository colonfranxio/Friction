import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { computeDepths, computeNodeStatuses, type BloomLevel, type NodeStatus, type TreeBundle } from '@friction/shared';
import { useTreeData } from '../lib/useTreeData';
import { useStudentData } from '../lib/useStudentData';
import { levelLabel } from '../lib/format';
import { levelsFor } from '../tree/layout';
import { SkillTreeCanvas } from '../tree/SkillTreeCanvas';
import '../styles/embed.css';

/** Active nodes to steer toward next: shallowest first, then by name for a stable order. */
export function nextUp(bundle: TreeBundle, statuses: Record<string, NodeStatus>, skip?: string, count = 3) {
  const depths = computeDepths(bundle.nodes, bundle.edges);
  return bundle.nodes.filter((n) => statuses[n.id] === 'active' && n.id !== skip)
    .sort((a, b) => depths[a.id] - depths[b.id] || a.concept_name.localeCompare(b.concept_name)).slice(0, count);
}
export const tryAsking = (concept: string) => `Can you help me understand ${concept}?`;

/** Compact, read-only Student view for the extension's side panel: /student/:id?embed=1. */
export function EmbedPage() {
  const { studentId } = useParams();
  const profile = useStudentData(studentId);
  const data = useTreeData(profile.student?.tree_id ?? undefined);
  useEffect(() => { if (data.live || data.treeRevision) void profile.refresh(); }, [data.live, data.treeRevision, profile.refresh]);
  const [showMap, setShowMap] = useState(false);
  const error = profile.error || data.error;
  const current = data.students.find((s) => s.user.id === studentId);
  const levels: Record<string, BloomLevel> = levelsFor(current);
  const statuses = data.bundle ? computeNodeStatuses(data.bundle.nodes, data.bundle.edges, levels) : {};
  const mastered = Object.values(statuses).filter((s) => s === 'mastered').length;
  const total = data.bundle?.nodes.length ?? 0;
  const learning = data.bundle?.nodes.filter((n) => statuses[n.id] === 'active').sort((a, b) => {
    const updated = (id: string) => current?.states.find((s) => s.node_id === id)?.updated_at ?? '';
    return updated(b.id).localeCompare(updated(a.id));
  })[0];
  const upcoming = data.bundle ? nextUp(data.bundle, statuses, learning?.id) : [];
  const retry = () => { void profile.refresh(); void data.refresh(); };
  if (error && !data.bundle) return <main className="embed embed-state" role="alert"><p>We couldn’t reach your learning map. {error}</p><button onClick={retry}>Try again</button></main>;
  if (profile.student && !profile.student.tree_id) return <main className="embed embed-state"><p>No learning tree assigned yet.</p></main>;
  if (!data.bundle) return <main className="embed embed-state" role="status"><span className="loading-orbit" /><p>Connecting the dots…</p></main>;
  return <main className="embed">
    {error && <div className="error-banner" role="alert"><span>Reconnecting… {error}</span><button onClick={retry}>Try again</button></div>}
    <header className="embed-summary"><span className="eyebrow">YOUR PROGRESS · {data.live ? 'LIVE' : 'RECONNECTING'}</span><h1>{current?.user.name ?? profile.student?.user.name ?? 'Your journey'}</h1>
      <p><strong>{mastered}</strong> of {total} concepts mastered</p><div className="progress-track"><span style={{ width: `${mastered / Math.max(1, total) * 100}%` }} /></div></header>
    <section className="embed-card"><span className="eyebrow">NOW LEARNING</span><h2>{learning?.concept_name ?? 'You’re all caught up!'}</h2>
      {learning && <><span className="level-chip">{levelLabel(levels[learning.id] ?? 1)} · {levels[learning.id] ?? 1}/{learning.required_blooms_level}</span><p>{learning.mastery_criteria}</p></>}</section>
    {upcoming.length > 0 && <section className="embed-next"><span className="eyebrow">NEXT UP</span><ol>{upcoming.map((n) => <li key={n.id}>
      <div className="embed-next-title"><strong>{n.concept_name}</strong><span>{levels[n.id] ?? 1}/{n.required_blooms_level}</span></div>
      <p className="embed-hint">{n.mastery_criteria}</p><p className="embed-ask">Try asking: “{tryAsking(n.concept_name)}”</p></li>)}</ol></section>}
    {upcoming.length === 0 && learning && <section className="embed-next"><span className="eyebrow">NEXT UP</span><p className="embed-hint">Master {learning.concept_name} to unlock what comes next. Try asking: “{tryAsking(learning.concept_name)}”</p></section>}
    <section className="embed-map-section"><button className="embed-toggle" aria-expanded={showMap} onClick={() => setShowMap((v) => !v)}>{showMap ? 'Hide map' : 'Show map'}</button>
      {showMap && <div className="embed-map"><SkillTreeCanvas bundle={data.bundle} students={data.students} studentId={studentId} /></div>}</section>
  </main>;
}
