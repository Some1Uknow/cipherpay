# CipherPay

CipherPay is a private payroll + payout workspace for Solana.

---

## What this repository contains

- **`web/`** — Next.js 15 app (React 19) with:
  - `/pay` (single payment) and `/bulk-pay` (batch payroll) UX
  - A durable **payout run** store in Postgres (draft → ready → depositing → paying → completed/recoverable)
  - A **ZK proof and shielded pool private payout rail** (deposit once, then withdraw)
  - **Agent Pay** for linked agent wallets, funding requests, invoices, and owner policy review

- **`programs/cipherpay/`** — Anchor program implementing protocol primitives:
  - `Treasury` (authority + run sequence)
  - `PayoutRun` (manifest hash + totals + counters)
  - `PayoutItem` (recipient + amount)
  - `PayoutReceipt` (immutable execution receipt)

---

## Architecture (end-to-end)

```mermaid
flowchart TB
  subgraph Browser["Browser"]
    UI["CipherPay UI<br/>/pay /bulk-pay /agent-pay"]
    WALLET["Wallet Adapter<br/>Phantom / Solflare / Backpack"]
  end

  subgraph App["Next.js App"]
    AUTH["SIWS Auth<br/>challenge + verify"]
    API["API Routes<br/>drafts, runs, Agent Pay"]
    RUNS["Payout Run State<br/>status, rows, recovery"]
  end

  subgraph Data["Data"]
    PG[(Postgres)]
  end

  subgraph Solana["Solana"]
    RPC["Solana RPC"]
    RELAY["Proof Relay<br/>proof generation + submit"]
    POOL["ZK Shielded Pool<br/>commitments, roots, nullifiers"]
    CP["CipherPay Program<br/>receipts + manifest hash"]
  end

  UI --> AUTH
  AUTH --> PG
  UI --> API
  API --> RUNS
  RUNS --> PG

  UI <--> WALLET
  WALLET --> RELAY
  RELAY --> RPC
  RPC --> POOL
  RPC --> CP

  RELAY --> RUNS
  CP --> RUNS
```

---

## Private payout execution model

CipherPay’s privacy rail is deliberately “deposit once, pay many”.

### Manual pay (single recipient)

![Manual pay flow](web/public/singe_pay.png)

- Generate a private **deposit proof** for the payment amount.
- After the relay indexes the deposit, generate a private **withdraw proof** to the recipient.

### Bulk pay (batch payroll)

![Bulk pay flow](web/public/bulk_pay.png)

- Create **one** private deposit for the batch total.
- Execute sequential private `partialWithdraw` per row; the **change UTXO** becomes the input to the next row.

This is what enables clean recovery: the run can persist `current_change_utxo_commitment` and row status (`queued/paying/paid_private/failed`).

---

## Data model (Postgres)

### Core payout tables

- `payout_runs`
  - `entry_mode`: `manual | csv`
  - `status`: `draft | ready | depositing | deposit_confirmed | paying | partially_paid | completed | failed | recoverable`
  - `source`: `app | payables`
  - On-chain Metadata: `private_deposit_signature`, `private_status`, `current_change_utxo_commitment`, `recovery_state`, totals in base units

- `payout_run_items`
  - Row status: `draft | ready | queued | paying | paid_private | failed`
  - Optional per-row evidence: `private_withdraw_signature`, `private_commitment`, `private_nullifier`
  - `attempt_count`, `last_attempt_at`

### Security + audit supporting tables

- Auth: `auth_nonces`, `sessions` (token hashes stored server-side)
- Invoices: memo/reference ciphertext + nonces (encrypted fields)

---

## Agent Pay

![Agent pay drafts](web/public/ai_pay.png)

CipherPay Agent Pay links the user's official wallet to one or more agent-owned wallets. The end-user flow is deliberately small:

```bash
npx skills add Some1Uknow/cipherpay
```

After installing the skill, the user opens `/agent-pay`, generates a one-use code, and tells the agent: `Link yourself to CipherPay with code XXXX-XXXX.` The skill handles wallet creation, encrypted local state, recovery backup verification, and link submission in chat. The owner approves the pending link inside CipherPay.

Agent APIs use a per-agent bearer token plus fresh agent-wallet signatures for sensitive calls such as funding requests and invoice creation.

---

## Hard numbers (from code, not vibes)

Operational limits & constants:

- **CSV limits (defaults):** 2.0 MB upload cap (`MAX_CSV_UPLOAD_BYTES=2,097,152`), **1,000-row** import cap (`MAX_CSV_IMPORT_ROWS=1000`).
- **Manual private transfer retry budget:** up to **3** withdraw attempts (stale root / indexing retries).
- **Bulk private transfer retry:** **2** stale-root retries per row (refresh Merkle state).
- **Relay settle delay:** 4,000 ms between bulk rows (gives the relay time to index and prevents “stale root” cascades).

Repo:

- **Web app:** ~8.7k TS/TSX LOC
- **Rust program/tests:** ~1.9k LOC
- **SQL migrations:** core payout, payables, private balance, and Agent Pay tables
- **Payment rail implementation:** shielded deposits + batch payroll + Merkle cache + UTXO recovery
- **API routes:** 7 Next.js route handlers under `web/src/app/api/**/route.ts`
- **Anchor instruction modules:** 10 files under `programs/cipherpay/src/instructions/`

---

## Run locally (developer quickstart)

### Prerequisites

- Node.js 20+
- Postgres 14+
- `pnpm` (for `web/`)
- (Optional) Solana toolchain + Anchor for program development

### 1) Configure env

```bash
cp web/.env.example web/.env.local
```

Set at minimum:

- `DATABASE_URL`
- `SESSION_SIGNING_SECRET` (32+ bytes)
- `INVOICE_ENCRYPTION_KEY` (base64 32-byte key)

For the private payout rail (defaults are in `web/.env.example`):

- `NEXT_PUBLIC_PAYOUT_RAIL=`
- `NEXT_PUBLIC__PROGRAM_ID`
- `NEXT_PUBLIC__RELAY_URL`
- `NEXT_PUBLIC_PRIVATE_PAYOUT_SYMBOL`
- `NEXT_PUBLIC_PRIVATE_PAYOUT_MINT`
- `NEXT_PUBLIC_PRIVATE_PAYOUT_DECIMALS`

### 2) Install + migrate

```bash
cd web
pnpm install
pnpm db:migrate:private-rail
pnpm db:migrate:agent-pay
pnpm db:migrate:payables
pnpm db:migrate:private-balances
pnpm db:migrate:agent-pay-overhaul
```

### 3) Start

```bash
cd web
pnpm dev
```

Open `http://localhost:3000`.

---

## Verification

From `web/`:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

From the repo root (requires a Rust toolchain):

```bash
corepack enable
yarn test
```

---

## Roadmap

- USDC private payouts (mint-configurable assets)
- Deterministic resumability for large batches (persist more recovery state server-side)
- Wiring protocol receipts into the UI for verifiable attestations per payout run
- Organization/treasury roles + policy controls (rate limits, approvals, pause)
