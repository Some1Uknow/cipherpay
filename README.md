# CipherPay

CipherPay is a Solana payout application for private, auditable payment runs.

Phase 2 uses MagicBlock Private Payments as the default payout rail. Users fund payouts with SOL, while CipherPay wraps SOL to wSOL internally and sends private SPL transfers through MagicBlock ephemeral rollups.

## Current Architecture

- Frontend: Next.js app in `web/`
- Auth: Sign-in with Solana wallet
- Database: Postgres
- Public fallback rail: existing Anchor public SOL payout program
- Default private rail: MagicBlock Private Payments
- User-facing asset: SOL
- Internal private asset: wSOL native mint
- wSOL mint: `So11111111111111111111111111111111111111112`

Private payout completion is payer-side: a row is paid when the MagicBlock private transfer confirms. Recipient withdrawal from MagicBlock private balance is outside the payer completion path.

## Run Locally

Install dependencies:

```bash
pnpm install
cd web
pnpm install
```

Configure `web/.env.local` from `web/.env.example`, then apply the MagicBlock payout schema:

```bash
cd web
pnpm db:migrate:magicblock
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
4. CipherPay checks MagicBlock health and mint initialization.
5. CipherPay checks private balance when MagicBlock auth is available.
6. If needed, CipherPay wraps SOL to wSOL and deposits to MagicBlock.
7. CipherPay sends private `ephemeral -> ephemeral` transfers to recipients.
8. History records deposit and row-level private transfer evidence.

## Mainnet Notes

Before mainnet use:

- Initialize the selected MagicBlock validator for the wSOL mint if needed.
- Run a dust SOL/wSOL test.
- Confirm recipient private balance visibility through the intended MagicBlock-compatible read path.
- Add USDC only after the SOL/wSOL flow is stable.
