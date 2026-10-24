import { useState } from 'react';
import { Pencil } from 'lucide-react';
export function PillarHeader({ name, index, editing, rename }: { name: string; index: number; editing: boolean; rename: (name: string) => void }) {
  const [draft, setDraft] = useState<string>();
  return <div className="pillar-heading"><span className="pillar-number">0{index + 1}</span>
    {draft !== undefined ? <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { rename(draft.trim()); setDraft(undefined); } }}><input aria-label="Pillar name" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setDraft(undefined); }} /><button aria-label="Save pillar name">✓</button></form>
      : <><span>{name}</span>{editing && <button className="icon-button" aria-label={`Rename ${name}`} onClick={() => setDraft(name)}><Pencil size={12} /></button>}</>}
  </div>;
}
