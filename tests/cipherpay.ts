import {
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
} from "@solana/web3.js";

import {
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createMint,
} from "@solana/spl-token"

import { readFileSync } from "fs";

import * as anchor from "@coral-xyz/anchor";
import { Cipherpay } from "../target/types/cipherpay";
import { Program } from "@coral-xyz/anchor";


describe("CipherPay", () => {
    //const keypairPath = "Turbine-wallet.json";
    //const secretKeyString = readFileSync(keypairPath, "utf8");
    //const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    //const keypair = Keypair.fromSecretKey(secretKey);
    //const wallet = new anchor.Wallet(keypair);

    const connection = new anchor.web3.Connection("http://localhost:8899", "confirmed");
    // Set provider
    //const provider = new anchor.AnchorProvider(connection, wallet, {
    //    preflightCommitment: "processed",
    //});
    const provider = anchor.AnchorProvider.env();

    anchor.setProvider(provider);

    const program = anchor.workspace.cipherpay as Program<Cipherpay>;
    console.log("Program ID: ", program.programId.toBase58());
    console.log("Wallet Address: ", provider.wallet.publicKey.toBase58());
    console.log(connection.rpcEndpoint)

    const client = Keypair.generate()
    const creator = Keypair.generate()
    const mintKeypair = Keypair.generate()

    console.log("Client:",client.publicKey.toBase58())
    console.log("Creator:" ,creator.publicKey.toBase58())

    // let creatorAtaA: PublicKey;
    // let clientAtaA: PublicKey;
    let mintA: PublicKey;


    before(async () => {
        // Function to airdrop and confirm
        async function airdropAndConfirm(pubkey: PublicKey, amount: number) {
            const latestBlockhash = await connection.getLatestBlockhash();
            const sig = await connection.requestAirdrop(pubkey, amount);
            await connection.confirmTransaction({
                signature: sig,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            });
        }
        // // Airdrop 1 SOL to wallet
        // await airdropAndConfirm(provider.wallet.publicKey, 1 * LAMPORTS_PER_SOL);

        // Airdrop 1 SOL to client account
        await airdropAndConfirm(client.publicKey, 10 * LAMPORTS_PER_SOL);
        await airdropAndConfirm(creator.publicKey, 10 * LAMPORTS_PER_SOL);

        console.log("✅ Airdrops completed");

        mintA = await createMint(
            provider.connection,
            client,
            client.publicKey,
            null,
            6,
            mintKeypair,
            undefined,
            TOKEN_2022_PROGRAM_ID
        )

        console.log("✅ Mint completed");
    });

    // Creating creator_account pda
    const [creator_account, creator_account_bump] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"),
        creator.publicKey.toBytes()],
        program.programId
    );

    // Creating client_account pda
    const [client_account, client_account_bump] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"),
        client.publicKey.toBytes()],
        program.programId
    );

    // Creating invoice pda
    const invoice = anchor.web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from("invoice"),
            creator.publicKey.toBytes()
        ],
        program.programId
    )[0];

    // Creating receipt pda
    const receipt = anchor.web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from("receipt"),
            invoice.toBytes(),
            client.publicKey.toBytes()
        ],
        program.programId
    )[0];

    it("Init creator account", async () => {
        const tx = await program.methods
            .register("Jeff")
            .accountsPartial({
                user: creator.publicKey,
                userAccount: creator_account,
                systemProgram: anchor.web3.SystemProgram.programId
            })
            .signers([creator])
            .rpc()

        console.log("tx:", tx)
        const creatorData = await program.account.userAccount.fetch(creator_account);
        console.log("Creator account data:", creatorData);
    })

    it("Init client account", async () => {
        const tx = await program.methods
            .register("John")
            .accountsPartial({
                user: client.publicKey,
                userAccount: client_account,
                systemProgram: anchor.web3.SystemProgram.programId
            })
            .signers([client])
            .rpc()

        console.log("tx:", tx)
        const clientData = await program.account.userAccount.fetch(client_account);
        console.log("Creator account data:", clientData);
    })

    it("Init invoice", async () => {
        const tx = await program.methods
            .createInvoice(new anchor.BN(200))
            .accountsPartial({
                creator: creator.publicKey,
                client: client.publicKey,
                creatorAccount: creator_account,
                clientAccount: client_account,
                invoice: invoice,
                systemProgram: anchor.web3.SystemProgram.programId
            })
            .signers([creator])
            .rpc()

        console.log("tx:", tx)
        const invoiceData = await program.account.invoice.fetch(invoice);
        console.log("Creator account data:", invoiceData);
    })


    it("Make payment", async () => {
        const tx = await program.methods
            .payInvoice(new anchor.BN(1000))
            .accountsPartial({
                creator: creator.publicKey,
                client: client.publicKey,
                mintA,
                clientAccount: client_account,
                creatorAccount: creator_account,
                invoice,
                receipt,
                systemProgram: anchor.web3.SystemProgram.programId,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([client])
            .rpc()

        console.log("tx:", tx)
        const paymentData = (await program.account.invoice.fetch(invoice)).paid;
        const receiptData = await program.account.receipt.fetch(receipt);
        console.log("Invoice payed?", paymentData);
        console.log("Receipt data:", receiptData)

    })
});
