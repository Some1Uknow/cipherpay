import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const PROGRAM_ID = new PublicKey(
  process.env.CIPHERPAY_PROGRAM_ID ?? "HWU77LBoeg7XFpADmc4poPzY1cyVKdVdCygef7xsUMgj",
);

function resolvePath(input: string) {
  return input.startsWith("~/") ? path.join(os.homedir(), input.slice(2)) : input;
}

function loadKeypair(filePath: string) {
  const raw = JSON.parse(fs.readFileSync(resolvePath(filePath), "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function loadIdl() {
  const idlPath = path.resolve(process.cwd(), "target/idl/cipherpay.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  idl.address = PROGRAM_ID.toBase58();
  return idl;
}

function pda(seeds: Buffer[]) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}

function u64Bytes(value: anchor.BN) {
  return value.toArrayLike(Buffer, "le", 8);
}

function u32Bytes(value: number) {
  return new anchor.BN(value).toArrayLike(Buffer, "le", 4);
}

async function main() {
  const rpcUrl =
    process.env.ANCHOR_PROVIDER_URL ??
    process.env.RPC_URL ??
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    clusterApiUrl("devnet");
  const walletPath = process.env.ANCHOR_WALLET ?? "~/.config/solana/id.json";

  const authority = loadKeypair(walletPath);
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(authority), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  const programInfo = await connection.getAccountInfo(PROGRAM_ID, "confirmed");
  if (!programInfo) {
    throw new Error(`Program ${PROGRAM_ID.toBase58()} is not deployed on ${rpcUrl}.`);
  }

  const balance = await connection.getBalance(authority.publicKey, "confirmed");
  if (balance < 100_000_000) {
    throw new Error(
      `Authority ${authority.publicKey.toBase58()} needs devnet SOL. Current balance is ${balance} lamports.`,
    );
  }

  const program = new anchor.Program(loadIdl(), provider) as any;
  const treasury = pda([Buffer.from("treasury"), authority.publicKey.toBuffer()]);
  const treasuryInfo = await connection.getAccountInfo(treasury, "confirmed");
  let initializeTx: string | null = null;

  if (!treasuryInfo) {
    initializeTx = await program.methods
      .initializeTreasury()
      .accounts({
        authority: authority.publicKey,
        treasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  const treasuryState = await program.account.treasury.fetch(treasury);
  if (treasuryState.paused) {
    throw new Error(`Treasury ${treasury.toBase58()} is paused.`);
  }

  const runNumber = treasuryState.nextRunNumber as anchor.BN;
  const payoutRun = pda([Buffer.from("run"), treasury.toBuffer(), u64Bytes(runNumber)]);
  const manifestHash = Array.from(Buffer.alloc(32, 9));
  const recipients = [Keypair.generate().publicKey, Keypair.generate().publicKey];
  const amounts = [125_000_000, 175_000_000];
  const total = amounts.reduce((sum, amount) => sum + amount, 0);

  const createRunTx = await program.methods
    .createPayoutRun(runNumber, recipients.length, new anchor.BN(total), manifestHash)
    .accounts({
      authority: authority.publicKey,
      treasury,
      payoutRun,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const createItemTxs: string[] = [];
  for (let index = 0; index < recipients.length; index += 1) {
    const payoutItem = pda([Buffer.from("item"), payoutRun.toBuffer(), u32Bytes(index)]);
    const tx = await program.methods
      .createPayoutItem(index, recipients[index], new anchor.BN(amounts[index]))
      .accounts({
        authority: authority.publicKey,
        treasury,
        payoutRun,
        payoutItem,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    createItemTxs.push(tx);
  }

  const fundTx = await program.methods
    .fundPayoutRun()
    .accounts({
      authority: authority.publicKey,
      treasury,
      payoutRun,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const beforeBalances = await Promise.all(recipients.map((recipient) => connection.getBalance(recipient, "confirmed")));
  const receiptAddresses = recipients.map((_, index) => pda([Buffer.from("receipt"), payoutRun.toBuffer(), u32Bytes(index)]));
  const remainingAccounts = recipients.flatMap((recipient, index) => [
    {
      pubkey: pda([Buffer.from("item"), payoutRun.toBuffer(), u32Bytes(index)]),
      isWritable: true,
      isSigner: false,
    },
    { pubkey: recipient, isWritable: true, isSigner: false },
    { pubkey: receiptAddresses[index], isWritable: true, isSigner: false },
  ]);

  const executeTx = await program.methods
    .executePayoutItems([0, 1])
    .accounts({
      executor: authority.publicKey,
      treasury,
      payoutRun,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .rpc();

  const runState = await program.account.payoutRun.fetch(payoutRun);
  if (runState.executedItemCount !== recipients.length) {
    throw new Error(`Expected ${recipients.length} executed items, got ${runState.executedItemCount}.`);
  }

  if (!(runState.executedLamports as anchor.BN).eq(new anchor.BN(total))) {
    throw new Error(`Expected executed lamports ${total}, got ${runState.executedLamports.toString()}.`);
  }

  if (!("completed" in runState.status)) {
    throw new Error(`Expected completed run status, got ${JSON.stringify(runState.status)}.`);
  }

  for (let index = 0; index < recipients.length; index += 1) {
    const balanceAfter = await connection.getBalance(recipients[index], "confirmed");
    const received = balanceAfter - beforeBalances[index];
    if (received !== amounts[index]) {
      throw new Error(`Recipient ${index} expected ${amounts[index]} lamports, got ${received}.`);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        rpcUrl,
        programId: PROGRAM_ID.toBase58(),
        authority: authority.publicKey.toBase58(),
        treasury: treasury.toBase58(),
        payoutRun: payoutRun.toBase58(),
        receipts: receiptAddresses.map((address) => address.toBase58()),
        transactions: {
          initializeTreasury: initializeTx,
          createPayoutRun: createRunTx,
          createPayoutItems: createItemTxs,
          fundPayoutRun: fundTx,
          executePayoutItems: executeTx,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
