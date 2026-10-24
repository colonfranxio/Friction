import { useEffect, useMemo, useRef, useState } from 'react';
import { Background, Controls, ReactFlow, useNodesState, type Connection, type Edge, type NodeMouseHandler, type ReactFlowInstance, type Viewport } from '@xyflow/react';
import type { BloomLevel, StudentSummary, TreeBundle } from '@friction/shared';
import { SkillNode, type SkillFlowNode } from './SkillNode';
import { SkillEdge } from './edges';
import { layoutTree, treePresentation, PILLAR_WIDTH, PILLAR_GAP } from './layout';
import { PillarHeader } from './PillarHeader';
const nodeTypes = { skill: SkillNode };
const edgeTypes = { skill: SkillEdge };
export interface CanvasActions {
  move: (id: string, position: { x: number; y: number }) => void;
  connect: (connection: Connection) => void;
  deleteEdge: (parent: string, child: string) => void;
  required: (id: string, level: BloomLevel) => void;
  rename: (id: string, name: string) => void;
}
export function SkillTreeCanvas({ bundle, students, studentId, editing = false, onSelect, actions }: {
  bundle: TreeBundle; students: StudentSummary[]; studentId?: string; editing?: boolean;
  onSelect?: (id: string | undefined) => void; actions?: CanvasActions;
}) {
  const presentation = useMemo(() => treePresentation(bundle, students, studentId), [bundle, students, studentId]);
  const initialNodes = useMemo<SkillFlowNode[]>(() => layoutTree(bundle).map((concept) => ({
    id: concept.id, type: 'skill', position: concept.position,
    data: { concept, level: presentation.levels[concept.id] ?? 1, status: presentation.statuses[concept.id], count: presentation.focused[concept.id] ?? 0, editing, viewKey: `${bundle.tree.id}:${studentId ?? 'class'}`,
      onRequired: (level: BloomLevel) => actions?.required(concept.id, level) },
  })), [bundle, presentation, editing, actions, studentId]);
  const [nodes, setNodes, onNodesChange] = useNodesState<SkillFlowNode>(initialNodes);
  const container = useRef<HTMLDivElement>(null);
  const [flow, setFlow] = useState<ReactFlowInstance<SkillFlowNode>>();
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const element = container.current;
    if (!element || !flow) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { void flow.fitView({ padding: 0.1 }); });
    });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [flow]);
  useEffect(() => {
    // Keep measurements while SSE patches data; dropping them briefly unmounts edges.
    setNodes((current) => initialNodes.map((next) => {
      const existing = current.find((node) => node.id === next.id);
      return existing ? { ...existing, ...next, measured: existing.measured } : next;
    }));
  }, [initialNodes, setNodes]);
  const edges: Edge[] = bundle.edges.map((edge) => {
    const status = presentation.statuses[edge.child_node_id];
    const selected = selectedEdgeIds.has(`${edge.parent_node_id}:${edge.child_node_id}`);
    return { id: `${edge.parent_node_id}:${edge.child_node_id}`, source: edge.parent_node_id, target: edge.child_node_id,
      type: 'skill', selected, data: { status, viewKey: `${bundle.tree.id}:${studentId ?? 'class'}` }, style: { stroke: selected ? 'var(--text)' : `var(--${status === 'locked' ? 'border' : status})`, strokeWidth: selected ? 3.5 : 2.5 }, deletable: editing };
  });
  const select: NodeMouseHandler<SkillFlowNode> = (_event, node) => onSelect?.(node.id);
  return <div className="canvas-wrap" ref={container}>
    <div className="pillar-strip">{[...bundle.pillars].sort((a, b) => a.order - b.order).map((pillar, index) => <div className="pillar-slot" key={pillar.id} style={{ left: viewport.x + (index * (PILLAR_WIDTH + PILLAR_GAP) + PILLAR_WIDTH / 2) * viewport.zoom, width: PILLAR_WIDTH * viewport.zoom }}><PillarHeader index={index} name={pillar.name} editing={editing} rename={(name) => actions?.rename(pillar.id, name)} /></div>)}</div>
    {bundle.nodes.length === 0 ? <div className="center-state"><h2>Your canvas is ready</h2><p>Turn on edit mode and add your first concept.</p></div> : <ReactFlow<SkillFlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onInit={setFlow}
      onMove={(_event, next) => setViewport(next)}
      onNodesChange={onNodesChange} onNodeClick={select} onPaneClick={() => { onSelect?.(undefined); setSelectedEdgeIds(new Set()); }}
      onEdgesChange={(changes) => setSelectedEdgeIds((current) => {
        const next = new Set(current);
        for (const change of changes) if (change.type === 'select') { if (change.selected) next.add(change.id); else next.delete(change.id); }
        return next;
      })}
      nodesDraggable={editing} nodesConnectable={editing} edgesReconnectable={false}
      deleteKeyCode={editing ? ['Backspace', 'Delete'] : null} nodesFocusable edgesFocusable={editing}
      onBeforeDelete={async ({ edges: deletedEdges }) => { for (const edge of deletedEdges) actions?.deleteEdge(edge.source, edge.target); return false; }}
      onConnect={(connection) => actions?.connect(connection)} onNodeDragStop={(_event, node) => actions?.move(node.id, node.position)}
      fitView fitViewOptions={{ padding: 0.18 }} minZoom={0.25} maxZoom={1.7} proOptions={{ hideAttribution: true }}>
      <Background color="#d9d5ca" gap={24} size={1} /><Controls showInteractive={false} />
    </ReactFlow>}
    <footer className="canvas-footer"><div className="legend"><span><i className="mastered" />Mastered</span><span><i className="active" />Learning</span><span><i className="locked" />Locked</span></div><span>{bundle.nodes.length} concepts · {bundle.edges.length} connections</span></footer>
  </div>;
}
