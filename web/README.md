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
- Cloak private payout config from `.env.example`

Apply the Cloak private payout migration:

```bash
pnpm db:migrate:cloak
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
NEXT_PUBLIC_PAYOUT_RAIL=cloak
NEXT_PUBLIC_CLOAK_PROGRAM_ID=Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h
NEXT_PUBLIC_CLOAK_RELAY_URL=https://api.devnet.cloak.ag
NEXT_PUBLIC_PRIVATE_PAYOUT_SYMBOL=SOL
NEXT_PUBLIC_PRIVATE_PAYOUT_MINT=So11111111111111111111111111111111111111112
NEXT_PUBLIC_PRIVATE_PAYOUT_DECIMALS=9
```

The browser never signs server-side. Cloak execution will be wired in the manual and bulk send phases; payout run APIs persist draft, progress, row status, and receipt metadata.
