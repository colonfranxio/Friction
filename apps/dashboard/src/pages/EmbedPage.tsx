import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { computeNodeStatuses } from '@friction/shared';
import { useTreeData } from '../lib/useTreeData';
import { useStudentData } from '../lib/useStudentData';
import { levelLabel } from '../lib/format';
import { levelsFor } from '../tree/layout';
import { SkillTreeCanvas } from '../tree/SkillTreeCanvas';
import '../styles/embed.css';

const STATUS = { mastered: 'Mastered', active: 'Learning', locked: 'Locked' } as const;

/** Side-panel view for the extension (/student/:id?embed=1): just the live map; click a node to see what it is. */
export function EmbedPage() {
  const { studentId } = useParams();
  const profile = useStudentData(studentId);
  const data = useTreeData(profile.student?.tree_id ?? undefined);
  useEffect(() => { if (data.live || data.treeRevision) void profile.refresh(); }, [data.live, data.treeRevision, profile.refresh]);
  const [selected, setSelected] = useState<string>();
  const error = profile.error || data.error;
  const retry = () => { void profile.refresh(); void data.refresh(); };
  if (error && !data.bundle) return <main className="embed embed-state" role="alert"><p>We couldn’t reach your learning map. {error}</p><button onClick={retry}>Try again</button></main>;
  if (profile.student && !profile.student.tree_id) return <main className="embed embed-state"><p>No learning tree assigned yet.</p></main>;
  if (!data.bundle) return <main className="embed embed-state" role="status"><span className="loading-orbit" /><p>Connecting the dots…</p></main>;
  const levels = levelsFor(data.students.find((s) => s.user.id === studentId));
  const node = data.bundle.nodes.find((n) => n.id === selected);
  const status = node && computeNodeStatuses(data.bundle.nodes, data.bundle.edges, levels)[node.id];
  return <main className="embed embed-map-only">
    {error && <div className="error-banner" role="alert"><span>Reconnecting… {error}</span><button onClick={retry}>Try again</button></div>}
    <SkillTreeCanvas bundle={data.bundle} students={data.students} studentId={studentId} vertical onSelect={setSelected} />
    {node && status && <section className="embed-detail" aria-live="polite">
      <button className="icon-button embed-close" onClick={() => setSelected(undefined)} aria-label="Close">×</button>
      <span className={`embed-status ${status}`}>{STATUS[status]} · {levelLabel(levels[node.id] ?? 1)} · {levels[node.id] ?? 1}/{node.required_blooms_level}</span>
      <h2>{node.concept_name}</h2>
      <p>{node.mastery_criteria}</p>
    </section>}
  </main>;
}
