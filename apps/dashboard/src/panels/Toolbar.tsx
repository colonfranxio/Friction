import { Pencil, Plus, RotateCcw, Upload } from 'lucide-react';
import type { StudentSummary } from '@friction/shared';
export function Toolbar({ editing, toggleEditing, add, upload, reset, demo, busy, students, viewing, view }: {
  editing: boolean; toggleEditing: () => void; add: () => void; upload: () => void; reset: () => void;
  demo: boolean; busy: boolean; students: StudentSummary[]; viewing: string; view: (id: string) => void;
}) {
  return <div className="toolbar"><button onClick={upload}><Upload size={14} />Upload syllabus</button><button disabled={!editing || busy} onClick={add}><Plus size={14} />Node</button><button className={editing ? 'editing-on' : ''} aria-pressed={editing} onClick={toggleEditing}><Pencil size={13} />Edit mode<span className={`toggle ${editing ? 'on' : ''}`} /></button>
    <label>Viewing as<select aria-label="Viewing as" value={viewing} onChange={(e) => view(e.target.value)}><option value="">Class</option>{students.map((s) => <option key={s.user.id} value={s.user.id}>{s.user.name}</option>)}</select></label>
    {demo && <button className="reset-button" disabled={busy} onClick={reset}><RotateCcw size={13} />Reset demo</button>}
  </div>;
}
