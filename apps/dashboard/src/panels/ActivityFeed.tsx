import type { ActivityItem } from '@friction/shared';
import { relativeTime } from '../lib/format';
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return <div className="activity-feed"><div className="panel-intro"><h2>Learning in motion</h2><p>Concept checks, progress, and bypasses.</p></div>
    {!items.length && <p className="empty-copy">The next breakthrough starts a conversation. Learning activity will appear here live.</p>}
    {items.map((item) => <details className={`activity-item ${item.kind}`} key={item.id}><summary><strong>{item.student_name}</strong><time>{relativeTime(item.created_at)}</time><p>{item.concept_name}</p><span>{item.kind === 'bypass' ? '↗ Used a bypass' : item.verdict ? `${item.verdict === 'correct' ? '✓' : '◌'} ${item.verdict.replaceAll('_', ' ')} (${item.confidence?.toFixed(2) ?? '—'}) → L${item.level}` : `Started learning · L${item.level}`}</span></summary><p className="rationale">{item.rationale ?? 'No additional details.'}</p></details>)}
  </div>;
}
