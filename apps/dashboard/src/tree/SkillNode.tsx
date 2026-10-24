import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Lock } from 'lucide-react';
import type { BloomLevel, NodeStatus, SkillNode as Concept } from '@friction/shared';
import { conceptIcon } from '../lib/icons';
import { levelLabel } from '../lib/format';
import { ProgressBadge } from './ProgressBadge';
export type SkillFlowNode = Node<{ concept: Concept; level: BloomLevel; status: NodeStatus; count: number; editing: boolean; onRequired?: (level: BloomLevel) => void }, 'skill'>;
export function SkillNode({ data, selected }: NodeProps<SkillFlowNode>) {
  const Icon = conceptIcon(data.concept.icon);
  return <div className={`skill-node ${data.status} ${data.concept.size} ${selected ? 'selected' : ''}`} data-concept={data.concept.id} data-status={data.status}>
    <Handle type="target" position={Position.Top} isConnectable={data.editing} />
    <div className="node-circle"><Icon size={data.concept.size === 'major' ? 27 : 21} strokeWidth={1.7} />
      {data.status === 'locked' && <span className="lock-overlay"><Lock size={11} /></span>}
      {data.count > 0 && <span className="focus-count" title={`${data.count} students learning here`}>{data.count}</span>}
    </div>
    <ProgressBadge level={data.level} required={data.concept.required_blooms_level} onChange={data.editing ? data.onRequired : undefined} />
    <div className="node-label">{data.concept.concept_name}</div>
    <div className="node-tooltip" role="tooltip"><strong>{data.concept.concept_name}</strong><p>{data.concept.mastery_criteria}</p><span>{levelLabel(data.level)}</span></div>
    <Handle type="source" position={Position.Bottom} isConnectable={data.editing} />
  </div>;
}
