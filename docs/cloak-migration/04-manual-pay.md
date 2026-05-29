# Phase 4: Manual Pay

This phase implements `/pay` as a one-recipient Cloak private send.

## Goal

The user enters:

- Recipient wallet.
- Amount.
- Optional recipient label.

The app performs:

```txt
Cloak deposit -> wait for relay indexing -> Cloak fullWithdraw to recipient
```

## UX Contract

The screen must be minimal:

- Recipient wallet input.
- Amount input.
- Fee/net quote.
- One primary button: `Send privately`.
- Clear progress states.
- Receipt with deposit tx and private withdraw tx.

Do not expose UTXO language to normal users.

## Implementation File

Create:

```txt
web/src/lib/cloak/fast-send.ts
```

Base implementation should follow Nori:

```txt
/tmp/nori/lib/cloak/fast-send-core.ts
```

## Algorithm

```ts
export async function fastSendPrivateSol(args: {
  amountBaseUnits: bigint;
  recipient: PublicKey;
  sender: PublicKey;
  connection: Connection;
  signTransaction: SignTransaction;
  signMessage: SignMessage;
  onPhase?: (phase: FastSendPhase) => void;
  onProgress?: (message: string) => void;
  onProofProgress?: (percent: number) => void;
}): Promise<{
  depositSignature: string;
  withdrawSignature: string;
  depositCommitment?: string;
}>
```

Steps:

1. Apply Buffer polyfill if Cloak/browser needs it.
2. Generate ephemeral UTXO keypair.
3. Create deposit output UTXO for the amount.
4. Load cached Merkle tree.
5. Pre-resolve devnet relay ALT if supported.
6. Call `transact` with:

```ts
{
  inputUtxos: [await createZeroUtxo(mint)],
  outputUtxos: [output],
  externalAmount: amountBaseUnits,
  depositor: sender,
}
```

7. Save `depositResult.merkleTree`.
8. Wait around 4 seconds for relay indexing.
9. Call `fullWithdraw(depositResult.outputUtxos, recipient, options)`.
10. Save withdraw signature and final Merkle tree.

## Cloak Options

Use:

```ts
{
  connection,
  programId: cloakConfig.programId,
  relayUrl: cloakConfig.relayUrl,
  depositorPublicKey: sender,
  walletPublicKey: sender,
  signTransaction,
  signMessage: createMemoizedSignMessage(signMessage),
  enforceViewingKeyRegistration: false,
  cachedMerkleTree,
}
```

For phase 1 implementation, use `enforceViewingKeyRegistration: false` to match Nori fast send and minimize prompts. Add optional compliance registration later.

## Retry Behavior

Withdraw can fail if the relay has not indexed the deposit yet.

Use:

```txt
max withdraw attempts: 3
delay: 4s, 8s, 12s
```

If error is stale-root/root-not-found:

- Clear Merkle cache.
- Retry with fresh tree.

## UI State Mapping

Use phases:

```ts
type FastSendPhase =
  | "deposit-proof"
  | "deposit-submit"
  | "withdraw-proof"
  | "withdraw-submit"
  | "success";
```

Map to user labels:

```txt
deposit-proof    -> Preparing private deposit
deposit-submit   -> Confirming funding transaction
withdraw-proof   -> Preparing private transfer
withdraw-submit  -> Sending privately
success          -> Paid privately
```

## Persistence

After deposit:

- Set run `status = depositing` or `deposit_confirmed`.
- Save `private_deposit_signature`.

After withdraw:

- Set run `status = completed`.
- Set row `row_status = paid_private`.
- Save `private_withdraw_signature`.
- Save fee and net amount.

If deposit succeeds but withdraw fails:

- Set run `status = recoverable`.
- Save deposit signature.
- Show recovery action.

## Acceptance Criteria

- One valid `/pay` transaction reaches recipient wallet.
- History shows deposit signature and withdraw signature.
- The screen does not mention MagicBlock, validators, ERs, or wSOL wrapping.
- Wallet prompt count is deposit tx plus at most one cached sign-message prompt.
- A relay indexing delay does not immediately mark the run failed.

