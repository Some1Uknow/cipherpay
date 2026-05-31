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
