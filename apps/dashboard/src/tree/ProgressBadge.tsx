import type { BloomLevel } from '@friction/shared';
export function ProgressBadge({ level, required, onChange }: { level: BloomLevel; required: BloomLevel; onChange?: (level: BloomLevel) => void }) {
  return onChange ? <select className="progress-badge nodrag" aria-label="Required mastery level" value={required} onChange={(e) => onChange(Number(e.target.value) as BloomLevel)}>
    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{level}/{n}</option>)}
  </select> : <span className="progress-badge"><span key={level}>{level}</span>/{required}</span>;
}
