import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
export function SkillEdge(props: EdgeProps) {
  const [path] = getSmoothStepPath({ ...props, borderRadius: 8 });
  const status = props.data?.status;
  const viewKey = props.data?.viewKey;
  const previous = useRef({ status, viewKey });
  const reducedMotion = useReducedMotion();
  const [drawing, setDrawing] = useState(false);
  useEffect(() => {
    const before = previous.current;
    previous.current = { status, viewKey };
    setDrawing(false);
    if (reducedMotion || before.viewKey !== viewKey || before.status !== 'locked' || status === 'locked') return;
    setDrawing(true);
    const timer = window.setTimeout(() => setDrawing(false), 700);
    return () => window.clearTimeout(timer);
  }, [status, viewKey, reducedMotion]);
  return <g data-edge-status={String(status)} data-edge-drawing={drawing ? 'true' : undefined}>
    <BaseEdge id={props.id} path={path} style={{ ...props.style, opacity: drawing ? 0 : 1 }} interactionWidth={20} />
    {!reducedMotion && drawing && <path d={path} pathLength={1} className="edge-unlock-draw" style={props.style} fill="none" aria-hidden="true" />}
    {!reducedMotion && status === 'active' && !drawing && <path d={path} className="edge-energy" fill="none" aria-hidden="true" />}
  </g>;
}
