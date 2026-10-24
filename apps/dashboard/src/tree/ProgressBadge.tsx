import type { BloomLevel } from '@friction/shared';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
export function ProgressBadge({ level, required, viewKey, onChange }: { level: BloomLevel; required: BloomLevel; viewKey: string; onChange?: (level: BloomLevel) => void }) {
  const reducedMotion = useReducedMotion();
  return onChange ? <select className="progress-badge nodrag" aria-label="Required mastery level" value={required} onChange={(e) => onChange(Number(e.target.value) as BloomLevel)}>
    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{level}/{n}</option>)}
  </select> : <span className="progress-badge" aria-label={`Level ${level} of ${required}`}><span className="badge-ticker" aria-hidden="true"><AnimatePresence key={viewKey} initial={false} mode="popLayout"><motion.span key={level} className="badge-number" initial={reducedMotion ? false : { rotateX: -90, y: 4, opacity: 0 }} animate={{ rotateX: 0, y: 0, opacity: 1 }} exit={reducedMotion ? { opacity: 0 } : { rotateX: 90, y: -4, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.22 }}>{level}</motion.span></AnimatePresence></span><span aria-hidden="true">/{required}</span></span>;
}
