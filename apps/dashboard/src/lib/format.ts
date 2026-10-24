import { LEVEL_LABELS, type BloomLevel } from '@friction/shared';
export const levelLabel = (level: BloomLevel) => `L${level} · ${LEVEL_LABELS[level].role}`;
export function relativeTime(value: string | null) {
  if (!value) return 'Not seen yet';
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
