# Phase 5: Bulk Pay And Recovery

This phase implements `/bulk-pay` using the Nori batch payroll pattern.

## Goal

CSV payroll should support many recipients with low wallet prompts:

```txt
one deposit signature
one cached signMessage if needed
zero wallet popups per recipient row
```

The app must process rows sequentially because Cloak's circuit is fixed 2-input / 2-output.

## Core Flow

```txt
parse CSV
validate every row
quote gross/fee/net
deposit total gross into one private UTXO
for each row:
  partialWithdraw from current UTXO to recipient
  receive change UTXO
  persist change UTXO
  mark row paid or failed
```

## Implementation References

Use these Nori files:

- `/tmp/nori/lib/cloak/use-batch-payroll.ts`
- `/tmp/nori/lib/cloak/batch-queue.ts`
- `/tmp/nori/lib/cloak/orphan-utxo-store.ts`
- `/tmp/nori/lib/payroll/parse-csv.ts`
- `/tmp/nori/lib/payroll/validate.ts`

CipherPay should adapt these into non-hook core functions plus a React hook/UI wrapper.

## CSV Parser

Create:

```txt
web/src/lib/payroll/parse-csv.ts
web/src/lib/payroll/validate.ts
```

Supported headers:

```txt
wallet, wallet_address, address, recipient
amount, amount_sol, value
label, name, memo, note
```

Limits:

```txt
soft limit: 1000 rows
no deposit if any row is invalid
```

Every parsed row should keep:

```ts
{
  rowNumber: number;
  wallet: string;
  amount: string;
  label?: string;
}
```

Every validated row should compute:

```ts
{
  amountBaseUnits: bigint;
  feeBaseUnits: bigint;
  netBaseUnits: bigint;
  isValid: boolean;
}
```

## Batch Execution API

Create:

```txt
web/src/lib/cloak/batch-payroll.ts
```

Export:

```ts
export async function runCloakBatchPayroll(args: {
  runId: string;
  rows: BatchRowInput[];
  mint: PublicKey;
  sender: PublicKey;
  connection: Connection;
  signTransaction: SignTransaction;
  signMessage: SignMessage;
  persistRunStatus: PersistRunStatus;
  onProgress?: (event: BatchProgressEvent) => void;
}): Promise<BatchPayrollResult>
```

`BatchRowInput`:

```ts
{
  id: string;
  position: number;
  recipient: string;
  amountBaseUnits: bigint;
  feeBaseUnits: bigint;
  netBaseUnits: bigint;
}
```

## Deposit Step

```ts
const totalGross = rows.reduce((sum, row) => sum + row.amountBaseUnits, 0n);
const ephemeralKeypair = await generateUtxoKeypair();
const depositOutput = await createUtxo(totalGross, ephemeralKeypair, mint);

const depositResult = await transact(
  {
    inputUtxos: [await createZeroUtxo(mint)],
    outputUtxos: [depositOutput],
    externalAmount: totalGross,
    depositor: sender,
  },
  options,
);
```

Immediately after deposit succeeds:

- Save deposit signature to Postgres.
- Save recoverable orphan/change UTXO locally.
- Save queue state locally.
- Set run `status = deposit_confirmed`.

This must happen before the first row payout.

## Row Payout Step

```ts
let currentUtxo = depositResult.outputUtxos[0];
let cachedTree = depositResult.merkleTree;

for (const row of rows) {
  await sleep(4000);

  const result = await partialWithdraw(
    [currentUtxo],
    new PublicKey(row.recipient),
    row.amountBaseUnits,
    optionsWithCachedTree,
  );

  currentUtxo = result.outputUtxos[0];
  cachedTree = result.merkleTree ?? cachedTree;

  persist row paid
  persist new currentUtxo
}
```

On each successful row:

- Save `private_withdraw_signature`.
- Mark row `paid_private`.
- Update `current_change_utxo_commitment`.
- Update local orphan UTXO to latest change UTXO.
- Save Merkle tree cache.

On failure:

- Mark row `failed`.
- Increment attempt count.
- Continue to next row only if current UTXO is still valid and unspent.
- If failure ambiguity exists, stop and mark run `recoverable`.

## Recovery Model

Create:

```txt
web/src/lib/cloak/batch-queue.ts
web/src/lib/cloak/orphan-utxo-store.ts
```

Initial storage can use localStorage like Nori, but use CipherPay names:

```txt
cipherpay:cloak:batch-queue:v1
cipherpay:cloak:orphan-utxo:v1
cipherpay:cloak:merkle-tree:v1
```

Persist:

```ts
{
  runId: string;
  sender: string;
  cluster: string;
  depositSignature: string;
  totalRaw: string;
  rowsRemaining: number;
  currentRowIndex: number;
  currentChangeUtxo: SerializedUtxo;
  rows: Array<{
    rowId: string;
    recipient: string;
    amountRaw: string;
    netRaw: string;
    state: "pending" | "in-flight" | "confirmed" | "failed";
    attempts: number;
    payoutSignature?: string;
    errorMessage?: string;
  }>;
}
```

Do not log this payload. It contains spend-critical material.

## Retry Failed Rows

Retry flow:

1. Load batch queue by `runId`.
2. Load orphan/change UTXO by `runId`.
3. Reset `in-flight` rows to `pending`.
4. Resume from latest saved change UTXO.
5. Skip confirmed rows.
6. Run only pending/failed rows.

If there is no recoverable UTXO, do not attempt retry. Show a recovery error.

## Withdraw Remaining Balance

If a batch is abandoned or partially failed, add an action:

```txt
Withdraw remaining private balance back to funding wallet
```

This should call `fullWithdraw([currentChangeUtxo], sender, options)` and then clear the orphan record.

## UX

Bulk page sections:

1. CSV upload/dropzone.
2. Validation table.
3. Quote summary:
   - recipients
   - total gross
   - estimated fees
   - estimated net delivered
4. Start button.
5. Live progress:
   - deposit proof
   - deposit submit
   - paying row N of M
   - paid count
   - failed count
6. Recovery panel:
   - retry failed
   - withdraw remaining
   - export recovery bundle

## Acceptance Criteria

- 1-row batch works.
- 10-row batch works.
- 50-row batch works.
- Page reload after deposit does not strand funds.
- Failed rows can be retried without re-paying confirmed rows.
- Wallet does not prompt once per row.
- History accurately shows paid, failed, and recoverable rows.

