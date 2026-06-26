import Link from "next/link";

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section className="border-t border-[rgba(15,23,42,0.10)] py-8">
      <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--brand-ink-deep)]">{title}</h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--brand-muted-ink)]">{body}</p>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7fbff] text-[var(--brand-ink)]">
      <div className="mx-auto max-w-5xl px-5 py-12">
        <Link href="/" className="text-sm font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-dark)]">
          Back to home
        </Link>
        <div className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">Privacy</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[var(--brand-ink-deep)]">Privacy policy</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--brand-muted-ink)]">
            CipherPay is built to minimize unnecessary exposure while keeping approval and operational records clear.
          </p>
        </div>
        <div className="mt-12">
          <Section title="What CipherPay stores" body="CipherPay stores the draft and payout information needed to validate, review, and track a payout run. This includes recipient details, amounts, payout status, and related receipts." />
          <Section title="Wallet approvals" body="CipherPay does not sign transactions on behalf of users. Payment execution remains tied to the connected wallet and its approval flow." />
          <Section title="Agent Pay" body="Linked agents have their own wallet, token, and activity records. CipherPay stores encrypted invoice notes and owner-visible agent metadata needed for linking, funding, approvals, and history." />
        </div>
      </div>
    </main>
  );
}
