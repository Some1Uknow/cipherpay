"use client";

import type { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

import { applyBufferPolyfill } from "@/lib/buffer-polyfill";
import { cloakConfig } from "@/lib/cloak/config";
import { normalizeCloakError } from "@/lib/cloak/errors";
import { isSubmittingStatus, type CloakSignMessage, type CloakSignTransaction } from "@/lib/cloak/fast-send";
import { loadMerkleTreeCache, saveMerkleTreeCache } from "@/lib/cloak/merkle-tree-cache";
import { loadCloakRelayAlt } from "@/lib/cloak/relay-alt";
import { createMemoizedSignMessage } from "@/lib/cloak/sign-message-cache";

export type AgentFundingPhase = "proof" | "submit" | "confirmed";

export type FundAgentWithCloakArgs = {
  amountBaseUnits: bigint;
  owner: PublicKey;
  connection: Connection;
  signTransaction: CloakSignTransaction;
  signMessage: CloakSignMessage;
  onPhase?: (phase: AgentFundingPhase) => void;
  onProgress?: (message: string) => void;
  onProofProgress?: (percent: number) => void;
};

export type FundAgentWithCloakResult = {
  depositSignature: string;
  depositCommitment?: string;
  serializedUtxo: string;
};

export async function fundAgentWithCloak(args: FundAgentWithCloakArgs): Promise<FundAgentWithCloakResult> {
  applyBufferPolyfill();

  const { createUtxo, createZeroUtxo, generateUtxoKeypair, serializeUtxo, transact } = await import("@cloak.dev/sdk");
  const memoizedSignMessage = createMemoizedSignMessage(args.signMessage);
  const cachedTree = await loadMerkleTreeCache(cloakConfig.cluster, cloakConfig.programId);
  const addressLookupTableAccounts = await loadCloakRelayAlt(args.connection, cloakConfig.relayUrl);

  try {
    args.onPhase?.("proof");
    args.onProgress?.("Preparing private funding deposit");

    const ownerKeypair = await generateUtxoKeypair();
    const fundedUtxo = await createUtxo(args.amountBaseUnits, ownerKeypair, cloakConfig.nativeSolMint);
    let phase: AgentFundingPhase = "proof";

    const result = await transact(
      {
        inputUtxos: [await createZeroUtxo(cloakConfig.nativeSolMint)],
        outputUtxos: [fundedUtxo],
        externalAmount: args.amountBaseUnits,
        depositor: args.owner,
      },
      {
        connection: args.connection,
        programId: cloakConfig.programId,
        relayUrl: cloakConfig.relayUrl,
        depositorPublicKey: args.owner,
        walletPublicKey: args.owner,
        signTransaction: args.signTransaction as <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>,
        signMessage: memoizedSignMessage,
        enforceViewingKeyRegistration: false,
        cachedMerkleTree: cachedTree,
        ...(addressLookupTableAccounts.length > 0 ? { addressLookupTableAccounts } : {}),
        onProgress: (status) => {
          if (phase === "proof" && isSubmittingStatus(status)) {
            phase = "submit";
            args.onPhase?.("submit");
          }
          args.onProgress?.(status);
        },
        onProofProgress: (percent) => {
          args.onProofProgress?.(normalizeProofPercent(percent));
        },
      },
    );

    saveMerkleTreeCache(cloakConfig.cluster, cloakConfig.programId, result.merkleTree);
    args.onPhase?.("confirmed");

    return {
      depositSignature: result.signature,
      depositCommitment: result.outputCommitments[0]?.toString(16),
      serializedUtxo: bytesToBase64(serializeUtxo(result.outputUtxos[0])),
    };
  } catch (error) {
    const normalized = normalizeCloakError(error);
    throw new Error(`${normalized.title}: ${normalized.message}`);
  }
}

function normalizeProofPercent(percent: number) {
  const normalized = percent <= 1 ? percent * 100 : percent;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return window.btoa(binary);
}
