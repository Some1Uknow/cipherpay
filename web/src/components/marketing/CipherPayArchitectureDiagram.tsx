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
  blue: "bg-white text-[#111]",
  green: "bg-white text-[#111]",
  amber: "bg-white text-[#111]",
  violet: "bg-white text-[#111]",
};

const edgeColors = {
  primary: "#2563eb",
  settle: "#111111",
  evidence: "#5f6368",
} as const;

const DESKTOP_DIAGRAM_WIDTH = 1180;
const DESKTOP_DIAGRAM_HEIGHT = 540;
const DESKTOP_DIAGRAM_SCALE = 0.78;
const DESKTOP_RENDERED_WIDTH = DESKTOP_DIAGRAM_WIDTH * DESKTOP_DIAGRAM_SCALE;
const DESKTOP_RENDERED_HEIGHT = DESKTOP_DIAGRAM_HEIGHT * DESKTOP_DIAGRAM_SCALE;

function LogoBadge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`diagram-logo-soft flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--brand-border)] bg-white ${className}`}
    >
      {children}
    </div>
  );
}

function ArchitectureNode({ data }: NodeProps<Node<ArchitectureNodeData>>) {
  return (
    <div
      className={`diagram-flow-node w-[198px] border border-[#111] px-3 py-3 shadow-neoSm ${toneStyles[data.tone]}`}
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

const diagramLogos = {
  user: (
    <LogoBadge>
      <Image src="/logo/diagram/user.svg" alt="User" width={28} height={28} className="h-7 w-7" />
    </LogoBadge>
  ),
  wallet: (
    <LogoBadge>
      <Image src="/logo/diagram/phantom.svg" alt="Phantom" width={28} height={28} className="h-7 w-7" />
    </LogoBadge>
  ),
  signin: (
    <LogoBadge>
      <Image src="/logo/diagram/key.svg" alt="Sign in" width={28} height={28} className="h-7 w-7" />
    </LogoBadge>
  ),
  run: (
    <LogoBadge>
      <Image src="/logo/diagram/clipboard.svg" alt="Payout run" width={28} height={28} className="h-7 w-7" />
    </LogoBadge>
  ),
  state: (
    <LogoBadge>
      <Image src="/logo/diagram/postgres.svg" alt="Postgres" width={28} height={28} className="h-7 w-7" />
    </LogoBadge>
  ),
  shieldedPool: (
    <LogoBadge>
      <Image src="/logo/diagram/key.svg" alt="ZK shielded pool" width={28} height={28} className="h-7 w-7" />
    </LogoBadge>
  ),
  shieldedSol: (
    <LogoBadge>
      <Image src="/logo/diagram/solana-logo-mark.svg" alt="Solana" width={32} height={28} className="h-6 w-auto" />
    </LogoBadge>
  ),
  transfer: (
    <LogoBadge>
      <Image src="/logo/diagram/transfer.svg" alt="Transfer" width={28} height={28} className="h-7 w-7" />
    </LogoBadge>
  ),
  receiver: (
    <LogoBadge>
      <Image src="/logo/diagram/receiver.svg" alt="Receiver" width={28} height={28} className="h-7 w-7" />
    </LogoBadge>
  ),
  receipts: (
    <LogoBadge>
      <Image src="/logo/diagram/receipt.svg" alt="Receipts" width={28} height={28} className="h-7 w-7" />
    </LogoBadge>
  ),
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
      logo: diagramLogos.user,
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
      logo: diagramLogos.wallet,
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
      logo: diagramLogos.signin,
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
      logo: diagramLogos.run,
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
      logo: diagramLogos.state,
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
    sourcePosition: Position.Right,
  },
  {
    id: "shielded-pool",
    type: "architecture",
    position: { x: 700, y: 58 },
    data: {
      title: "ZK shielded pool",
      body: "Verifies deposits, roots, and nullifiers.",
      tone: "green",
      logo: diagramLogos.shieldedPool,
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
      title: "Shielded SOL",
      body: "Holds shielded SOL notes.",
      tone: "green",
      logo: diagramLogos.shieldedSol,
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
      logo: diagramLogos.transfer,
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
      logo: diagramLogos.receiver,
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Left,
  },
  {
    id: "receipts",
    type: "architecture",
    position: { x: 544, y: 436 },
    data: {
      title: "Receipts",
      body: "Tracks signatures and status.",
      tone: "violet",
      logo: diagramLogos.receipts,
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
    id: "state-shielded-pool",
    source: "state",
    target: "shielded-pool",
    type: "flow",
    data: { tone: "settle", particle: true },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.settle, width: 12, height: 12 },
    sourceHandle: "r",
    targetHandle: "l",
  },
  {
    id: "shielded-pool-wsol",
    source: "shielded-pool",
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
    id: "shielded-pool-receipts",
    source: "shielded-pool",
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
      logo: diagramLogos.user,
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
      logo: diagramLogos.wallet,
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
      logo: diagramLogos.run,
    },
    draggable: false,
    selectable: false,
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
  },
  {
    id: "m-shielded-pool",
    type: "architecture",
    position: { x: 20, y: 392 },
    data: {
      title: "ZK shielded pool",
      body: "Verifies roots and nullifiers.",
      tone: "green",
      logo: diagramLogos.shieldedPool,
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
      body: "Deposits and settles privately.",
      tone: "green",
      logo: diagramLogos.transfer,
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
      logo: diagramLogos.receipts,
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
    id: "m-run-shielded-pool",
    source: "m-run",
    target: "m-shielded-pool",
    type: "flow",
    data: { tone: "settle", particle: true },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColors.settle, width: 14, height: 14 },
  },
  {
    id: "m-shielded-pool-transfer",
    source: "m-shielded-pool",
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
    <div className="diagram-board overflow-hidden border border-[var(--brand-border)] bg-white p-3 shadow-neoSm sm:p-4">
      <div className="hidden lg:block">
        <div
          className="mx-auto"
          style={{
            width: "100%",
            maxWidth: `${DESKTOP_RENDERED_WIDTH}px`,
            height: `${DESKTOP_RENDERED_HEIGHT}px`,
          }}
        >
          <div
            style={{
              width: `${DESKTOP_DIAGRAM_WIDTH}px`,
              height: `${DESKTOP_DIAGRAM_HEIGHT}px`,
              transform: `scale(${DESKTOP_DIAGRAM_SCALE})`,
              transformOrigin: "top left",
            }}
          >
            <FlowBoard nodes={desktopNodes} edges={desktopEdges} width={DESKTOP_DIAGRAM_WIDTH} height={DESKTOP_DIAGRAM_HEIGHT}>
              <div className="pointer-events-none absolute inset-x-5 top-5 h-[404px] border border-[var(--brand-border)] bg-[var(--brand-surface)]" />

              <div className="absolute left-5 top-5 h-[404px] w-[238px] border border-[var(--brand-border)] bg-white" />
              <div className="absolute left-[276px] top-5 h-[404px] w-[308px] border border-[var(--brand-border)] bg-white" />
              <div className="absolute left-[620px] top-5 h-[404px] w-[540px] border border-[var(--brand-border)] bg-white" />
              <div className="absolute left-[276px] top-[428px] h-[96px] w-[884px] border border-[var(--brand-border)] bg-white" />

              <div className="absolute left-[108px] top-[24px] text-[11px] font-medium tracking-[0.04em] text-[#607086]">Operator</div>
              <div className="absolute left-[300px] top-[24px] text-[11px] font-medium tracking-[0.04em] text-[#607086]">CipherPay control plane</div>
              <div className="absolute left-[694px] top-[24px] text-[11px] font-medium tracking-[0.04em] text-[#607086]">Private settlement rail</div>
              <div className="absolute left-[300px] top-[444px] text-[11px] font-medium tracking-[0.04em] text-[#607086]">Evidence loop</div>
            </FlowBoard>
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <FlowBoard nodes={mobileNodes} edges={mobileEdges} width={332} height={800}>
          <div className="absolute inset-0 border border-[var(--brand-border)] bg-white" />
        </FlowBoard>
      </div>
    </div>
  );
}
