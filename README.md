# CipherPay

CipherPay is a Solana payout application for private, auditable payment runs.

CipherPay is migrating to Cloak as the default private payout rail. Users fund payouts with SOL, then CipherPay coordinates shielded-pool deposits and private recipient withdrawals.

## Current Architecture

- Frontend: Next.js app in `web/`
- Auth: Sign-in with Solana wallet
- Database: Postgres
- Public fallback rail: existing Anchor public SOL payout program
- Default private rail: Cloak private pool
- User-facing asset: SOL
- Native SOL mint: `So11111111111111111111111111111111111111112`

Private payout completion is payer-side: a row is paid when the Cloak private withdrawal confirms.

## Run Locally

Install dependencies:

```bash
pnpm install
cd web
pnpm install
```

Configure `web/.env.local` from `web/.env.example`, then apply the Cloak payout schema:

```bash
cd web
pnpm db:migrate:cloak
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Verification

From the repo root:

```bash
npx jest
```

From `web/`:

```bash
pnpm typecheck
pnpm build
```

## Private Payout Flow

1. Add recipients.
2. Review total.
3. Send private payouts.
4. CipherPay deposits the total funding amount into Cloak.
5. Manual pay performs one `fullWithdraw` to the recipient.
6. Bulk pay performs sequential `partialWithdraw` payouts, carrying the change UTXO forward after every row.
7. History records deposit and row-level private withdraw evidence.

## Mainnet Notes

Before mainnet use:

- Run dust SOL tests through Cloak on devnet and mainnet.
- Confirm recipient balances and history reconstruction.
- Confirm recovery behavior for interrupted bulk runs.
- Add USDC only after the SOL flow is stable.
