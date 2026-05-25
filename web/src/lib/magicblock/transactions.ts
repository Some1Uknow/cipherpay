import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  type TransactionSignature,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from "@solana/spl-token";

import type { MagicBlockBuiltTransaction, MagicBlockSendTo } from "@/lib/magicblock/api";
import type { PrivatePayoutAsset } from "@/lib/payout-runs/types";

export type SignAndSendTransaction = (
  transaction: Transaction | VersionedTransaction,
  connection: Connection,
  options?: { skipPreflight?: boolean; preflightCommitment?: "processed" | "confirmed" | "finalized" },
) => Promise<TransactionSignature>;

function base64ToBytes(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function deserializeMagicBlockTransaction(built: MagicBlockBuiltTransaction): Transaction | VersionedTransaction {
  const bytes = base64ToBytes(built.transactionBase64);
  return built.version === "v0" ? VersionedTransaction.deserialize(bytes) : Transaction.from(bytes);
}

export function connectionForSendTo(sendTo: MagicBlockSendTo, connections: { base: Connection; ephemeral: Connection }) {
  return sendTo === "ephemeral" ? connections.ephemeral : connections.base;
}

export async function signSendAndConfirmMagicBlockTransaction(params: {
  built: MagicBlockBuiltTransaction;
  sendTransaction: SignAndSendTransaction;
  connections: { base: Connection; ephemeral: Connection };
}) {
  const transaction = deserializeMagicBlockTransaction(params.built);
  const connection = connectionForSendTo(params.built.sendTo, params.connections);
  const signature = await params.sendTransaction(transaction, connection, {
    skipPreflight: params.built.sendTo === "ephemeral",
    preflightCommitment: "confirmed",
  });

  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: params.built.recentBlockhash,
      lastValidBlockHeight: params.built.lastValidBlockHeight,
    },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(`${params.built.kind} transaction confirmed with an error.`);
  }

  return signature;
}

export function buildWrapNativeSolTransaction(params: {
  payer: PublicKey;
  amountBaseUnits: bigint;
  asset: PrivatePayoutAsset;
}): Transaction | null {
  if (params.asset.fundingBehavior !== "wrap_native_sol") return null;

  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, params.payer);
  return new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(params.payer, ata, params.payer, NATIVE_MINT),
    SystemProgram.transfer({
      fromPubkey: params.payer,
      toPubkey: ata,
      lamports: params.amountBaseUnits,
    }),
    createSyncNativeInstruction(ata),
  );
}

export async function signSendAndConfirmBaseTransaction(params: {
  transaction: Transaction;
  payer: PublicKey;
  connection: Connection;
  sendTransaction: SignAndSendTransaction;
}) {
  const latestBlockhash = await params.connection.getLatestBlockhash("confirmed");
  params.transaction.feePayer = params.payer;
  params.transaction.recentBlockhash = latestBlockhash.blockhash;

  const signature = await params.sendTransaction(params.transaction, params.connection, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  const confirmation = await params.connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error("Transaction confirmed with an error.");
  }

  return signature;
}
