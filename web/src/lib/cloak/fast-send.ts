import type { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

import { applyBufferPolyfill } from "@/lib/buffer-polyfill";
import { cloakConfig } from "@/lib/cloak/config";
import { normalizeCloakError } from "@/lib/cloak/errors";
import { loadMerkleTreeCache, saveMerkleTreeCache } from "@/lib/cloak/merkle-tree-cache";
import { loadCloakRelayAlt } from "@/lib/cloak/relay-alt";
import { createMemoizedSignMessage } from "@/lib/cloak/sign-message-cache";

const WITHDRAW_MAX_ATTEMPTS = 3;
const POST_DEPOSIT_RELAY_DELAY_MS = 4000;

export type CloakSignTransaction = <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;
export type CloakSignMessage = (message: Uint8Array) => Promise<Uint8Array>;

export type FastSendPhase = "deposit-proof" | "deposit-submit" | "withdraw-proof" | "withdraw-submit" | "success";

export type FastSendPrivateSolArgs = {
  amountBaseUnits: bigint;
  recipient: PublicKey;
  sender: PublicKey;
  connection: Connection;
  signTransaction: CloakSignTransaction;
  signMessage: CloakSignMessage;
  onPhase?: (phase: FastSendPhase) => void;
  onProgress?: (message: string) => void;
  onProofProgress?: (percent: number) => void;
  onDepositConfirmed?: (event: { signature: string; depositCommitment?: string }) => Promise<void> | void;
};

export type FastSendPrivateSolResult = {
  depositSignature: string;
  withdrawSignature: string;
  depositCommitment?: string;
};

export async function fastSendPrivateSol(args: FastSendPrivateSolArgs): Promise<FastSendPrivateSolResult> {
  applyBufferPolyfill();

  const {
    amountBaseUnits,
    recipient,
    sender,
    connection,
    signTransaction,
    signMessage,
    onPhase,
    onProgress,
    onProofProgress,
  } = args;

  const {
    createUtxo,
    createZeroUtxo,
    fullWithdraw,
    generateUtxoKeypair,
    isRootNotFoundError,
    transact,
  } = await import("@cloak.dev/sdk");

  const memoizedSignMessage = createMemoizedSignMessage(signMessage);
  const mint = cloakConfig.nativeSolMint;
  const cachedTree = await loadMerkleTreeCache(cloakConfig.cluster, cloakConfig.programId);
  const addressLookupTableAccounts = await loadCloakRelayAlt(connection, cloakConfig.relayUrl);

  try {
    onPhase?.("deposit-proof");
    onProgress?.("Preparing private deposit proof");

    const ephemeralOwner = await generateUtxoKeypair();
    const outputUtxo = await createUtxo(amountBaseUnits, ephemeralOwner, mint);

    let depositPhase: FastSendPhase = "deposit-proof";
    const depositResult = await transact(
      {
        inputUtxos: [await createZeroUtxo(mint)],
        outputUtxos: [outputUtxo],
        externalAmount: amountBaseUnits,
        depositor: sender,
      },
      {
        connection,
        programId: cloakConfig.programId,
        relayUrl: cloakConfig.relayUrl,
        depositorPublicKey: sender,
        walletPublicKey: sender,
        signTransaction,
        signMessage: memoizedSignMessage,
        enforceViewingKeyRegistration: false,
        cachedMerkleTree: cachedTree,
        ...(addressLookupTableAccounts.length > 0 ? { addressLookupTableAccounts } : {}),
        onProgress: (status) => {
          if (depositPhase === "deposit-proof" && isSubmittingStatus(status)) {
            depositPhase = "deposit-submit";
            onPhase?.("deposit-submit");
          }
          onProgress?.(status);
        },
        onProofProgress,
      },
    );

    saveMerkleTreeCache(cloakConfig.cluster, cloakConfig.programId, depositResult.merkleTree);
    await args.onDepositConfirmed?.({
      signature: depositResult.signature,
      depositCommitment: depositResult.outputCommitments[0]?.toString(16),
    });

    let withdrawResult: Awaited<ReturnType<typeof fullWithdraw>> | null = null;
    for (let attempt = 1; attempt <= WITHDRAW_MAX_ATTEMPTS; attempt += 1) {
      onPhase?.("withdraw-proof");
      onProgress?.(
        attempt === 1
          ? "Waiting for Cloak relay to index the deposit"
          : `Refreshing Cloak pool state and retrying private transfer (${attempt}/${WITHDRAW_MAX_ATTEMPTS})`,
      );
      await sleep(POST_DEPOSIT_RELAY_DELAY_MS * attempt);

      try {
        let withdrawPhase: FastSendPhase = "withdraw-proof";
        withdrawResult = await fullWithdraw(depositResult.outputUtxos, recipient, {
          connection,
          programId: cloakConfig.programId,
          relayUrl: cloakConfig.relayUrl,
          walletPublicKey: sender,
          signTransaction,
          signMessage: memoizedSignMessage,
          enforceViewingKeyRegistration: false,
          cachedMerkleTree: depositResult.merkleTree,
          onProgress: (status) => {
            if (withdrawPhase === "withdraw-proof" && isSubmittingStatus(status)) {
              withdrawPhase = "withdraw-submit";
              onPhase?.("withdraw-submit");
            }
            onProgress?.(status);
          },
          onProofProgress,
        });
        break;
      } catch (error) {
        if (attempt < WITHDRAW_MAX_ATTEMPTS && isRetryableWithdrawError(error, isRootNotFoundError)) {
          continue;
        }
        throw error;
      }
    }

    if (!withdrawResult) {
      throw new Error("Cloak withdraw did not return a result.");
    }

    saveMerkleTreeCache(cloakConfig.cluster, cloakConfig.programId, withdrawResult.merkleTree);
    onPhase?.("success");

    return {
      depositSignature: depositResult.signature,
      withdrawSignature: withdrawResult.signature,
      depositCommitment: depositResult.outputCommitments[0]?.toString(16),
    };
  } catch (error) {
    const normalized = normalizeCloakError(error);
    throw new Error(`${normalized.title}: ${normalized.message}`);
  }
}

function isSubmittingStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return (
    normalized.includes("submit") ||
    normalized.includes("send") ||
    normalized.includes("relay") ||
    normalized.includes("broadcast") ||
    normalized.includes("confirm")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableWithdrawError(error: unknown, isRootNotFoundError: (value: unknown) => boolean): boolean {
  if (isRootNotFoundError(error)) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("root not found") ||
    message.includes("stale root") ||
    message.includes("index") ||
    message.includes("not found in merkle tree")
  );
}
