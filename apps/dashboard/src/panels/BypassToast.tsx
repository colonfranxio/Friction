import { useEffect, useRef } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { BypassNotice } from '../lib/useTreeData';
export function BypassToast({ notice, dismiss }: { notice: BypassNotice; dismiss: (id: string) => void }) {
  const onDismiss = useRef(dismiss);
  onDismiss.current = dismiss;
  useEffect(() => { const timer = window.setTimeout(() => onDismiss.current(notice.id), 8000); return () => window.clearTimeout(timer); }, [notice.id]);
  return <div className="bypass-toast" role="status"><ArrowUpRight size={20} /><div><strong>{notice.student_name} used a bypass</strong><p>on {notice.concept_name} · {notice.remaining_quota} left</p></div><button className="icon-button" onClick={() => dismiss(notice.id)} aria-label="Dismiss bypass notification"><X size={14} /></button></div>;
}
