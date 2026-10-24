import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
export function SkillEdge(props: EdgeProps) {
  const [path] = getSmoothStepPath({ ...props, borderRadius: 8 });
  return <BaseEdge id={props.id} path={path} style={props.style} interactionWidth={20} />;
}
