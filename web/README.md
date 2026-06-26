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
- ZK shielded-pool private payout config from `.env.example`

Apply the shielded-pool private payout migration:

```bash
pnpm db:migrate:private-rail
pnpm db:migrate:agent-pay
pnpm db:migrate:payables
pnpm db:migrate:agent-pay-overhaul
```

The migration is idempotent and records applied files in `schema_migrations`.

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Agent Pay

Agent Pay links a user-owned wallet to one or more agent-owned wallets. The user installs the CipherPay skill once:

```bash
npx skills add Some1Uknow/cipherpay
```

After that, onboarding happens in natural language. The owner generates a 10-minute linking code in `/agent-pay`, tells the agent to link with that code, and approves the pending link in CipherPay. The skill handles wallet creation, encrypted local state, backup verification, and link submission internally.

Owner APIs create link codes, approve link requests, record funding intents, and manage policy limits. Agent APIs use a per-agent bearer token plus fresh agent-wallet signatures for sensitive calls. v1 stores SOL-only shielded balance state and activity; Cloak funding and spend execution are explicit integration points.

## Payables

The `/payables` page stores recurring recipients with cadence and due dates. Due payables can be selected and converted into a standard bulk approval draft at `/bulk-pay?runId=...`.

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

The default private payout rail is a ZK shielded pool for SOL. Configure the payout rail, shielded-pool program id, proof relay URL, payout symbol, mint, and decimals from `.env.example`.

The browser never signs server-side. Private payout execution runs from the connected wallet; payout run APIs persist draft, progress, row status, UTXO recovery state, and receipt metadata.
