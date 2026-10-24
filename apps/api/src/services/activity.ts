import type { ActivityItem, ChatLog } from '@friction/shared';
import type { DB } from '../store/store';

/** Educator-safe view of a log row: never includes raw prompts or AI replies (contracts §11). */
export function activityFromLog(db: DB, log: ChatLog, kind: ActivityItem['kind']): ActivityItem {
  return {
    id: log.id,
    kind,
    student_id: log.student_id,
    student_name: db.users.find((u) => u.id === log.student_id)?.name ?? '?',
    node_id: log.node_id,
    concept_name: db.nodes.find((n) => n.id === log.node_id)?.concept_name ?? '?',
    level: log.level,
    verdict: log.verdict,
    confidence: log.confidence,
    rationale: log.rationale,
    created_at: log.created_at,
  };
}
