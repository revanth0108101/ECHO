import { useMemo } from "react";
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { MemoryRecord } from "@/lib/echo";

type Props = { memories: MemoryRecord[]; onOpen: (memory: MemoryRecord) => void; className?: string };
const palette = ["#9b8cff", "#57d8e8", "#7caeff", "#e9a9ff", "#f0b96e", "#81ddb5"];

export default function GraphCanvas({ memories, onOpen, className }: Props) {
  const { nodes, edges } = useMemo(() => {
    const categories = [...new Set(memories.map((memory) => memory.category))];
    const groups = new Map(categories.map((category, index) => [category, index]));
    const counts = new Map<string, number>();
    const positions = new Map<number, { x: number; y: number }>();
    const byCategory = new Map<string, MemoryRecord[]>();
    for (const memory of memories) byCategory.set(memory.category, [...(byCategory.get(memory.category) ?? []), memory]);
    byCategory.forEach((items, category) => {
      const group = groups.get(category) ?? 0;
      const groupAngle = (Math.PI * 2 * group) / Math.max(categories.length, 1) - Math.PI / 2;
      const cx = 470 + Math.cos(groupAngle) * (categories.length > 1 ? 260 : 0);
      const cy = 330 + Math.sin(groupAngle) * (categories.length > 1 ? 205 : 0);
      items.forEach((memory, index) => {
        const indexAngle = (Math.PI * 2 * index) / Math.max(items.length, 1);
        const radius = items.length > 1 ? 62 + items.length * 11 : 0;
        positions.set(memory.id, { x: cx + Math.cos(indexAngle) * radius, y: cy + Math.sin(indexAngle) * radius });
      });
    });
    const flowNodes: Node[] = memories.map((memory) => {
      const group = groups.get(memory.category) ?? 0;
      const color = palette[group % palette.length]!;
      counts.set(memory.category, (counts.get(memory.category) ?? 0) + 1);
      return {
        id: String(memory.id), position: positions.get(memory.id) ?? { x: 0, y: 0 },
        data: { label: <div className="flow-node-content"><span className="flow-node-dot" style={{ background: color, boxShadow: `0 0 13px ${color}77` }} /><span className="flow-node-text"><strong>{memory.title}</strong><small>{memory.category}</small></span></div> },
        style: { borderColor: `${color}66`, background: "#171925", color: "#eeedf6", width: 198, padding: "12px 13px", borderRadius: 13, boxShadow: `0 6px 30px ${color}12` },
      };
    });
    const seen = new Set<string>();
    const flowEdges: Edge[] = [];
    memories.forEach((memory) => memory.relatedIds.forEach((relatedId) => {
      const a = Math.min(memory.id, relatedId); const b = Math.max(memory.id, relatedId); const id = `${a}-${b}`;
      if (seen.has(id) || !memories.some((item) => item.id === relatedId)) return;
      seen.add(id);
      const color = palette[(groups.get(memory.category) ?? 0) % palette.length]!;
      flowEdges.push({ id, source: String(a), target: String(b), animated: false, style: { stroke: `${color}86`, strokeWidth: 1.7 }, interactionWidth: 16 });
    }));
    return { nodes: flowNodes, edges: flowEdges };
  }, [memories]);

  return (
    <div className={`graph-canvas ${className ?? ""}`}>
      {!memories.length ? <div className="graph-empty"><span className="empty-orbit">✳</span><h3>Your network starts with a memory.</h3><p>Capture a note and it will have a place in your map.</p></div> : <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        onNodeClick={(_, node) => { const item = memories.find((memory) => memory.id === Number(node.id)); if (item) onOpen(item); }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#35384b" gap={28} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(node) => String(node.style?.borderColor ?? "#9b8cff")} maskColor="rgba(9,10,16,.7)" />
      </ReactFlow>}
    </div>
  );
}
