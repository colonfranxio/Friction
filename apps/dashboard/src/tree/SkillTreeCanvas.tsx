import { useEffect, useMemo } from 'react';
import { Background, Controls, ReactFlow, useNodesState, type Connection, type Edge, type NodeMouseHandler } from '@xyflow/react';
import type { BloomLevel, StudentSummary, TreeBundle } from '@friction/shared';
import { SkillNode, type SkillFlowNode } from './SkillNode';
import { SkillEdge } from './edges';
import { layoutTree, treePresentation } from './layout';
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
    data: { concept, level: presentation.levels[concept.id] ?? 1, status: presentation.statuses[concept.id], count: presentation.focused[concept.id] ?? 0, editing,
      onRequired: (level: BloomLevel) => actions?.required(concept.id, level) },
  })), [bundle, presentation, editing, actions]);
  const [nodes, setNodes, onNodesChange] = useNodesState<SkillFlowNode>(initialNodes);
  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);
  const edges: Edge[] = bundle.edges.map((edge) => {
    const status = presentation.statuses[edge.child_node_id];
    return { id: `${edge.parent_node_id}:${edge.child_node_id}`, source: edge.parent_node_id, target: edge.child_node_id,
      type: 'skill', style: { stroke: `var(--${status === 'locked' ? 'border' : status})`, strokeWidth: 2.5 }, deletable: editing };
  });
  const select: NodeMouseHandler<SkillFlowNode> = (_event, node) => onSelect?.(node.id);
  return <div className="canvas-wrap">
    <div className="pillar-strip">{[...bundle.pillars].sort((a, b) => a.order - b.order).map((pillar, index) => <PillarHeader key={pillar.id} index={index} name={pillar.name} editing={editing} rename={(name) => actions?.rename(pillar.id, name)} />)}</div>
    {bundle.nodes.length === 0 ? <div className="center-state"><h2>Your canvas is ready</h2><p>Turn on edit mode and add your first concept.</p></div> : <ReactFlow<SkillFlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      onNodesChange={onNodesChange} onNodeClick={select} onPaneClick={() => onSelect?.(undefined)}
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
