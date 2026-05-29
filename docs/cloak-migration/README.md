# CipherPay Cloak Migration Plan

This folder is the implementation handoff for removing MagicBlock from CipherPay and replacing it with Cloak/Nori-style private payroll.

The target product has two separate screens:

- `/pay`: private send to one recipient.
- `/bulk-pay`: CSV payroll with one funding deposit and many private row payouts.

The core rule is that CipherPay should not try to pack many recipients into one Solana transaction. Cloak is a fixed 2-input / 2-output shielded UTXO protocol. Bulk payroll must be modeled as one private funding note followed by sequential `partialWithdraw` operations.

## Source References

Use these Cloak docs first:

- Cloak AI index: https://docs.cloak.ag/llms.txt
- Full AI context: https://docs.cloak.ag/llms-full.txt
- TypeScript SDK index: https://docs.cloak.ag/sdk/llms.txt
- Transaction flows: https://docs.cloak.ag/platform/transaction-flows
- Protocol architecture: https://docs.cloak.ag/protocol/architecture
- Fee model: https://docs.cloak.ag/protocol/fee-model
- Viewing keys and compliance: https://docs.cloak.ag/architecture/viewing-keys-compliance
- Security: https://docs.cloak.ag/operations/security

Use Nori as the implementation reference:

- Repo: https://github.com/priyanshpatel18/nori
- Local clone, if present: `/tmp/nori`
- Key modules:
  - `/tmp/nori/lib/cloak/fast-send-core.ts`
  - `/tmp/nori/lib/cloak/use-batch-payroll.ts`
  - `/tmp/nori/lib/cloak/batch-queue.ts`
  - `/tmp/nori/lib/cloak/orphan-utxo-store.ts`
  - `/tmp/nori/lib/cloak/utxo-store.ts`
  - `/tmp/nori/lib/cloak/sign-message-cache.ts`
  - `/tmp/nori/lib/payroll/parse-csv.ts`
  - `/tmp/nori/lib/payroll/validate.ts`

## Current CipherPay Files To Expect

The existing app already has the high-level routes:

- `web/src/app/pay/page.tsx`
- `web/src/app/bulk-pay/page.tsx`
- `web/src/components/pay/PayoutRunWorkspace.tsx`
- `web/src/components/history/PayoutHistoryList.tsx`
- `web/src/components/layout/AppShell.tsx`
- `web/src/lib/payout-runs/store.ts`
- `web/src/lib/payout-runs/types.ts`
- `web/db/002_phase1_core_payout_runs.sql`
- `web/db/003_magicblock_private_payouts.sql`

The problem is that the execution, config, DB fields, and history UI are still MagicBlock-shaped. The implementation should replace those semantics, not preserve a MagicBlock fallback.

## Phase Files

Implement in this order:

1. [Remove MagicBlock](./01-remove-magicblock.md)
2. [Cloak SDK Foundation](./02-cloak-sdk-foundation.md)
3. [Database and Types](./03-database-and-types.md)
4. [Manual Pay](./04-manual-pay.md)
5. [Bulk Pay and Recovery](./05-bulk-pay-and-recovery.md)
6. [History, Compliance, Testing, and Rollout](./06-history-testing-rollout.md)

## Definition Of Done

The migration is done only when:

- No product path imports `web/src/lib/magicblock/*`.
- No app route under `web/src/app/api/magicblock/*` is needed.
- `/pay` can send one private SOL payout through Cloak.
- `/bulk-pay` can process CSV payroll through one Cloak deposit and sequential row payouts.
- Failed bulk rows can be retried without re-paying confirmed rows.
- A partially completed bulk run has a recoverable change UTXO.
- History shows `Manual pay` vs `Bulk pay` and `Rail: Cloak private pool`.
- Fees, gross, and net amounts are visible before sending.
- Tests cover amount parsing, fee quotes, CSV validation, row state transitions, and recovery metadata.

