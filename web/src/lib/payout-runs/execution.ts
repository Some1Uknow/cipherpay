import { BN, BorshAccountsCoder, BorshInstructionCoder, type Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";

import cipherpayIdl from "../../../public/idl/cipherpay.json";
import type { PayoutRowDraft } from "@/lib/payout-runs/types";
import { publicConfig } from "@/lib/public-config";

export const MAX_PAYOUTS_PER_CHUNK = 8;

const IDL = cipherpayIdl as Idl & { address: string };
const PROGRAM_ID = new PublicKey(publicConfig.cipherpayProgramId || IDL.address);
const instructionCoder = new BorshInstructionCoder(IDL);
const accountCoder = new BorshAccountsCoder(IDL);
const U64_MAX = BigInt("18446744073709551615");

type TreasuryState = {
  authority: PublicKey;
  paused: boolean;
  nextRunNumber?: BN;
  next_run_number?: BN;
};

export type PaymentContract = {
  kind: "native-sol";
  symbol: string;
  decimals: number;
  programId: PublicKey;
};

export type PayoutExecutionChunk = {
  transaction: Transaction;
  rowIds: string[];
  itemIndexes: number[];
  receiptAddresses: PublicKey[];
};

export type PayoutRunTransactionPlan = {
  treasury: PublicKey;
  payoutRun: PublicKey;
  runNumber: bigint;
  totalAtomic: bigint;
  setupTransactions: Transaction[];
  fundTransaction: Transaction | null;
  executionChunks: PayoutExecutionChunk[];
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toAtomicAmount(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!trimmed || trimmed.startsWith("-")) {
    throw new Error("Amount must be a positive SOL value.");
  }

  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) {
    throw new Error("Amount must be a valid decimal SOL value.");
  }

  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  const atomic = BigInt(whole) * (BigInt(10) ** BigInt(decimals)) + BigInt(paddedFraction || "0");
  if (atomic <= BigInt(0)) {
    throw new Error("Amount must be greater than zero.");
  }
  if (atomic > U64_MAX) {
    throw new Error("Amount is too large for a Solana u64 lamport value.");
  }

  return atomic;
}

function toBn(value: bigint): BN {
  return new BN(value.toString());
}

function toU32(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 4_294_967_295) {
    throw new Error("Payout item index is out of u32 range.");
  }
  return value;
}

function treasuryPda(authority: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury"), authority.toBuffer()], PROGRAM_ID)[0];
}

function payoutRunPda(treasury: PublicKey, runNumber: bigint): PublicKey {
  const runNumberBytes = Buffer.alloc(8);
  runNumberBytes.writeBigUInt64LE(runNumber);
  return PublicKey.findProgramAddressSync([Buffer.from("run"), treasury.toBuffer(), runNumberBytes], PROGRAM_ID)[0];
}

function payoutItemPda(payoutRun: PublicKey, itemIndex: number): PublicKey {
  const itemIndexBytes = Buffer.alloc(4);
  itemIndexBytes.writeUInt32LE(itemIndex);
  return PublicKey.findProgramAddressSync([Buffer.from("item"), payoutRun.toBuffer(), itemIndexBytes], PROGRAM_ID)[0];
}

function payoutReceiptPda(payoutRun: PublicKey, itemIndex: number): PublicKey {
  const itemIndexBytes = Buffer.alloc(4);
  itemIndexBytes.writeUInt32LE(itemIndex);
  return PublicKey.findProgramAddressSync([Buffer.from("receipt"), payoutRun.toBuffer(), itemIndexBytes], PROGRAM_ID)[0];
}

function buildInstruction(name: string, keys: TransactionInstruction["keys"], args: Record<string, unknown> = {}) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: instructionCoder.encode(name, args),
  });
}

function writable(pubkey: PublicKey, isSigner = false) {
  return { pubkey, isSigner, isWritable: true };
}

function readonly(pubkey: PublicKey, isSigner = false) {
  return { pubkey, isSigner, isWritable: false };
}

function initializeTreasuryIx(authority: PublicKey, treasury: PublicKey) {
  return buildInstruction("initialize_treasury", [
    writable(authority, true),
    writable(treasury),
    readonly(SystemProgram.programId),
  ]);
}

function createPayoutRunIx(params: {
  authority: PublicKey;
  treasury: PublicKey;
  payoutRun: PublicKey;
  runNumber: bigint;
  expectedItemCount: number;
  totalLamports: bigint;
  manifestHash: number[];
}) {
  return buildInstruction(
    "create_payout_run",
    [writable(params.authority, true), writable(params.treasury), writable(params.payoutRun), readonly(SystemProgram.programId)],
    {
      run_number: toBn(params.runNumber),
      expected_item_count: toU32(params.expectedItemCount),
      total_lamports: toBn(params.totalLamports),
      manifest_hash: params.manifestHash,
    },
  );
}

function createPayoutItemIx(params: {
  authority: PublicKey;
  treasury: PublicKey;
  payoutRun: PublicKey;
  payoutItem: PublicKey;
  itemIndex: number;
  recipient: PublicKey;
  lamports: bigint;
}) {
  return buildInstruction(
    "create_payout_item",
    [
      writable(params.authority, true),
      writable(params.treasury),
      writable(params.payoutRun),
      writable(params.payoutItem),
      readonly(SystemProgram.programId),
    ],
    {
      item_index: toU32(params.itemIndex),
      recipient: params.recipient,
      lamports: toBn(params.lamports),
    },
  );
}

function fundPayoutRunIx(authority: PublicKey, treasury: PublicKey, payoutRun: PublicKey) {
  return buildInstruction("fund_payout_run", [
    writable(authority, true),
    writable(treasury),
    writable(payoutRun),
    readonly(SystemProgram.programId),
  ]);
}

function executePayoutItemsIx(params: {
  executor: PublicKey;
  treasury: PublicKey;
  payoutRun: PublicKey;
  items: Array<{ itemIndex: number; recipient: PublicKey }>;
}) {
  return buildInstruction(
    "execute_payout_items",
    [
      writable(params.executor, true),
      readonly(params.treasury),
      writable(params.payoutRun),
      readonly(SystemProgram.programId),
      ...params.items.flatMap(({ itemIndex, recipient }) => [
        writable(payoutItemPda(params.payoutRun, itemIndex)),
        writable(recipient),
        writable(payoutReceiptPda(params.payoutRun, itemIndex)),
      ]),
    ],
    { item_indexes: params.items.map((item) => toU32(item.itemIndex)) },
  );
}

async function buildManifestHash(rows: Array<{ walletAddress: string; lamports: bigint }>) {
  const canonical = JSON.stringify(
    rows.map((row, index) => ({
      index,
      wallet: new PublicKey(row.walletAddress.trim()).toBase58(),
      lamports: row.lamports.toString(),
    })),
  );
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest));
}

async function fetchTreasuryState(connection: Connection, treasury: PublicKey): Promise<TreasuryState | null> {
  const accountInfo = await connection.getAccountInfo(treasury, "confirmed");
  if (!accountInfo) return null;
  return accountCoder.decode("Treasury", accountInfo.data) as TreasuryState;
}

function readNextRunNumber(treasuryState: TreasuryState): bigint {
  const nextRunNumber = treasuryState.nextRunNumber ?? treasuryState.next_run_number;
  if (!nextRunNumber) {
    throw new Error("Could not read treasury run sequence from the on-chain treasury account.");
  }

  return BigInt(nextRunNumber.toString());
}

export async function resolvePaymentContract(): Promise<PaymentContract> {
  return {
    kind: "native-sol",
    symbol: "SOL",
    decimals: 9,
    programId: PROGRAM_ID,
  };
}

export async function assertSourceBalance(params: {
  connection: Connection;
  owner: PublicKey;
  contract: PaymentContract;
  rows: PayoutRowDraft[];
}): Promise<{ totalAtomic: bigint }> {
  const totalAtomic = params.rows.reduce((sum, row) => sum + toAtomicAmount(row.amount, params.contract.decimals), BigInt(0));
  const balance = await params.connection.getBalance(params.owner, "confirmed");
  const setupChunkCount = Math.ceil(params.rows.length / MAX_PAYOUTS_PER_CHUNK);
  const executeChunkCount = Math.ceil(params.rows.length / MAX_PAYOUTS_PER_CHUNK);
  const feeReserve = BigInt(20_000 * Math.max(setupChunkCount + executeChunkCount + 2, 1));

  if (BigInt(balance) < totalAtomic + feeReserve) {
    throw new Error(`Funding wallet does not have enough SOL to cover this payout run, account rent, and transaction fees.`);
  }

  return { totalAtomic };
}

export async function buildPayoutRunTransactionPlan(params: {
  connection: Connection;
  payer: PublicKey;
  rows: PayoutRowDraft[];
}): Promise<PayoutRunTransactionPlan> {
  if (params.rows.length === 0) {
    throw new Error("Add at least one valid recipient before sending.");
  }

  const normalizedRows = params.rows.map((row) => ({
    ...row,
    recipient: new PublicKey(row.walletAddress.trim()),
    lamports: toAtomicAmount(row.amount, 9),
  }));
  const totalAtomic = normalizedRows.reduce((sum, row) => sum + row.lamports, BigInt(0));
  const treasury = treasuryPda(params.payer);
  const treasuryState = await fetchTreasuryState(params.connection, treasury);

  if (treasuryState?.paused) {
    throw new Error("This treasury is paused. Unpause before creating a payout run.");
  }
  if (treasuryState && !treasuryState.authority.equals(params.payer)) {
    throw new Error("Connected wallet is not the authority for this treasury.");
  }

  const runNumber = treasuryState ? readNextRunNumber(treasuryState) : BigInt(0);
  const payoutRun = payoutRunPda(treasury, runNumber);
  const manifestHash = await buildManifestHash(normalizedRows);
  const setupTransactions: Transaction[] = [];
  const setupChunks = chunk(normalizedRows, MAX_PAYOUTS_PER_CHUNK);

  setupChunks.forEach((rowsChunk, chunkIndex) => {
    const transaction = new Transaction();
    if (chunkIndex === 0) {
      if (!treasuryState) {
        transaction.add(initializeTreasuryIx(params.payer, treasury));
      }
      transaction.add(
        createPayoutRunIx({
          authority: params.payer,
          treasury,
          payoutRun,
          runNumber,
          expectedItemCount: normalizedRows.length,
          totalLamports: totalAtomic,
          manifestHash,
        }),
      );
    }

    rowsChunk.forEach((row, offset) => {
      const itemIndex = chunkIndex * MAX_PAYOUTS_PER_CHUNK + offset;
      transaction.add(
        createPayoutItemIx({
          authority: params.payer,
          treasury,
          payoutRun,
          payoutItem: payoutItemPda(payoutRun, itemIndex),
          itemIndex,
          recipient: row.recipient,
          lamports: row.lamports,
        }),
      );
    });

    if (chunkIndex === setupChunks.length - 1) {
      transaction.add(fundPayoutRunIx(params.payer, treasury, payoutRun));
    }

    setupTransactions.push(transaction);
  });

  const executionChunks = chunk(normalizedRows, MAX_PAYOUTS_PER_CHUNK).map((rowsChunk, chunkIndex) => {
    const items = rowsChunk.map((row, offset) => ({
      itemIndex: chunkIndex * MAX_PAYOUTS_PER_CHUNK + offset,
      recipient: row.recipient,
    }));

    return {
      transaction: new Transaction().add(
        executePayoutItemsIx({
          executor: params.payer,
          treasury,
          payoutRun,
          items,
        }),
      ),
      rowIds: rowsChunk.map((row) => row.id),
      itemIndexes: items.map((item) => item.itemIndex),
      receiptAddresses: items.map((item) => payoutReceiptPda(payoutRun, item.itemIndex)),
    };
  });

  return {
    treasury,
    payoutRun,
    runNumber,
    totalAtomic,
    setupTransactions,
    fundTransaction: null,
    executionChunks,
  };
}
