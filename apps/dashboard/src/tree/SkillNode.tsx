import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Lock } from 'lucide-react';
import type { BloomLevel, NodeStatus, SkillNode as Concept } from '@friction/shared';
import { conceptIcon } from '../lib/icons';
import { levelLabel } from '../lib/format';
import { ProgressBadge } from './ProgressBadge';
import { Particles } from '../anim/Particles';
export type SkillFlowNode = Node<{ concept: Concept; level: BloomLevel; status: NodeStatus; count: number; editing: boolean; viewKey: string; onRequired?: (level: BloomLevel) => void }, 'skill'>;
export function SkillNode({ data, selected }: NodeProps<SkillFlowNode>) {
  const Icon = conceptIcon(data.concept.icon);
  const reducedMotion = useReducedMotion();
  const previous = useRef({ status: data.status, viewKey: data.viewKey });
  const [moment, setMoment] = useState<'mastery' | 'unlock'>();
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    const before = previous.current;
    previous.current = { status: data.status, viewKey: data.viewKey };
    setMoment(undefined);
    setAnnouncement('');
    if (before.viewKey !== data.viewKey) return;
    if (before.status !== 'mastered' && data.status === 'mastered') setAnnouncement(`${data.concept.concept_name} mastered`);
    else if (before.status === 'locked' && data.status === 'active') setAnnouncement(`${data.concept.concept_name} unlocked`);
    if (reducedMotion) return;
    if (before.status !== 'mastered' && data.status === 'mastered') setMoment('mastery');
    else if (before.status === 'locked' && data.status === 'active') setMoment('unlock');
    const timer = window.setTimeout(() => setMoment(undefined), 1100);
    return () => window.clearTimeout(timer);
  }, [data.status, data.viewKey, reducedMotion]);
  return <div className={`skill-node ${data.status} ${data.concept.size} ${selected ? 'selected' : ''}`} data-concept={data.concept.id} data-status={data.status} data-moment={moment}>
    <Handle type="target" position={Position.Top} isConnectable={data.editing} />
    <motion.div className="node-circle" whileHover={reducedMotion ? undefined : { scale: 1.06, y: -2 }} transition={{ type: 'spring', stiffness: 340, damping: 20 }}><Icon size={data.concept.size === 'major' ? 27 : 21} strokeWidth={1.7} />
      <Particles active={moment === 'mastery'} />
      <AnimatePresence key={data.viewKey} initial={false}>{data.status === 'locked' && <motion.span key="lock" className="lock-overlay" exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0, rotate: -40, y: -6 }} transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 17 }}><Lock size={11} /></motion.span>}</AnimatePresence>
      {data.count > 0 && <span className="focus-count" title={`${data.count} students learning here`}>{data.count}</span>}
    </motion.div>
    <ProgressBadge level={data.level} required={data.concept.required_blooms_level} viewKey={data.viewKey} onChange={data.editing ? data.onRequired : undefined} />
    <div className="node-label">{data.concept.concept_name}</div>
    <div className="node-tooltip" role="tooltip"><strong>{data.concept.concept_name}</strong><p>{data.concept.mastery_criteria}</p><span>{levelLabel(data.level)}</span></div>
    <span className="sr-only" role="status">{announcement}</span>
    <Handle type="source" position={Position.Bottom} isConnectable={data.editing} />
  </div>;
}
