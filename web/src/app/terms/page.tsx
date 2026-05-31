import Link from "next/link";

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section className="border-t border-[rgba(15,23,42,0.10)] py-8">
      <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--brand-ink-deep)]">{title}</h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--brand-muted-ink)]">{body}</p>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7fbff] text-[var(--brand-ink)]">
      <div className="mx-auto max-w-5xl px-5 py-12">
        <Link href="/" className="text-sm font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-dark)]">
          Back to home
        </Link>
        <div className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">Terms</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[var(--brand-ink-deep)]">Terms of use</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--brand-muted-ink)]">
            CipherPay is an operational payout workspace. Users are responsible for verifying recipient details, wallet addresses, and payout intent before approval.
          </p>
        </div>
        <div className="mt-12">
          <Section title="User responsibility" body="Before approving a payment, users should confirm the recipient, amount, and wallet address. CipherPay is a workflow surface, not a substitute for payment review." />
          <Section title="Connected wallets" body="Transactions and approvals depend on external wallet software. CipherPay cannot guarantee wallet availability, third-party RPC uptime, or relay performance." />
          <Section title="Operational use" body="Product features may evolve over time. Teams should maintain their own internal controls for treasury operations, vendor review, and payout authorization." />
        </div>
      </div>
    </main>
  );
}
