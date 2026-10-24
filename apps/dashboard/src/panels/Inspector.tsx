import { useState } from 'react';
import { ICON_KEYWORDS, type ActivityItem, type BloomLevel, type CreateNodeRequest, type Pillar, type SkillNode } from '@friction/shared';
import { X } from 'lucide-react';
import { ActivityFeed } from './ActivityFeed';

export function Inspector({ node, pillars, activity, editing, close, save, remove }: {
  node?: SkillNode; pillars: Pillar[]; activity: ActivityItem[]; editing: boolean; close: () => void;
  save: (draft: CreateNodeRequest) => Promise<void>; remove: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<CreateNodeRequest>({
    pillar_id: node?.pillar_id ?? pillars[0]?.id ?? '', concept_name: node?.concept_name ?? '',
    mastery_criteria: node?.mastery_criteria ?? '', required_blooms_level: node?.required_blooms_level ?? 4,
    size: node?.size ?? 'major', icon: node?.icon ?? 'code', keywords: node?.keywords ?? [],
  });
  const [keywords, setKeywords] = useState(node?.keywords.join(', ') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const execute = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save this concept.'); }
    finally { setBusy(false); }
  };
  return <div className="inspector"><div className="panel-title"><h2>{node ? 'Concept details' : 'A new connection'}</h2><button className="icon-button" aria-label="Close inspector" onClick={close}><X size={17} /></button></div>
    <form onSubmit={(e) => { e.preventDefault(); void execute(() => save({ ...draft, concept_name: draft.concept_name.trim(), mastery_criteria: draft.mastery_criteria.trim(), keywords: keywords.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) })); }}>
      <fieldset disabled={!editing || busy}>
        <label>Concept<input required maxLength={160} value={draft.concept_name} onChange={(e) => setDraft({ ...draft, concept_name: e.target.value })} /></label>
        <label>Pillar<select required value={draft.pillar_id} onChange={(e) => setDraft({ ...draft, pillar_id: e.target.value })}>{pillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Mastery criteria<textarea required rows={4} value={draft.mastery_criteria} onChange={(e) => setDraft({ ...draft, mastery_criteria: e.target.value })} /></label>
        <label>Required level<select value={draft.required_blooms_level} onChange={(e) => setDraft({ ...draft, required_blooms_level: Number(e.target.value) as BloomLevel })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>Level {n}</option>)}</select></label>
        <label>Size<select value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value as 'major' | 'minor' })}><option value="major">Major milestone</option><option value="minor">Minor skill</option></select></label>
        <label>Icon<select value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })}>{ICON_KEYWORDS.map((keyword) => <option key={keyword}>{keyword}</option>)}</select></label>
        <label>Keywords <span className="muted">separate with commas</span><input value={keywords} onChange={(e) => setKeywords(e.target.value)} /></label>
      </fieldset>
      {error && <p className="field-error" role="alert">{error}</p>}
      {editing && <div className="inspector-actions">{node && <button type="button" className="danger-button" disabled={busy} onClick={() => { if (window.confirm(`Delete ${node.concept_name} and its connections?`)) void execute(remove); }}>Delete node</button>}<button className="primary-button" disabled={busy || !draft.concept_name.trim() || !draft.mastery_criteria.trim() || !draft.pillar_id}>{busy ? 'Saving…' : node ? 'Save changes' : 'Create node'}</button></div>}
    </form>
    {node && <ActivityFeed items={activity.filter((item) => item.node_id === node.id)} />}
  </div>;
}
