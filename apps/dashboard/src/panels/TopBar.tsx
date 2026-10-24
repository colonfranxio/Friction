import { NavLink } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { SEED_IDS } from '@friction/shared';
export function TopBar({ title, live, treeId }: { title?: string; live: boolean; treeId?: string }) {
  return <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Layers size={19} /></span>friction<span className="brand-period">.</span></a>
    <div className="course-title">{title ?? 'Your learning, connected'}</div>
    <nav aria-label="View"><NavLink to={`/educator/${treeId ?? SEED_IDS.tree}`}>Educator</NavLink><NavLink to={`/student/${SEED_IDS.demoStudent}`}>Student</NavLink><NavLink to="/sandbox">Sandbox</NavLink></nav>
    <span className={`live-indicator ${live ? 'is-live' : ''}`} role="status"><i />{live ? 'Live' : 'Reconnecting…'}</span>
  </header>;
}
