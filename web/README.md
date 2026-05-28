# CipherPay Web App

Next.js frontend for CipherPay private payout runs.

## Setup

Install dependencies:

```bash
pnpm install
```

Create `web/.env.local` from `.env.example`. Required local values include:

- `DATABASE_URL`
- `SESSION_SIGNING_SECRET`
- `INVOICE_ENCRYPTION_KEY`
- MagicBlock private payout config from `.env.example`

Apply the MagicBlock Phase 2 migration:

```bash
pnpm db:migrate:magicblock
```

The migration is idempotent and records applied files in `schema_migrations`.

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
pnpm typecheck
pnpm build
```

From the repo root:

```bash
npx jest
```

## Private Payout Rail

The default payout rail is:

```text
NEXT_PUBLIC_PAYOUT_RAIL=magicblock_private_spl
NEXT_PUBLIC_PRIVATE_PAYOUT_SYMBOL=SOL
NEXT_PUBLIC_PRIVATE_PAYOUT_MINT=So11111111111111111111111111111111111111112
NEXT_PUBLIC_PRIVATE_PAYOUT_DECIMALS=9
```

The browser never signs server-side. The Next API routes proxy MagicBlock transaction-builder requests, validate them against the authenticated wallet and saved payout run, then return unsigned transactions for the connected wallet to sign.

Use `sendTo` from the MagicBlock response to choose the connection:

- `base`: Solana base RPC
- `ephemeral`: MagicBlock ephemeral RPC
