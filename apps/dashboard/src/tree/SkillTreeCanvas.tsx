import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, ReactFlow, useNodesState, type Connection, type Edge, type NodeMouseHandler } from '@xyflow/react';
import { Crosshair } from 'lucide-react';
import type { BloomLevel, StudentSummary, TreeBundle } from '@friction/shared';
import { SkillNode, type SkillFlowNode } from './SkillNode';
import { SkillEdge } from './edges';
import { layoutTree, treePresentation, CARD_HEIGHT, NODE_WIDTH, STEP_Y } from './layout';
/** Screen-space breathing room above the first row and below the last. */
const TREE_PADDING = 36;
const nodeTypes = { skill: SkillNode };
const edgeTypes = { skill: SkillEdge };
type FlowNode = SkillFlowNode;
export interface CanvasActions {
  connect: (connection: Connection) => void;
  deleteEdge: (parent: string, child: string) => void;
  required: (id: string, level: BloomLevel) => void;
}
export function SkillTreeCanvas({ bundle, students, studentId, editing = false, onSelect, actions }: {
  bundle: TreeBundle; students: StudentSummary[]; studentId?: string; editing?: boolean;
  onSelect?: (id: string | undefined) => void; actions?: CanvasActions;
}) {
  const presentation = useMemo(() => treePresentation(bundle, students, studentId), [bundle, students, studentId]);
  const viewKey = `${bundle.tree.id}:${studentId ?? 'class'}`;
  const placed = useMemo(() => layoutTree(bundle), [bundle]);
  const initialNodes = useMemo<FlowNode[]>(() => placed.map((concept): SkillFlowNode => ({
    id: concept.id, type: 'skill', position: concept.position, draggable: false,
    data: { concept, level: presentation.levels[concept.id] ?? 1, status: presentation.statuses[concept.id], count: presentation.focused[concept.id] ?? 0, editing, viewKey,
      onRequired: (level: BloomLevel) => actions?.required(concept.id, level) },
  })), [placed, presentation, editing, actions, viewKey]);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialNodes);
  const scroller = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [bundle.nodes.length > 0]);
  // No zoom or panning: the tree is a fixed-scale column that scrolls vertically like a page.
  // It only scales down when the widest row would not fit the window's width.
  const bounds = useMemo(() => ({
    left: Math.min(0, ...placed.map((n) => n.position.x)), right: Math.max(0, ...placed.map((n) => n.position.x + NODE_WIDTH)),
    bottom: Math.max(0, ...placed.map((n) => n.position.y + CARD_HEIGHT)),
  }), [placed]);
  // A fixed minimum clips wide rows on mobile and in the sandbox mini-tree, where
  // horizontal navigation is intentionally disabled. Fit the complete row instead.
  const zoom = size.width > 0
    ? Math.min(1, Math.max(1, size.width - 48) / Math.max(1, bounds.right - bounds.left))
    : 1;
  const viewport = { x: size.width / 2 - ((bounds.left + bounds.right) / 2) * zoom, y: TREE_PADDING, zoom };
  const contentHeight = bounds.bottom * zoom + TREE_PADDING * 2;
  // The learning frontier: the first row still in progress (else the last row once everything is mastered, else the top).
  const frontierRow = useMemo(() => {
    const active = placed.filter((n) => presentation.statuses[n.id] === 'active').map((n) => n.depth);
    const allMastered = placed.length > 0 && placed.every((n) => presentation.statuses[n.id] === 'mastered');
    return active.length ? Math.min(...active) : allMastered ? Math.max(0, ...placed.map((n) => n.depth)) : 0;
  }, [placed, presentation]);
  const scrollToFrontier = useCallback((behavior: ScrollBehavior = 'auto') => {
    const element = scroller.current;
    if (!element) return;
    element.scrollTo({ top: TREE_PADDING + (frontierRow * STEP_Y + CARD_HEIGHT / 2) * zoom - element.clientHeight / 2, behavior });
  }, [frontierRow, zoom]);
  // Open on the frontier and return to it when the viewer changes, not on every live update or edit.
  const scrolledFor = useRef<string>(undefined);
  useEffect(() => {
    if (!size.width || scrolledFor.current === viewKey) return;
    scrolledFor.current = viewKey;
    scrollToFrontier();
  }, [size.width, viewKey, scrollToFrontier]);
  // The "back" button only appears once the frontier row has been scrolled out of view.
  const [frontierVisible, setFrontierVisible] = useState(true);
  const checkFrontier = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const top = TREE_PADDING + frontierRow * STEP_Y * zoom, bottom = top + CARD_HEIGHT * zoom;
    setFrontierVisible(bottom > element.scrollTop + 24 && top < element.scrollTop + element.clientHeight - 24);
  }, [frontierRow, zoom]);
  useEffect(checkFrontier, [checkFrontier, size]);
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
      type: 'skill', selected, data: { status, viewKey }, style: { stroke: selected ? 'var(--text)' : `var(--${status === 'locked' ? 'locked-edge' : status})`, strokeWidth: selected ? 3.5 : status === 'mastered' ? 4 : 2.5, strokeDasharray: status === 'locked' && !selected ? '3 7' : undefined, strokeLinecap: 'round' }, deletable: editing };
  });
  const select: NodeMouseHandler<FlowNode> = (_event, node) => onSelect?.(node.id);
  return <div className="canvas-wrap">
    {bundle.nodes.length === 0 ? <div className="center-state"><h2>Your canvas is ready</h2><p>Turn on edit mode and add your first concept.</p></div> : <div className="tree-scroll" ref={scroller} onScroll={checkFrontier}>
      <div className="tree-scroll-content" style={{ height: contentHeight }}>
        <ReactFlow<FlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} viewport={viewport} onViewportChange={() => {}}
          onNodesChange={onNodesChange} onNodeClick={select} onPaneClick={() => { onSelect?.(undefined); setSelectedEdgeIds(new Set()); }}
          onEdgesChange={(changes) => setSelectedEdgeIds((current) => {
            const next = new Set(current);
            for (const change of changes) if (change.type === 'select') { if (change.selected) next.add(change.id); else next.delete(change.id); }
            return next;
          })}
          nodesDraggable={false} nodesConnectable={editing} edgesReconnectable={false}
          panOnDrag={false} panOnScroll={false} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false}
          deleteKeyCode={editing ? ['Backspace', 'Delete'] : null} nodesFocusable edgesFocusable={editing}
          onBeforeDelete={async ({ edges: deletedEdges }) => { for (const edge of deletedEdges) actions?.deleteEdge(edge.source, edge.target); return false; }}
          onConnect={(connection) => actions?.connect(connection)}
          minZoom={zoom} maxZoom={1} proOptions={{ hideAttribution: true }}>
          <Background color="#ddd6ea" gap={24} size={1} />
        </ReactFlow>
      </div>
    </div>}
    {bundle.nodes.length > 0 && !frontierVisible && <button className="frontier-button" aria-label="Back to what you’re learning" title="Back to what you’re learning" onClick={() => scrollToFrontier('smooth')}><Crosshair size={14} /><span className="frontier-label">Back to what you’re learning</span></button>}
    <footer className="canvas-footer"><div className="legend"><span><i className="mastered" />Mastered</span><span><i className="active" />Learning</span><span><i className="locked" />Locked</span></div><span>{bundle.nodes.length} concepts · {bundle.edges.length} connections</span></footer>
  </div>;
}
