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
pnpm db:migrate:agent-pay
```

The migration is idempotent and records applied files in `schema_migrations`.

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## MCP Payables Agent

CipherPay includes a local stdio MCP server that lets an AI client create payout drafts for wallet approval.
It does not execute payments or sign transactions. It creates a real CipherPay draft, shows it on Agent Pay, then the user opens the exact draft and approves execution with the connected wallet.

Add an API token to `web/.env.local`:

```text
MCP_API_TOKEN=replace-with-a-long-random-secret
```

Start the app:

```bash
pnpm dev
```

Configure your MCP client with:

```json
{
  "mcpServers": {
    "cipherpay": {
      "command": "pnpm",
      "args": ["--dir", "<path-to-cipherpay-repo>/web", "mcp:cipherpay"],
      "env": {
        "CIPHERPAY_APP_URL": "http://localhost:3000",
        "CIPHERPAY_MCP_TOKEN": "replace-with-a-long-random-secret",
        "CIPHERPAY_WALLET_ADDRESS": "your-signed-in-funding-wallet"
      }
    }
  }
}
```

Available tools:

- `parse_payable_instructions`: parses one-payment-per-line text into payout rows.
- `create_payout_draft`: creates a real CipherPay draft from structured rows.
- `draft_payment_from_instructions`: parses text and creates a real draft in one call.

The funding wallet must sign into CipherPay once before the MCP server can create drafts for that user. Created drafts return an approval URL such as `/bulk-pay?runId=...` and also appear in the Agent Pay draft list.

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
