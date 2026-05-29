# Phase 6: History, Compliance, Testing, And Rollout

This phase makes the Cloak integration usable as a payroll product, not just a transaction demo.

## History UI

Update:

```txt
web/src/components/history/PayoutHistoryList.tsx
```

Run-level display:

```txt
Title: Manual pay / Bulk pay
Rail: Cloak private pool
Asset: SOL
Recipients
Gross amount
Fees
Net delivered
Status
Submitted at
Deposit transaction
Private payout count
Recovery state
```

Row-level display:

```txt
Recipient
Wallet
Gross
Fee
Net
Status
Private withdraw signature
Attempts
Error
```

Never show:

```txt
MagicBlock validator
sendTo
ephemeral rollup
wSOL wrapping details
```

## Compliance And Viewing Keys

Cloak supports viewing-key registration and scanning. The docs describe:

- Client-side derivation of viewing material.
- Compact encrypted chain notes.
- `scanTransactions`.
- `toComplianceReport`.
- `formatComplianceCsv`.

Implementation order:

1. First ship fast-send and batch payroll with `enforceViewingKeyRegistration: false` to minimize signing friction.
2. Then add optional compliance registration.
3. Cache the sign-message prompt.
4. Add history scanner/compliance export for registered users.

Do not block core payroll on compliance export unless required.

## Tests

Add unit tests for:

- `cloak/amounts.ts`
- `cloak/fees.ts`
- `payroll/parse-csv.ts`
- `payroll/validate.ts`
- `cloak/batch-queue.ts`
- `cloak/orphan-utxo-store.ts`

Add integration/devnet tests for:

```txt
/pay sends 0.01 SOL privately
/bulk-pay sends 1 row
/bulk-pay sends 10 rows
/bulk-pay handles one row failure
/bulk-pay retry skips confirmed rows
/bulk-pay recovery withdraw returns remaining funds
```

Manual test matrix:

```txt
wallet rejects deposit
wallet lacks signMessage
insufficient SOL
invalid recipient wallet
relay stale root
page reload after deposit
page reload mid-row
recipient receives net amount
history reconstructs run
```

## Devnet Success Criteria

Before mainnet:

- 1-row run succeeds 5 times consecutively.
- 10-row run succeeds 3 times consecutively.
- 50-row run succeeds at least once with no stranded funds.
- Retry path is tested with a forced failure.
- Recovery withdraw is tested after a partial batch.
- Wallet prompt count is documented.
- Fee quote matches actual recipient net within expected protocol behavior.

## Mainnet Readiness

Before mainnet:

- Confirm current Cloak SDK package and program IDs from official docs.
- Confirm fee model from SDK calculators, not just hardcoded constants.
- Confirm audit/security status of Cloak program.
- Confirm relay availability and rate limits.
- Confirm whether devnet-only ALT workaround is still needed.
- Review all logging for secret leaks.
- Move recovery payloads from localStorage to encrypted IndexedDB.

## Rollout Plan

Internal alpha:

- Enable only for one test wallet.
- Limit bulk CSV to 10 rows.
- Show advanced debug status.

Closed beta:

- Limit CSV to 100 rows.
- Enable retry and recovery actions.
- Add support channel instructions for recoverable runs.

Public beta:

- Raise CSV limit to 1000 rows only after repeated successful 100-row tests.
- Add compliance export.
- Add monitoring for failure categories.

## Monitoring

Track:

```txt
deposit started
deposit confirmed
row payout started
row payout confirmed
row payout failed
stale-root retry
recovery state created
recovery state cleared
remaining balance withdrawn
```

Do not include:

```txt
UTXO private key
viewing key
spend key
raw note
blinding
serialized recoverable UTXO
```

## Final Acceptance Criteria

- No MagicBlock product code remains.
- `/pay` and `/bulk-pay` are Cloak-only.
- Manual pay has a simple one-recipient UX.
- Bulk pay has CSV validation, quote preview, live progress, row retry, and recovery.
- History clearly says whether the run was manual or bulk.
- History shows Cloak deposit and private withdraw signatures.
- No recoverable funds are hidden from the user.
- Typecheck and build pass.

