import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

import type { PayoutRowDraft } from "@/lib/payout-runs/types";

export type PreparedPayoutInstruction = {
  rowId: string;
  transaction: Transaction;
  destinationAta: PublicKey;
  amountAtomic: bigint;
};

export type PaymentContract = {
  mint: PublicKey;
  symbol: string;
  decimals: number;
  tokenProgram: PublicKey;
};

export async function resolvePaymentContract(params: {
  connection: Connection;
  mintAddress: string;
  fallbackDecimals: number;
  symbol: string;
}): Promise<PaymentContract> {
  const mint = new PublicKey(params.mintAddress);
  const mintAccountInfo = await params.connection.getAccountInfo(mint);
  if (!mintAccountInfo) {
    throw new Error("Configured payout mint was not found on this cluster.");
  }

  const tokenProgram = mintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const mintInfo = await getMint(params.connection, mint, "confirmed", tokenProgram);

  return {
    mint,
    symbol: params.symbol,
    decimals: mintInfo.decimals ?? params.fallbackDecimals,
    tokenProgram,
  };
}

export async function assertSourceBalance(params: {
  connection: Connection;
  owner: PublicKey;
  contract: PaymentContract;
  rows: PayoutRowDraft[];
}): Promise<{ sourceAta: PublicKey; totalAtomic: bigint }> {
  const sourceAta = getAssociatedTokenAddressSync(params.contract.mint, params.owner, false, params.contract.tokenProgram);
  const sourceAccountInfo = await params.connection.getAccountInfo(sourceAta);
  if (!sourceAccountInfo) {
    throw new Error(`Funding wallet does not have a ${params.contract.symbol} token account.`);
  }

  const totalAtomic = params.rows.reduce((sum, row) => {
    const normalized = Number(row.amount);
    return sum + BigInt(Math.round(normalized * 10 ** params.contract.decimals));
  }, BigInt(0));

  const balance = await params.connection.getTokenAccountBalance(sourceAta, "confirmed");
  const rawAmount = BigInt(balance.value.amount);

  if (rawAmount < totalAtomic) {
    throw new Error(`Funding wallet does not have enough ${params.contract.symbol} to cover this payout run.`);
  }

  return { sourceAta, totalAtomic };
}

export function buildPayoutTransaction(params: {
  payer: PublicKey;
  sourceAta: PublicKey;
  contract: PaymentContract;
  row: PayoutRowDraft;
}): PreparedPayoutInstruction {
  const destinationOwner = new PublicKey(params.row.walletAddress.trim());
  const destinationAta = getAssociatedTokenAddressSync(
    params.contract.mint,
    destinationOwner,
    false,
    params.contract.tokenProgram,
  );
  const amountAtomic = BigInt(Math.round(Number(params.row.amount) * 10 ** params.contract.decimals));

  const transaction = new Transaction();
  transaction.add(
    createAssociatedTokenAccountIdempotentInstruction(
      params.payer,
      destinationAta,
      destinationOwner,
      params.contract.mint,
      params.contract.tokenProgram,
    ),
  );
  transaction.add(
    createTransferCheckedInstruction(
      params.sourceAta,
      params.contract.mint,
      destinationAta,
      params.payer,
      amountAtomic,
      params.contract.decimals,
      [],
      params.contract.tokenProgram,
    ),
  );

  return {
    rowId: params.row.id,
    transaction,
    destinationAta,
    amountAtomic,
  };
}
