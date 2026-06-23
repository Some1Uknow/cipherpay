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
    <main className="min-h-screen bg-[var(--brand-surface)] text-[var(--brand-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo/cipherpay_logo.png" alt="CipherPay" width={36} height={36} className="h-9 w-9 border border-[var(--brand-border)]" priority />
            <span className="text-sm font-semibold tracking-[-0.02em] text-[var(--brand-ink-deep)]">CipherPay Docs</span>
          </Link>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <Link href="/agent-pay" className="hidden text-[var(--brand-muted-ink)] hover:text-[var(--brand-ink)] sm:inline">
              Agent pay
            </Link>
            <Link href="/pay" className="border border-[#111] bg-[var(--brand-primary)] px-4 py-2 text-white shadow-neoSm hover:bg-[#111]">
              Open app
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 grid gap-1 text-sm font-semibold">
            {[
              ["Start here", "#overview"],
              ["How it works", "#payment-flow"],
              ["Send one payment", "#manual-pay"],
              ["Send many", "#bulk-pay"],
              ["Recurring payables", "#payables"],
              ["AI drafts", "#mcp-agent"],
              ["Approvals", "#security"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="border border-transparent px-3 py-2 text-[var(--brand-muted-ink)] hover:border-[var(--brand-border)] hover:bg-white hover:text-[var(--brand-ink)]">
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0">
          <div className="pb-12 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">Product Manual</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-[-0.065em] text-[var(--brand-ink-deep)] sm:text-6xl">
              Create drafts fast. Approve payments carefully.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--brand-muted-ink)]">
              CipherPay is built for teams that want a cleaner payout workflow. Prepare payments by hand, from a CSV,
              from recurring payables, or from an AI agent, then approve the final send with the connected wallet.
            </p>
          </div>

          <Section id="overview" title="Start Here">
            <p>
              CipherPay gives you one place to prepare, review, and approve payouts on Solana. It is useful when you
              want private payment flows, a clear approval step, and a record of what was drafted and sent.
            </p>
            <p>
              The product is organized around four entry points: `Pay` for one-off sends, `Bulk pay` for roster-style
              batches, `Payables` for recurring recipients, and `Agent Pay` for drafts created by an AI client.
            </p>
          </Section>

          <Section id="payment-flow" title="How It Works">
            <p>
              Every payout follows the same path. First you create a draft. CipherPay then checks the rows, shows you the
              totals, and waits for a wallet approval before anything is sent.
            </p>
            <p>
              This separation matters. Draft creation can come from a person, a CSV upload, or an AI agent, but the send
              step always comes back to the app and the connected wallet.
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              {["Create", "Check", "Approve", "Track"].map((item, index) => (
                <div key={item} className="border border-[var(--brand-border)] bg-white p-4 shadow-neoSm">
                  <p className="text-xs font-semibold text-[var(--brand-primary)]">0{index + 1}</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">{item}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="manual-pay" title="Send One Payment">
            <p>
              Use `Pay` when you are sending to one recipient. Add a name, wallet, and amount, then review the draft
              before sending. The page keeps the flow focused so you can move quickly without losing the approval step.
            </p>
            <p>
              This is the best path for ad hoc contractor payments, one-time reimbursements, or testing a payout before
              running a larger batch.
            </p>
          </Section>

          <Section id="bulk-pay" title="Send Many">
            <p>
              Use `Bulk pay` when you already have a list of recipients. Paste or upload a CSV, let CipherPay validate
              the rows, then approve the batch from one place.
            </p>
            <p>
              The expected CSV format is:
            </p>
            <CodeBlock
              code={`recipient_name,wallet_address,amount
Ava Patel,9B3Y2dXhN6LQW8dyL5o6z8UZqv2q1X3dQ5bTA2sQkz4J,0.01`}
            />
            <p>
              Bulk pay is the right choice for payroll-style runs, monthly vendor batches, or any situation where you
              want one review surface for many rows.
            </p>
          </Section>

          <Section id="payables" title="Recurring Payables">
            <p>
              Use `Payables` to maintain a live list of recurring recipients. Each payable stores the recipient, wallet,
              amount, cadence, and next due date so you do not need to rebuild the same payout list every cycle.
            </p>
            <p>
              When a payable comes due, select it and turn it into a normal bulk draft. From that point on, the approval
              flow is the same as any other batch.
            </p>
          </Section>

          <Section id="mcp-agent" title="AI Drafts">
            <p>
              `Agent Pay` is for teams that want an AI client to prepare work without giving it control over execution.
              The AI can assemble a real CipherPay draft, but it cannot move funds on its own.
            </p>
            <p>
              The setup is simple: run the local MCP server, give it a token, and point your AI client at CipherPay.
              Once connected, the agent can create drafts that appear in the app for review.
            </p>
            <p>Generate a token:</p>
            <CodeBlock code={`openssl rand -hex 32`} />
            <p>
              Add that value to `web/.env.local` as `MCP_API_TOKEN`, then restart the app so the local MCP bridge can
              authorize draft creation.
            </p>
            <CodeBlock code={`MCP_API_TOKEN=replace-with-your-32+char-random-secret`} />
            <p>
              In your MCP client config, set `CIPHERPAY_MCP_TOKEN` to the same value.
            </p>
            <CodeBlock code={mcpConfig} />
            <p>Example instruction for an AI client:</p>
            <CodeBlock code={aiPrompt} />
            <p>
              The agent can parse instructions, build rows, and create payout drafts. Those drafts are listed inside
              CipherPay and can be opened directly for review.
            </p>
            <p>
              This works well for finance ops teams that want to describe payouts in plain language and still keep the
              actual send step inside a normal wallet approval flow.
            </p>
          </Section>

          <Section id="security" title="Approvals and Control">
            <p>
              CipherPay is designed so preparation and approval stay separate. Drafts can come from multiple sources, but
              execution still requires the connected wallet inside the app.
            </p>
            <p>
              The MCP server cannot sign transactions or bypass approval. It can only create drafts for a wallet that has
              already signed into CipherPay once.
            </p>
          </Section>
        </article>
      </div>
    </main>
  );
}
