"use client";
import { createContext, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PersonNode, type PersonNodeData } from "./PersonNode";
import { GenerationAxis, type GenerationRow } from "./GenerationAxis";
import { PositionBar } from "./PositionBar";
import { TREE_LAYOUT_CONSTS, type LayoutResult } from "@/lib/services/tree-layout";
import type { LayoutIndex } from "@/lib/services/layout-index";

const nodeTypes = { person: PersonNode };

/** 当前选中的人物 id；放进 Context，避免每次切换都重建 10K 节点数组 */
export const SelectedIdContext = createContext<string | null>(null);

export interface TreeCanvasProps {
  layout: LayoutResult;
  /** 由 TreeView 在 layout 变化时构建一次，传入复用 */
  layoutIndex: LayoutIndex;
  generationChars: Record<number, string>;
  /** 数据已按此聚焦人物过滤，画布加载后自动居中到该节点 */
  focusPersonId?: string | null;
  /** 当前选中（外部受控）；用于高亮 */
  selectedId: string | null;
  /** 选中变化时回调（点击节点 / 搜索定位 / 焦点初始 / 跳转） */
  onSelectChange: (id: string | null) => void;
  /** 居住地映射：personId → 解析结果 */
  residenceByPersonId?: Record<
    string,
    { fullText: string; short: string; fromPersonId: string; inherited: boolean }
  >;
  /** 折叠状态（外部受控）。空集 = 没有节点被折叠 */
  collapsedIds: Set<string>;
  /** 切换某节点折叠（双击触发） */
  onToggleCollapsed: (id: string) => void;
  /** 全部折叠 / 全部展开（左下角按钮触发） */
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

export function TreeCanvas(props: TreeCanvasProps) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function TreeCanvasInner({
  layout,
  layoutIndex,
  generationChars,
  focusPersonId,
  selectedId,
  onSelectChange,
  residenceByPersonId,
  collapsedIds,
  onToggleCollapsed,
  onCollapseAll,
  onExpandAll,
}: TreeCanvasProps) {
  // 来自搜索框的临时定位参数：locate=PID + n=NONCE（每次搜索都换 nonce 触发居中）
  const sp = useSearchParams();
  const locateId = sp.get("locate");
  const locateNonce = sp.get("n");

  // 折叠语义统一用 layoutIndex.visibleChildrenOf（与后代数计数一致）
  const childrenByParent = layoutIndex.visibleChildrenOf;
  const descendantCountOf = layoutIndex.descendantCountOf;

  // 计算被隐藏的节点 id：从每个折叠点向下 BFS
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const id of collapsedIds) {
      const queue = [...(childrenByParent.get(id) ?? [])];
      while (queue.length) {
        const cur = queue.shift()!;
        if (hidden.has(cur)) continue;
        hidden.add(cur);
        const next = childrenByParent.get(cur) ?? [];
        for (const n of next) queue.push(n);
      }
    }
    return hidden;
  }, [collapsedIds, childrenByParent]);

  // ⚠️ 关键性能：不要把 selectedId 放进 deps，否则每次点击都重建 10K 节点
  // 选中态通过 SelectedIdContext 读取，PersonNode 内自比 id。
  //
  // 此处禁止读取 performance.now() / Date.now() 等不纯函数（react-hooks/purity）；
  // 原本的耗时日志已移除——开发态可用 React Profiler 替代。
  const { nodes, edges } = useMemo(() => {
    const ns: Node<PersonNodeData>[] = layout.nodes
      .filter((n) => !hiddenIds.has(n.id))
      .map((n) => {
        const r = residenceByPersonId?.[n.id];
        return {
          id: n.id,
          type: "person",
          position: { x: n.x, y: n.y },
          data: {
            name: n.person.name,
            gender: n.person.gender,
            generationChar: n.person.generationChar,
            isMarriedIn: n.person.isMarriedIn,
            status: n.person.status,
            isCollapsed: collapsedIds.has(n.id),
            hasChildren: (childrenByParent.get(n.id)?.length ?? 0) > 0,
            descendantCount: descendantCountOf.get(n.id) ?? 0,
            residenceShort: r?.short ?? null,
            residenceFull: r?.fullText ?? null,
            residenceInherited: r?.inherited ?? false,
            residenceColor: r ? colorFromKey(r.fullText) : null,
          },
          draggable: false,
          selectable: true,
        };
      });

    const es: Edge[] = layout.edges
      .filter((e) => !e.hidden && !hiddenIds.has(e.source) && !hiddenIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.kind === "marriage" ? "right" : "bottom",
        targetHandle: e.kind === "marriage" ? "left" : "top",
        type: e.kind === "marriage" ? "straight" : "smoothstep",
        style:
          e.kind === "marriage"
            ? { stroke: "#9ca3af", strokeWidth: 2 }
            : { stroke: "#94a3b8", strokeWidth: 1.5 },
      }));

    return { nodes: ns, edges: es };
  }, [layout, hiddenIds, collapsedIds, childrenByParent, descendantCountOf, residenceByPersonId]);

  const axisRows: GenerationRow[] = useMemo(() => {
    const rows: GenerationRow[] = [];
    for (const g of layout.generations) {
      const sample = layout.nodes.find(
        (n) => n.person.generation === g && !hiddenIds.has(n.id),
      );
      if (sample) {
        rows.push({
          generation: g,
          layoutY: sample.y,
          char: generationChars[g] ?? null,
        });
      }
    }
    return rows;
  }, [layout, generationChars, hiddenIds]);

  const rf = useReactFlow();

  // 单击：通知父级更新 selectedId
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, n) => {
      onSelectChange(n.id);
    },
    [onSelectChange],
  );

  // 双击：切换折叠状态——委托给父级（受控）
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (e, n) => {
      e.preventDefault?.();
      onToggleCollapsed(n.id);
    },
    [onToggleCollapsed],
  );

  // 聚焦 / 定位居中：仅当下列触发源 token 变化时才居中，避免 onSelectChange / layout
  // 引用变化导致回跳，覆盖用户后来的点击。
  // - focus 模式 / 搜索定位 都使用一个稳定 token：focusId|locateId#nonce
  const lastTriggeredRef = useRef<string | null>(null);
  const trigger = `${focusPersonId ?? ""}|${locateId ?? ""}#${locateNonce ?? ""}`;
  useEffect(() => {
    const targetId = locateId || focusPersonId;
    if (!targetId) return;
    if (lastTriggeredRef.current === trigger) return;
    const target = layout.nodes.find((n) => n.id === targetId);
    if (!target) return;
    lastTriggeredRef.current = trigger;
    const { NODE_W, NODE_H } = TREE_LAYOUT_CONSTS;
    const t = setTimeout(() => {
      rf.setCenter(target.x + NODE_W / 2, target.y + NODE_H / 2, {
        zoom: 1,
        duration: 500,
      });
      onSelectChange(targetId);
    }, 100);
    return () => clearTimeout(t);
  }, [trigger, focusPersonId, locateId, layout, rf, onSelectChange]);

  // 全部折叠 / 全部展开按钮 → 委托外部 actions
  const collapseAll = onCollapseAll;
  const expandAll = onExpandAll;

  return (
    <SelectedIdContext.Provider value={selectedId}>
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.05}
        maxZoom={2}
        panOnDrag
        panOnScroll
        zoomOnPinch
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onlyRenderVisibleElements
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="#e4e4e7" />
        <Controls position="bottom-right" showInteractive={false} />
        {nodes.length <= 1500 && (
          <MiniMap
            position="top-right"
            pannable
            zoomable
            nodeColor={(n) => {
              const data = n.data as PersonNodeData;
              return data.gender === "MALE"
                ? "#bfdbfe"
                : data.gender === "FEMALE"
                  ? "#fbcfe8"
                  : "#e4e4e7";
            }}
            className="!hidden md:!block"
          />
        )}
        <GenerationAxis rows={axisRows} />
        <PositionBar
          worldWidth={layout.width}
          worldHeight={layout.height}
        />
      </ReactFlow>

      {/* 折叠/展开按钮（左下角） */}
      <div className="pointer-events-auto absolute bottom-3 left-3 z-10 flex gap-1 text-xs">
        <button
          onClick={collapseAll}
          className="rounded-md bg-white/90 px-2 py-1 text-zinc-700 shadow hover:bg-zinc-100 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          全部折叠
        </button>
        <button
          onClick={expandAll}
          className="rounded-md bg-white/90 px-2 py-1 text-zinc-700 shadow hover:bg-zinc-100 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          全部展开
        </button>
        {collapsedIds.size > 0 && (
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-zinc-500 dark:bg-zinc-800">
            已折叠 {collapsedIds.size}
          </span>
        )}
      </div>

    </div>
    </SelectedIdContext.Provider>
  );
}

// 13 种饱和度适中的色板，用 fnv1a 哈希村名稳定映射
const RESIDENCE_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#10b981", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#ec4899",
];

function colorFromKey(key: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return RESIDENCE_PALETTE[Math.abs(h) % RESIDENCE_PALETTE.length];
}
