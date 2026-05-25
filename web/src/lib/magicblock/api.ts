import "server-only";

import { getServerConfig } from "@/lib/server-config";

export type MagicBlockSendTo = "base" | "ephemeral";

export type MagicBlockBuiltTransaction = {
  kind: "deposit" | "withdraw" | "transfer" | "initializeMint";
  version: "legacy" | "v0";
  transactionBase64: string;
  sendTo: MagicBlockSendTo;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  instructionCount: number;
  requiredSigners: string[];
  validator: string;
};

export type MagicBlockPrivateBalance = {
  address: string;
  mint: string;
  ata?: string;
  location: "ephemeral";
  balance: string;
};

export type MagicBlockMintInitialized = {
  mint: string;
  validator: string;
  transferQueue?: string;
  initialized: boolean;
};

type MagicBlockErrorBody = {
  error?: {
    code?: string;
    message?: string;
    issues?: Array<{ message?: string; path?: string[] }>;
  };
};

function apiBase() {
  return getServerConfig().magicblockPaymentsApi.replace(/\/$/, "");
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(`${apiBase()}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

async function parseMagicBlockError(response: Response): Promise<Error> {
  let payload: MagicBlockErrorBody | null = null;
  try {
    payload = (await response.json()) as MagicBlockErrorBody;
  } catch {
    return new Error(`MagicBlock request failed with status ${response.status}.`);
  }

  const code = payload?.error?.code ? `${payload.error.code}: ` : "";
  const issues = payload?.error?.issues?.map((issue) => issue.message).filter(Boolean).join("; ");
  const message = payload?.error?.message ?? issues ?? `MagicBlock request failed with status ${response.status}.`;
  return new Error(`${code}${message}`);
}

async function requestMagicBlock<T>(path: string, init?: RequestInit, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const config = getServerConfig();
  if (!config.magicblockProxyEnabled) {
    throw new Error("MagicBlock proxy is disabled.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.magicblockApiTimeoutMs);

  try {
    const response = await fetch(buildUrl(path, params), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await parseMagicBlockError(response);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("MagicBlock request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getMagicBlockHealth() {
  return requestMagicBlock<{ status: string }>("/health", { method: "GET" });
}

export async function getMagicBlockMintInitialized(params: { mint: string; cluster: string; validator: string }) {
  return requestMagicBlock<MagicBlockMintInitialized>("/v1/spl/is-mint-initialized", { method: "GET" }, params);
}

export async function getMagicBlockChallenge(params: { pubkey: string; cluster: string }) {
  return requestMagicBlock<{ challenge: string }>("/v1/spl/challenge", { method: "GET" }, params);
}

export async function loginMagicBlock(params: { pubkey: string; challenge: string; signature: string; cluster: string }) {
  return requestMagicBlock<{ token: string }>("/v1/spl/login", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getMagicBlockPrivateBalance(params: { address: string; mint: string; cluster: string; token: string }) {
  return requestMagicBlock<MagicBlockPrivateBalance>(
    "/v1/spl/private-balance",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${params.token}` },
    },
    {
      address: params.address,
      mint: params.mint,
      cluster: params.cluster,
    },
  );
}

export async function buildMagicBlockDeposit(params: {
  owner: string;
  amount: string;
  mint: string;
  cluster: string;
  validator: string;
}) {
  return requestMagicBlock<MagicBlockBuiltTransaction>("/v1/spl/deposit", {
    method: "POST",
    body: JSON.stringify({
      owner: params.owner,
      amount: params.amount,
      mint: params.mint,
      cluster: params.cluster,
      validator: params.validator,
      initIfMissing: true,
      initVaultIfMissing: true,
      initAtasIfMissing: true,
      idempotent: true,
    }),
  });
}

export async function buildMagicBlockPrivateTransfer(params: {
  from: string;
  to: string;
  mint: string;
  amount: string;
  cluster: string;
  validator: string;
  split: number;
  minDelayMs: number;
  maxDelayMs: number;
  clientRefId: string;
  token?: string;
}) {
  return requestMagicBlock<MagicBlockBuiltTransaction>("/v1/spl/transfer", {
    method: "POST",
    headers: params.token ? { Authorization: `Bearer ${params.token}` } : undefined,
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      mint: params.mint,
      amount: params.amount,
      visibility: "private",
      fromBalance: "ephemeral",
      toBalance: "ephemeral",
      cluster: params.cluster,
      validator: params.validator,
      initIfMissing: true,
      initAtasIfMissing: true,
      initVaultIfMissing: true,
      minDelayMs: String(params.minDelayMs),
      maxDelayMs: String(params.maxDelayMs),
      clientRefId: params.clientRefId,
      split: params.split,
    }),
  });
}
