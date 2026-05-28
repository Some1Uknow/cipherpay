"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import {
  BaseEdge,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  getSmoothStepPath,
} from "@xyflow/react";

type DiagramTone = "blue" | "green" | "amber" | "violet";

type ArchitectureNodeData = {
  title: string;
  body: string;
  tone: DiagramTone;
  logo?: ReactNode;
};

const toneStyles: Record<DiagramTone, string> = {
  blue: "bg-[#f5f8ff] text-[#173f91]",
  green: "bg-[#f1fbf6] text-[#176246]",
  amber: "bg-[#fff8e8] text-[#73500b]",
  violet: "bg-[#f8f5ff] text-[#5630b8]",
};

const edgeColors = {
  primary: "#0e5bff",
  settle: "#16845d",
  evidence: "#7c3aed",
} as const;

function LogoBadge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`diagram-logo-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/90 bg-white/92 shadow-[0_10px_22px_rgba(148,163,184,0.18)] ${className}`}
    >
      {children}
    </div>
  );
}

function ArchitectureNode({ data }: NodeProps<Node<ArchitectureNodeData>>) {
  return (
    <div
      className={`diagram-flow-node w-[198px] rounded-[22px] px-4 py-3.5 shadow-[0_22px_42px_rgba(16,33,58,0.10),0_6px_16px_rgba(148,163,184,0.16)] ring-1 ring-white/70 backdrop-blur-[2px] ${toneStyles[data.tone]}`}
    >
      <Handle id="t" type="target" position={Position.Top} className="diagram-handle" />
      <Handle id="l" type="target" position={Position.Left} className="diagram-handle" />
      <Handle id="b" type="source" position={Position.Bottom} className="diagram-handle" />
      <Handle id="r" type="source" position={Position.Right} className="diagram-handle" />
      <div className="flex items-center gap-3">
        {data.logo ?? null}
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-5 tracking-[-0.02em]">{data.title}</p>
          <p className="mt-1 text-xs leading-5 opacity-72">{data.body}</p>
        </div>
      </div>
    </div>
  );
}

function FlowEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps<Edge<{ tone: "primary" | "settle" | "evidence"; particle?: boolean }>>) {
  const tone = data?.tone ?? "primary";
  const color = edgeColors[tone];
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 24,
    offset: 26,
  });

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: color,
          strokeWidth: tone === "evidence" ? 2.25 : 3.25,
          strokeDasharray: tone === "evidence" ? "6 7" : undefined,
        }}
        className={
          tone === "evidence" ? "diagram-path-evidence" : tone === "settle" ? "diagram-path-settle" : "diagram-path-primary"
        }
      />
      {data?.particle ? (
        <circle r="2.5" fill={color} opacity="0.9">
          <animateMotion dur={tone === "settle" ? "5.6s" : "4.8s"} repeatCount="indefinite" path={path} />
        </circle>
      ) : null}
    </>
  );
}

const nodeTypes = {
  architecture: ArchitectureNode,
} as const;

const edgeTypes = {
  flow: FlowEdge,
} as const;

const desktopNodes: Node<ArchitectureNodeData>[] = [
  {
    id: "user",
    type: "architecture",
    position: { x: 42, y: 58 },
    data: {
      title: "User",
      body: "Starts the flow.",
      tone: "amber",
      logo: <LogoBadge className="text-[11px] font-semibold text-[#73500b]">OP</LogoBadge>,
    },
    draggable: false,
    selectable: false,
    sourcePosition: Position.Bottom,
  },
  {
    id: "wallet",
    type: "architecture",
    position: { x: 42, y: 202 },
    data: {
      title: "Wallet",
      body: "Signs auth and transactions.",
      tone: "amber",
      logo: <LogoBadge className="text-[11px] font-semibold text-[#73500b]">W</LogoBadge>,
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
    sourcePosition: Position.Right,
  },
  {
    id: "signin",
    type: "architecture",
    position: { x: 306, y: 58 },
    data: {
      title: "Sign in",
      body: "Verifies wallet ownership.",
      tone: "blue",
      logo: (
        <LogoBadge>
          <Image src="/logo/cipherpay_logo.png" alt="CipherPay" width={30} height={30} className="h-8 w-8 rounded-full" />
        </LogoBadge>
      ),
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Left,
    sourcePosition: Position.Bottom,
  },
  {
    id: "run",
    type: "architecture",
    position: { x: 306, y: 202 },
    data: {
      title: "Run",
      body: "Creates the payout run.",
      tone: "blue",
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
  },
  {
    id: "state",
    type: "architecture",
    position: { x: 306, y: 338 },
    data: {
      title: "State",
      body: "Stores progress and rows.",
      tone: "violet",
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
    sourcePosition: Position.Right,
  },
  {
    id: "magicblock",
    type: "architecture",
    position: { x: 700, y: 58 },
    data: {
      title: "MagicBlock",
      body: "Builds the payout transactions.",
      tone: "green",
      logo: <LogoBadge className="text-[11px] font-semibold text-[#176246]">MB</LogoBadge>,
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Left,
    sourcePosition: Position.Bottom,
  },
  {
    id: "wsol",
    type: "architecture",
    position: { x: 700, y: 206 },
    data: {
      title: "wSOL",
      body: "Wraps only what is needed.",
      tone: "green",
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
  },
  {
    id: "transfer",
    type: "architecture",
    position: { x: 700, y: 336 },
    data: {
      title: "Private transfer",
      body: "Deposits and settles privately.",
      tone: "green",
      logo: (
        <LogoBadge>
          <Image src="/solanaLogo.svg" alt="Solana" width={42} height={24} className="h-5 w-auto" />
        </LogoBadge>
      ),
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
    sourcePosition: Position.Right,
  },
  {
    id: "receiver",
    type: "architecture",
    position: { x: 954, y: 206 },
    data: {
      title: "Receiver",
      body: "Gets paid.",
      tone: "amber",
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Left,
  },
  {
    id: "receipts",
    type: "architecture",
    position: { x: 544, y: 450 },
    data: {
      title: "Receipts",
      body: "Tracks signatures and status.",
      tone: "violet",
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
  },
];

const desktopEdges: Edge<{ tone: "primary" | "settle" | "evidence"; particle?: boolean }>[] = [
  {
    id: "user-wallet",
    source: "user",
    target: "wallet",
    type: "flow",
    data: { tone: "primary", particle: true },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.primary, width: 14, height: 14 },
    sourceHandle: "b",
    targetHandle: "t",
  },
  {
    id: "wallet-signin",
    source: "wallet",
    target: "signin",
    type: "flow",
    data: { tone: "primary", particle: true },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.primary, width: 12, height: 12 },
    sourceHandle: "r",
    targetHandle: "l",
  },
  {
    id: "signin-run",
    source: "signin",
    target: "run",
    type: "flow",
    data: { tone: "primary" },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.primary, width: 12, height: 12 },
    sourceHandle: "b",
    targetHandle: "t",
  },
  {
    id: "run-state",
    source: "run",
    target: "state",
    type: "flow",
    data: { tone: "primary" },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.primary, width: 12, height: 12 },
    sourceHandle: "b",
    targetHandle: "t",
  },
  {
    id: "state-magicblock",
    source: "state",
    target: "magicblock",
    type: "flow",
    data: { tone: "settle", particle: true },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.settle, width: 12, height: 12 },
    sourceHandle: "r",
    targetHandle: "l",
  },
  {
    id: "magicblock-wsol",
    source: "magicblock",
    target: "wsol",
    type: "flow",
    data: { tone: "settle" },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.settle, width: 12, height: 12 },
    sourceHandle: "b",
    targetHandle: "t",
  },
  {
    id: "wsol-transfer",
    source: "wsol",
    target: "transfer",
    type: "flow",
    data: { tone: "settle" },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.settle, width: 12, height: 12 },
    sourceHandle: "b",
    targetHandle: "t",
  },
  {
    id: "transfer-receiver",
    source: "transfer",
    target: "receiver",
    type: "flow",
    data: { tone: "settle", particle: true },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.settle, width: 12, height: 12 },
    sourceHandle: "r",
    targetHandle: "l",
  },
  {
    id: "state-receipts",
    source: "state",
    target: "receipts",
    type: "flow",
    data: { tone: "evidence" },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.evidence, width: 12, height: 12 },
    sourceHandle: "b",
    targetHandle: "l",
  },
  {
    id: "magicblock-receipts",
    source: "magicblock",
    target: "receipts",
    type: "flow",
    data: { tone: "evidence" },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.evidence, width: 12, height: 12 },
    sourceHandle: "b",
    targetHandle: "t",
  },
  {
    id: "transfer-receipts",
    source: "transfer",
    target: "receipts",
    type: "flow",
    data: { tone: "evidence" },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.evidence, width: 12, height: 12 },
    sourceHandle: "b",
    targetHandle: "r",
  },
];

const mobileNodes: Node<ArchitectureNodeData>[] = [
  {
    id: "m-user",
    type: "architecture",
    position: { x: 20, y: 18 },
    data: {
      title: "User",
      body: "Starts the flow.",
      tone: "amber",
      logo: <LogoBadge className="text-[11px] font-semibold text-[#73500b]">OP</LogoBadge>,
    },
    draggable: false,
    selectable: false,
    sourcePosition: Position.Bottom,
  },
  {
    id: "m-wallet",
    type: "architecture",
    position: { x: 20, y: 138 },
    data: {
      title: "Wallet",
      body: "Signs auth and transactions.",
      tone: "amber",
      logo: <LogoBadge className="text-[11px] font-semibold text-[#73500b]">W</LogoBadge>,
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
  },
  {
    id: "m-run",
    type: "architecture",
    position: { x: 20, y: 258 },
    data: {
      title: "Run",
      body: "Signs in and creates the payout run.",
      tone: "blue",
      logo: (
        <LogoBadge>
          <Image src="/logo/cipherpay_logo.png" alt="CipherPay" width={30} height={30} className="h-8 w-8 rounded-full" />
        </LogoBadge>
      ),
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
  },
  {
    id: "m-magicblock",
    type: "architecture",
    position: { x: 20, y: 392 },
    data: {
      title: "MagicBlock",
      body: "Builds the payout transactions.",
      tone: "green",
      logo: <LogoBadge className="text-[11px] font-semibold text-[#176246]">MB</LogoBadge>,
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
  },
  {
    id: "m-transfer",
    type: "architecture",
    position: { x: 20, y: 526 },
    data: {
      title: "Private transfer",
      body: "Wraps, deposits, and settles privately.",
      tone: "green",
      logo: (
        <LogoBadge>
          <Image src="/solanaLogo.svg" alt="Solana" width={42} height={24} className="h-5 w-auto" />
        </LogoBadge>
      ),
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
  },
  {
    id: "m-receipts",
    type: "architecture",
    position: { x: 20, y: 660 },
    data: {
      title: "Receipts",
      body: "Tracks signatures and status.",
      tone: "violet",
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
  },
];

const mobileEdges: Edge<{ tone: "primary" | "settle" | "evidence"; particle?: boolean }>[] = [
  {
    id: "m-user-wallet",
    source: "m-user",
    target: "m-wallet",
    type: "flow",
    data: { tone: "primary", particle: true },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.primary, width: 14, height: 14 },
  },
  {
    id: "m-wallet-run",
    source: "m-wallet",
    target: "m-run",
    type: "flow",
    data: { tone: "primary", particle: true },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.primary, width: 14, height: 14 },
  },
  {
    id: "m-run-magicblock",
    source: "m-run",
    target: "m-magicblock",
    type: "flow",
    data: { tone: "settle", particle: true },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.settle, width: 14, height: 14 },
  },
  {
    id: "m-magicblock-transfer",
    source: "m-magicblock",
    target: "m-transfer",
    type: "flow",
    data: { tone: "settle", particle: true },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.settle, width: 14, height: 14 },
  },
  {
    id: "m-transfer-receipts",
    source: "m-transfer",
    target: "m-receipts",
    type: "flow",
    data: { tone: "evidence" },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.evidence, width: 12, height: 12 },
  },
];

function FlowBoard({
  nodes,
  edges,
  width,
  height,
  children,
}: {
  nodes: Node<ArchitectureNodeData>[];
  edges: Edge<{ tone: "primary" | "settle" | "evidence"; particle?: boolean }>[];
  width: number;
  height: number;
  children?: ReactNode;
}) {
  return (
    <div className="relative" style={{ width, height }}>
      {children}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnDrag={false}
        panOnScroll={false}
        preventScrolling={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        colorMode="light"
        className="diagram-flow"
      />
    </div>
  );
}

export function CipherPayArchitectureDiagram() {
  return (
    <div className="diagram-board rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,250,253,0.95))] p-3 shadow-[0_18px_42px_rgba(148,163,184,0.09)] sm:p-4">
      <div className="hidden overflow-x-auto pb-2 lg:block">
        <div className="mx-auto w-[1180px]">
          <FlowBoard nodes={desktopNodes} edges={desktopEdges} width={1180} height={540}>
            <div className="pointer-events-none absolute inset-x-5 top-5 h-[404px] rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.58),rgba(244,247,251,0.80))] shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]" />

            <div className="absolute left-5 top-5 h-[404px] w-[238px] rounded-[28px] bg-[rgba(248,250,252,0.68)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_18px_36px_rgba(148,163,184,0.08)]" />
            <div className="absolute left-[276px] top-5 h-[404px] w-[308px] rounded-[28px] bg-[rgba(248,250,252,0.70)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_18px_36px_rgba(148,163,184,0.08)]" />
            <div className="absolute left-[620px] top-5 h-[404px] w-[540px] rounded-[28px] bg-[rgba(248,250,252,0.70)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_18px_36px_rgba(148,163,184,0.08)]" />
            <div className="absolute left-[276px] top-[442px] h-[82px] w-[884px] rounded-[24px] bg-[rgba(248,250,252,0.70)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_16px_28px_rgba(148,163,184,0.08)]" />

            <div className="absolute left-[108px] top-[24px] text-[11px] font-medium tracking-[0.04em] text-[#607086]">Operator</div>
            <div className="absolute left-[300px] top-[24px] text-[11px] font-medium tracking-[0.04em] text-[#607086]">CipherPay control plane</div>
            <div className="absolute left-[694px] top-[24px] text-[11px] font-medium tracking-[0.04em] text-[#607086]">Private settlement rail</div>
            <div className="absolute left-[300px] top-[458px] text-[11px] font-medium tracking-[0.04em] text-[#607086]">Evidence loop</div>
          </FlowBoard>
        </div>
      </div>

      <div className="lg:hidden">
        <FlowBoard nodes={mobileNodes} edges={mobileEdges} width={332} height={800}>
          <div className="absolute inset-0 rounded-[26px] border border-[#d7dee8] bg-[rgba(248,250,252,0.82)]" />
        </FlowBoard>
      </div>
    </div>
  );
}
