"use client";

import * as React from "react";
import {
  BaseEdge,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  getSmoothStepPath,
} from "@xyflow/react";

type HomeNodeKind = "source" | "rail" | "recipient" | "invoice" | "continuation";

type HomeNodeData = {
  title: string;
  eyebrow?: string;
  body?: string;
  amount?: string;
  kind: HomeNodeKind;
};

type HomeEdgeData = {
  tone?: "primary" | "muted";
  moving?: boolean;
  dashed?: boolean;
};

const edgeColor = {
  primary: "#2563eb",
  muted: "#111111",
} as const;

const nodeBaseClass = "border border-[#111] bg-white shadow-neoSm";

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(media.matches);
    };

    update();
    media.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
    };
  }, []);

  return reducedMotion;
}

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 19 6v5.6c0 4.1-2.7 7.7-7 8.9-4.3-1.2-7-4.8-7-8.9V6l7-2.5Z" />
      <path d="m9.5 12 1.7 1.7 3.5-4" />
    </svg>
  );
}

function InvisibleHandles() {
  return (
    <>
      <Handle id="l" type="target" position={Position.Left} className="diagram-handle" />
      <Handle id="r" type="source" position={Position.Right} className="diagram-handle" />
      <Handle id="t" type="target" position={Position.Top} className="diagram-handle" />
      <Handle id="b" type="source" position={Position.Bottom} className="diagram-handle" />
    </>
  );
}

function HomeFlowNode({ data }: NodeProps<Node<HomeNodeData>>) {
  if (data.kind === "rail") {
    return (
      <div className="flex h-32 w-32 items-center justify-center border border-[#111] bg-[var(--brand-primary)] text-white shadow-neo">
        <InvisibleHandles />
        <div className="grid justify-items-center gap-2 text-center">
          <ShieldIcon className="h-10 w-10" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em]">{data.title}</p>
        </div>
      </div>
    );
  }

  if (data.kind === "continuation") {
    return (
      <div className="w-[184px] border border-dashed border-[#111]/45 bg-white/70 px-3 py-2">
        <InvisibleHandles />
        <div className="grid gap-1.5">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-px border-t border-dashed border-[#111]/45" />
          ))}
        </div>
      </div>
    );
  }

  if (data.kind === "recipient") {
    return (
      <div className={`${nodeBaseClass} flex w-[184px] items-center justify-between gap-3 px-3 py-2`}>
        <InvisibleHandles />
        <span className="font-mono-ui text-xs font-semibold text-[var(--brand-ink-deep)]">{data.title}</span>
        <span className="text-[10px] font-semibold text-[var(--brand-primary)]">{data.eyebrow}</span>
      </div>
    );
  }

  if (data.kind === "invoice") {
    return (
      <div className={`${nodeBaseClass} w-[208px] bg-[var(--brand-surface)] p-4`}>
        <InvisibleHandles />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-muted-ink)]">{data.eyebrow}</p>
            <p className="mt-1 text-base font-semibold tracking-[-0.03em] text-[var(--brand-ink-deep)]">{data.title}</p>
          </div>
          <div className="border border-[#111] bg-white px-3 py-2 text-lg font-semibold tracking-[-0.04em] text-[var(--brand-primary)]">
            {data.amount}
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold text-[var(--brand-muted-ink)]">{data.body}</p>
      </div>
    );
  }

  return (
    <div className={`${nodeBaseClass} w-[156px] p-4`}>
      <InvisibleHandles />
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#111] bg-[var(--brand-primary)] text-xs font-black text-white">
          {data.eyebrow}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--brand-ink-deep)]">{data.title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--brand-muted-ink)]">{data.body}</p>
        </div>
      </div>
    </div>
  );
}

function HomeFlowEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps<Edge<HomeEdgeData>>) {
  const reducedMotion = useReducedMotion();
  const tone = data?.tone ?? "primary";
  const color = edgeColor[tone];
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 18,
    offset: 24,
  });

  return (
    <>
      <BaseEdge
        path={path}
        style={{
          ...style,
          stroke: color,
          strokeDasharray: data?.dashed ? "6 8" : undefined,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          strokeOpacity: tone === "muted" ? 0.38 : 0.82,
          strokeWidth: tone === "muted" ? 1.75 : 3,
        }}
      />
      {data?.moving && !reducedMotion ? (
        <circle r="3" fill={color} opacity="0.95">
          <animateMotion dur={tone === "muted" ? "6.2s" : "4.2s"} repeatCount="indefinite" path={path} />
        </circle>
      ) : null}
    </>
  );
}

const nodeTypes = {
  homeFlow: HomeFlowNode,
} as const;

const edgeTypes = {
  beam: HomeFlowEdge,
} as const;

const sharedReactFlowProps = {
  nodeTypes,
  edgeTypes,
  nodesDraggable: false,
  nodesConnectable: false,
  elementsSelectable: false,
  panOnDrag: false,
  zoomOnScroll: false,
  zoomOnPinch: false,
  zoomOnDoubleClick: false,
  preventScrolling: false,
  fitView: true,
  fitViewOptions: { padding: 0.16 },
  proOptions: { hideAttribution: true },
} as const;

const payrollNodes: Node<HomeNodeData>[] = [
  {
    id: "treasury",
    type: "homeFlow",
    position: { x: 18, y: 180 },
    data: { kind: "source", eyebrow: "1", title: "DAO treasury", body: "One wallet" },
    sourcePosition: Position.Right,
    draggable: false,
    selectable: false,
  },
  {
    id: "rail",
    type: "homeFlow",
    position: { x: 252, y: 152 },
    data: { kind: "rail", title: "Private rail" },
    targetPosition: Position.Left,
    sourcePosition: Position.Right,
    draggable: false,
    selectable: false,
  },
  ...([
    ["r1", "8sT9...Qm2A", "#1", 60],
    ["r2", "4nV1...xP77", "#2", 112],
    ["r3", "Gk42...9bFs", "#3", 164],
    ["r4", "2Qp8...Lr6z", "#4", 216],
    ["more", "", "", 266],
    ["r1000", "F9x3...7KpQ", "#1000", 320],
  ] as const).map(([id, title, eyebrow, y]): Node<HomeNodeData> => ({
    id,
    type: "homeFlow",
    position: { x: 502, y: Number(y) },
    data: { kind: id === "more" ? "continuation" : "recipient", title, eyebrow },
    targetPosition: Position.Left,
    draggable: false,
    selectable: false,
  })),
];

const payrollEdges: Edge<HomeEdgeData>[] = [
  {
    id: "treasury-rail",
    source: "treasury",
    target: "rail",
    sourceHandle: "r",
    targetHandle: "l",
    type: "beam",
    data: { moving: true },
  },
  ...(["r1", "r2", "r3", "r4", "r1000"] as const).map((target): Edge<HomeEdgeData> => ({
    id: `rail-${target}`,
    source: "rail",
    target,
    sourceHandle: "r",
    targetHandle: "l",
    type: "beam",
    data: { moving: target !== "r1000", tone: target === "r1000" ? "muted" : "primary", dashed: target === "r1000" },
  })),
  {
    id: "rail-more",
    source: "rail",
    target: "more",
    sourceHandle: "r",
    targetHandle: "l",
    type: "beam",
    data: { tone: "muted", dashed: true },
  },
];

const agentNodes: Node<HomeNodeData>[] = [
  {
    id: "agent",
    type: "homeFlow",
    position: { x: 52, y: 168 },
    data: { kind: "source", eyebrow: "AI", title: "agent.cipher", body: "Private wallet" },
    sourcePosition: Position.Right,
    draggable: false,
    selectable: false,
  },
  {
    id: "rail",
    type: "homeFlow",
    position: { x: 284, y: 152 },
    data: { kind: "rail", title: "Encrypted path" },
    targetPosition: Position.Left,
    sourcePosition: Position.Right,
    draggable: false,
    selectable: false,
  },
  {
    id: "human",
    type: "homeFlow",
    position: { x: 506, y: 82 },
    data: { kind: "invoice", eyebrow: "Human", title: "Design review", amount: "$100", body: "Private invoice path" },
    targetPosition: Position.Left,
    draggable: false,
    selectable: false,
  },
  {
    id: "agent-invoice",
    type: "homeFlow",
    position: { x: 506, y: 254 },
    data: { kind: "invoice", eyebrow: "Agent", title: "Research task", amount: "$100", body: "Private invoice path" },
    targetPosition: Position.Left,
    draggable: false,
    selectable: false,
  },
];

const agentEdges: Edge<HomeEdgeData>[] = [
  {
    id: "agent-rail",
    source: "agent",
    target: "rail",
    sourceHandle: "r",
    targetHandle: "l",
    type: "beam",
    data: { moving: true },
  },
  {
    id: "rail-human",
    source: "rail",
    target: "human",
    sourceHandle: "r",
    targetHandle: "l",
    type: "beam",
    data: { moving: true },
  },
  {
    id: "rail-agent",
    source: "rail",
    target: "agent-invoice",
    sourceHandle: "r",
    targetHandle: "l",
    type: "beam",
    data: { moving: true, dashed: true },
  },
];

function FlowShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[430px] overflow-hidden border border-[#111] bg-white p-0 shadow-neo sm:min-h-[520px]">
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#111_1px,transparent_1px),linear-gradient(90deg,#111_1px,transparent_1px)] [background-size:24px_24px]" />
      {children}
    </div>
  );
}

function FlowCanvas({
  nodes,
  edges,
}: {
  nodes: Node<HomeNodeData>[];
  edges: Edge<HomeEdgeData>[];
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const instanceRef = React.useRef<{ fitView: (options?: { padding?: number }) => void } | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const refit = () => {
      window.requestAnimationFrame(() => {
        instanceRef.current?.fitView({ padding: 0.16 });
      });
    };

    const observer = new ResizeObserver(refit);
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-[430px] w-full sm:h-[520px]">
      <ReactFlow
        {...sharedReactFlowProps}
        className="diagram-flow h-full w-full"
        nodes={nodes}
        edges={edges}
        onInit={(instance) => {
          instanceRef.current = instance;
          window.requestAnimationFrame(() => {
            instance.fitView({ padding: 0.16 });
          });
        }}
      />
    </div>
  );
}

export function PayrollFlowIllustration() {
  return (
    <FlowShell>
      <FlowCanvas nodes={payrollNodes} edges={payrollEdges} />
    </FlowShell>
  );
}

export function AgentInvoiceFlowIllustration() {
  return (
    <FlowShell>
      <div className="absolute inset-x-0 top-0 h-12 border-b border-[#111] bg-[var(--brand-surface-muted)]" />
      <FlowCanvas nodes={agentNodes} edges={agentEdges} />
    </FlowShell>
  );
}
