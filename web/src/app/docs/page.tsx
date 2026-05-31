import type { ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";

import { CodeBlock } from "@/components/ui/code-block";

const mcpConfig = `{
  "mcpServers": {
    "cipherpay": {
      "command": "pnpm",
      "args": ["--dir", "<path-to-cipherpay-repo>/web", "mcp:cipherpay"],
      "env": {
        "CIPHERPAY_APP_URL": "http://localhost:3000",
        "CIPHERPAY_MCP_TOKEN": "<same-value-as-MCP_API_TOKEN>",
        "CIPHERPAY_WALLET_ADDRESS": "your-signed-in-funding-wallet"
      }
    }
  }
}`;

const aiPrompt = `Create a CipherPay draft:
Pay Northline Studio 0.018 SOL to GW91mC6M7xTnN4aMvQq5jQ9nG2L3w4LfA1uQw8fLm9rA for invoice INV-1042.`;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-[rgba(15,23,42,0.10)] py-10">
      <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--brand-ink-deep)]">{title}</h2>
      <div className="mt-4 grid gap-4 text-sm leading-7 text-[var(--brand-muted-ink)]">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#f7fbff] text-[var(--brand-ink)]">
      <header className="sticky top-0 z-20 border-b border-[rgba(15,23,42,0.08)] bg-[#f7fbff]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo/cipherpay_logo.png" alt="CipherPay" width={36} height={36} className="h-9 w-9 rounded-xl" priority />
            <span className="text-sm font-semibold tracking-[-0.02em] text-[var(--brand-ink-deep)]">CipherPay Docs</span>
          </Link>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <Link href="/agent-pay" className="hidden text-[var(--brand-muted-ink)] hover:text-[var(--brand-ink)] sm:inline">
              Agent pay
            </Link>
            <Link href="/pay" className="rounded-full bg-[var(--brand-primary)] px-4 py-2 text-white shadow-neoSm">
              Open app
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 grid gap-1 text-sm font-semibold">
            {[
              ["Overview", "#overview"],
              ["Payment Flow", "#payment-flow"],
              ["Manual Pay", "#manual-pay"],
              ["Bulk Pay", "#bulk-pay"],
              ["Payables", "#payables"],
              ["MCP Agent", "#mcp-agent"],
              ["Security", "#security"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="rounded-full px-3 py-2 text-[var(--brand-muted-ink)] hover:bg-white hover:text-[var(--brand-ink)]">
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0">
          <div className="pb-12 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">Product Manual</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-[-0.065em] text-[var(--brand-ink-deep)] sm:text-6xl">
              Private payout drafts, wallet approval, and AI agent control.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--brand-muted-ink)]">
              CipherPay separates preparation from execution. Humans, CSV uploads, and MCP agents can create drafts.
              Only the connected wallet can approve payment execution.
            </p>
          </div>

          <Section id="overview" title="Overview">
            <p>
              CipherPay is a Solana payout workspace with private payment rails. Use it for single-recipient payments,
              bulk CSV payouts, and AI-created drafts through the local MCP server.
            </p>
          </Section>

          <Section id="payment-flow" title="Payment Flow">
            <p>
              Every payment moves through the same path: create a draft, validate rows, review totals, approve with wallet,
              then record status and receipts. External agents stop at draft creation.
            </p>
            <p>
              AI-created drafts also appear on Agent Pay. Selecting `Review & approve` opens the exact `/pay?runId=...`
              or `/bulk-pay?runId=...` draft inside the standard approval flow.
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              {["Draft", "Validate", "Approve", "Record"].map((item, index) => (
                <div key={item} className="rounded-2xl bg-white p-4 shadow-neoSm">
                  <p className="text-xs font-semibold text-[var(--brand-primary)]">0{index + 1}</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">{item}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="manual-pay" title="Manual Pay">
            <p>
              Use `Pay` for a single recipient. Add recipient name, Solana wallet, and amount. The draft autosaves.
              Send only after the connected wallet is ready to approve.
            </p>
          </Section>

          <Section id="bulk-pay" title="Bulk Pay">
            <p>
              Use `Bulk pay` for CSV-style batches. Rows use this schema:
            </p>
           <CodeBlock
             code={`recipient_name,wallet_address,amount
Ava Patel,9B3Y2dXhN6LQW8dyL5o6z8UZqv2q1X3dQ5bTA2sQkz4J,0.01`}
           />
         </Section>

          <Section id="payables" title="Payables">
            <p>
              Use `Payables` for recurring recipients. Add a recipient, wallet, amount, cadence, and next due date. When
              a payable is due, select it and create a bulk draft. CipherPay opens the exact `/bulk-pay?runId=...` run for approval.
            </p>
          </Section>

          <Section id="mcp-agent" title="MCP Agent">
            <p>
              The MCP server lets an AI client create real CipherPay payout drafts. The “MCP token” is just a shared secret that
              you generate locally.
            </p>
            <p>Generate a token (example):</p>
            <CodeBlock code={`openssl rand -hex 32`} />
            <p>
              Set it in `web/.env.local` as `MCP_API_TOKEN` (this authorizes requests to `/api/mcp/payout-drafts`). Restart the dev
              server after changing env.
            </p>
            <CodeBlock code={`MCP_API_TOKEN=replace-with-your-32+char-random-secret`} />
            <p>
              In your MCP client config, set `CIPHERPAY_MCP_TOKEN` to the exact same value as `MCP_API_TOKEN`.
            </p>
            <CodeBlock code={mcpConfig} />
            <p>Example prompt:</p>
            <CodeBlock code={aiPrompt} />
            <p>
              Available tools: `parse_payable_instructions`, `create_payout_draft`, and `draft_payment_from_instructions`.
            </p>
            <p>
              Created drafts are marked as MCP-sourced, listed on Agent Pay, and returned with a direct approval URL for
              the exact run.
            </p>
          </Section>

          <Section id="security" title="Security">
            <p>
              The MCP server cannot sign or execute payments. It uses a bearer token, requires a funding wallet that has
              already signed into CipherPay, and returns an approval URL. Payment execution remains wallet-approved.
            </p>
          </Section>
        </article>
      </div>
    </main>
  );
}
