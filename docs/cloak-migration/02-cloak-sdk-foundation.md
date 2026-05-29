# Phase 2: Cloak SDK Foundation

This phase adds the Cloak SDK boundary and shared primitives. Keep all Cloak integration behind `web/src/lib/cloak/*` so UI components do not know protocol details.

## Dependencies

Add:

```sh
pnpm add @cloak.dev/sdk papaparse
```

If using Nori CSV parsing exactly, also add types if needed:

```sh
pnpm add -D @types/papaparse
```

Check Cloak's current SDK docs before installing because the devnet package story may differ. The docs state the normal package targets mainnet and devnet may require the local-only `@cloak.dev/sdk-devnet` fork.

## New File Layout

Create:

```txt
web/src/lib/cloak/config.ts
web/src/lib/cloak/amounts.ts
web/src/lib/cloak/fees.ts
web/src/lib/cloak/sign-message-cache.ts
web/src/lib/cloak/merkle-tree-cache.ts
web/src/lib/cloak/relay-alt.ts
web/src/lib/cloak/errors.ts
web/src/lib/cloak/utxo-serde.ts
web/src/lib/cloak/fast-send.ts
web/src/lib/cloak/batch-payroll.ts
web/src/lib/cloak/batch-queue.ts
web/src/lib/cloak/orphan-utxo-store.ts
```

Copy concepts from Nori, but adapt names and storage keys to CipherPay.

## `config.ts`

Responsibilities:

- Resolve cluster.
- Resolve Cloak program ID.
- Resolve relay URL.
- Export native SOL mint.
- Export minimum deposit.

Reference values:

```ts
const CLOAK_PROGRAMS = {
  "mainnet-beta": "zh1eLd6rSphLejbFfJEneUwzHRfMKxgzrgkfwA6qRkW",
  devnet: "Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h",
};

const CLOAK_RELAYS = {
  "mainnet-beta": "https://api.cloak.ag",
  devnet: "https://api.devnet.cloak.ag",
};
```

Also export:

```ts
export const SHIELD_DEPOSIT_MIN_LAMPORTS = 10_000_000n;
```

## `amounts.ts`

Replace MagicBlock amount helpers with generic base-unit helpers:

```ts
decimalAmountToBaseUnits(amount: string, decimals: number): bigint
formatBaseUnits(amount: bigint | string, decimals: number): string
sumBaseUnitAmounts(values: bigint[]): bigint
```

Rules:

- Never parse money with floats for execution.
- UI may use `Number` only for display summaries.
- Store base units as decimal strings in DB.

## `fees.ts`

Cloak docs describe fees as:

```txt
fixed SOL fee: 0.005 SOL
variable fee: 0.30%
```

Implement quote helpers:

```ts
quoteCloakSolWithdrawal(grossLamports: bigint): {
  grossLamports: bigint;
  fixedFeeLamports: bigint;
  variableFeeLamports: bigint;
  totalFeeLamports: bigint;
  netLamports: bigint;
}
```

Important: keep the helper isolated. If Cloak SDK exposes fee calculators, use the SDK value as the source of truth and keep this file as a formatting/preview layer.

## `sign-message-cache.ts`

Use Nori's memoized sign-message pattern:

```ts
type SignMessage = (message: Uint8Array) => Promise<Uint8Array>;

export function createMemoizedSignMessage(signMessage: SignMessage): SignMessage {
  const cache = new Map<string, Uint8Array>();
  return async (message) => {
    const key = bytesToHex(message);
    const cached = cache.get(key);
    if (cached) return cached;
    const sig = await signMessage(message);
    cache.set(key, sig);
    return sig;
  };
}
```

This is how Nori keeps prompt count low. Ed25519 signatures are deterministic for the same key and message, so memoizing by message bytes is valid for a session.

## `merkle-tree-cache.ts`

Cache Cloak Merkle tree results per cluster/program/wallet session.

Use this to avoid full relay refetches between:

- Deposit and withdraw in `/pay`.
- Deposit and row payouts in `/bulk-pay`.
- Consecutive row payouts.

Rules:

- If a stale root/root-not-found error occurs, clear the cache.
- On success, save `TransactResult.merkleTree`.

## `relay-alt.ts`

Nori pre-resolves relay address lookup tables on devnet to avoid extra wallet popups. Copy this behavior if Cloak SDK still supports it.

Acceptance target:

- `/bulk-pay` deposit should not create an unexpected extra wallet signature for a relay ALT.

## `errors.ts`

Normalize Cloak errors into user-facing categories:

```txt
stale_root_retryable
relay_indexing_delay
wallet_rejected
insufficient_balance
proof_generation_failed
transaction_failed
recovery_required
unknown
```

Use Cloak SDK helpers such as `isRootNotFoundError` where available.

## Security Rules

Never log:

- UTXO private key.
- Spend key.
- Viewing key `nk`.
- Raw decrypted notes.
- Blinding values.
- Serialized recoverable UTXO payloads.

Signatures, public addresses, public commitments, and row IDs may be logged if needed.

