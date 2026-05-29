# Phase 1: Remove MagicBlock

This phase strips MagicBlock out of CipherPay's private payout surface. Do this before adding Cloak execution, otherwise the codebase will keep mixing two incompatible privacy models.

## Goal

Remove MagicBlock from:

- Runtime config.
- Server API routes.
- Client execution code.
- Payout persistence names.
- History UI.
- Marketing/architecture copy.

The product should have one private rail: `cloak`.

## Files To Remove Or Replace

Delete these after their callers are migrated:

- `web/src/lib/magicblock/api.ts`
- `web/src/lib/magicblock/amounts.ts`
- `web/src/lib/magicblock/config.ts`
- `web/src/lib/magicblock/private-payouts.ts`
- `web/src/lib/magicblock/transactions.ts`
- `web/src/app/api/magicblock/challenge/route.ts`
- `web/src/app/api/magicblock/deposit/route.ts`
- `web/src/app/api/magicblock/health/route.ts`
- `web/src/app/api/magicblock/is-mint-initialized/route.ts`
- `web/src/app/api/magicblock/login/route.ts`
- `web/src/app/api/magicblock/private-balance/route.ts`
- `web/src/app/api/magicblock/transfer/route.ts`
- `tests/magicblock-amounts.test.js`

Remove this package script:

```json
"db:migrate:magicblock": "node scripts/apply-db-migration.mjs db/003_magicblock_private_payouts.sql"
```

## Rename Product Concepts

Use these names everywhere after the migration:

```txt
magicblockDepositSignature  -> privateDepositSignature or cloakDepositSignature
magicblockTransferSignature -> privateWithdrawSignature or cloakWithdrawSignature
magicblockPrivateStatus     -> privateRailStatus
magicblockValidator         -> remove
magicblockDepositSendTo     -> remove
magicblockTransferSendTo    -> remove
payout_rail default         -> cloak
```

Prefer generic persistence names such as `private_deposit_signature` and `private_withdraw_signature` unless a field is truly Cloak-specific. This keeps the product data model cleaner.

## Config Cleanup

Remove these public/server config fields if present:

```txt
NEXT_PUBLIC_MAGICBLOCK_PAYMENTS_API
NEXT_PUBLIC_MAGICBLOCK_CLUSTER
NEXT_PUBLIC_MAGICBLOCK_EPHEMERAL_RPC_URL
NEXT_PUBLIC_MAGICBLOCK_EPHEMERAL_WS_URL
NEXT_PUBLIC_MAGICBLOCK_BASE_RPC_URL
NEXT_PUBLIC_MAGICBLOCK_VALIDATOR
MAGICBLOCK_PROXY_ENABLED
MAGICBLOCK_API_TIMEOUT_MS
```

Replace with:

```txt
NEXT_PUBLIC_PRIVACY_RAIL=cloak
NEXT_PUBLIC_CLOAK_CLUSTER=devnet
NEXT_PUBLIC_CLOAK_PROGRAM_ID=Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h
NEXT_PUBLIC_CLOAK_RELAY_URL=https://api.devnet.cloak.ag
NEXT_PUBLIC_SOLANA_RPC_URL=<devnet rpc>
```

For mainnet:

```txt
NEXT_PUBLIC_CLOAK_CLUSTER=mainnet-beta
NEXT_PUBLIC_CLOAK_PROGRAM_ID=zh1eLd6rSphLejbFfJEneUwzHRfMKxgzrgkfwA6qRkW
NEXT_PUBLIC_CLOAK_RELAY_URL=https://api.cloak.ag
```

## UI Cleanup

Update `web/src/components/history/PayoutHistoryList.tsx`:

- Stop showing MagicBlock validator.
- Stop showing `sendTo`.
- Stop using `magicblockTransferSignature`.
- Show `Rail: Cloak private pool`.
- Show run mode as `Manual pay` or `Bulk pay`.
- Show deposit signature and private withdraw signatures.

Update `web/src/components/pay/PayoutRunWorkspace.tsx`:

- Remove `isMagicBlockPrivateRailEnabled`.
- Remove ephemeral MagicBlock connection.
- Remove MagicBlock deposit/private balance language.
- Replace execution with Cloak fast send or Cloak batch payroll depending on route.

## Marketing Cleanup

Search for:

```sh
rg -n "MagicBlock|magicblock|ephemeral|validator|private spl|private_spl" .
```

Product copy should not mention MagicBlock after this migration. If architecture diagrams mention MagicBlock, either remove the section or replace it with Cloak private pool.

## Acceptance Criteria

- `rg -n "magicblock|MagicBlock" web/src` returns no product-code matches.
- `/pay` and `/bulk-pay` still load after MagicBlock imports are removed.
- TypeScript errors are only Cloak implementation TODOs, not stale MagicBlock references.

