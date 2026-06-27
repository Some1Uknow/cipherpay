import Image from "next/image";
import Link from "next/link";

import { AgentInvoiceFlowIllustration, PayrollFlowIllustration } from "@/components/marketing/HomepageFlowIllustrations";
import { Button } from "@/components/ui/button";
import { WaitlistModal } from "@/components/waitlist/WaitlistModal";

const footerGroups = [
  {
    title: "Product",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Brand kit", href: "/brand-kit" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
  {
    title: "Workspace",
    links: [
      { label: "Pay", href: "/pay" },
      { label: "Bulk pay", href: "/bulk-pay" },
      { label: "Payables", href: "/payables" },
      { label: "Agent pay", href: "/agent-pay" },
    ],
  },
  {
    title: "Tracking",
    links: [
      { label: "History", href: "/history" },
      { label: "Reports", href: "/reports" },
      { label: "Invoices", href: "/invoices" },
      { label: "Recipients", href: "/recipients" },
    ],
  },
] as const;

const trustFlow = [
  {
    step: "01",
    title: "Add the work",
    body: "Paste a contributor list, create one payment, or let an agent prepare an invoice for review.",
  },
  {
    step: "02",
    title: "Check before sending",
    body: "See who gets paid and how much before the connected wallet approves anything.",
  },
  {
    step: "03",
    title: "Send privately",
    body: "Move money without turning your contributor list or invoice trail into a public broadcast.",
  },
  {
    step: "04",
    title: "Know what happened",
    body: "Come back to the run, invoice, or history page when someone asks for status.",
  },
] as const;

const trustClaims = [
  {
    title: "No surprise sends",
    body: "CipherPay can prepare the payment, but the user still sees the details before approving.",
  },
  {
    title: "Recipient lists stay quieter",
    body: "The page is built for payroll and invoice flows where people should not see the whole payment graph.",
  },
  {
    title: "Invoice context stays private",
    body: "Notes for human and agent invoices are handled as private context, not public memo text.",
  },
  {
    title: "Records are easy to find",
    body: "History, reports, invoices, and recipients are available when a team needs to follow up.",
  },
] as const;

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 19 6v5.6c0 4.1-2.7 7.7-7 8.9-4.3-1.2-7-4.8-7-8.9V6l7-2.5Z" />
      <path d="m9.5 12 1.7 1.7 3.5-4" />
    </svg>
  );
}

function TrustSections() {
  return (
    <>
      <section className="flex min-h-screen items-center border-b border-[var(--brand-border)] bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="max-w-xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">How it works</p>
              <h2 className="font-display mt-3 text-4xl tracking-[-0.055em] text-[var(--brand-ink-deep)] sm:text-5xl">
                Send payments without making the whole payroll public.
              </h2>
              <p className="mt-5 text-base leading-7 text-[var(--brand-muted-ink)]">
                CipherPay keeps the workflow simple: add the payment work, review it, approve it, then track what happened.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {trustFlow.map((item) => (
                <div key={item.step} className="border border-[#111] bg-[var(--brand-surface)] p-5 shadow-neoSm">
                  <p className="text-xs font-semibold text-[var(--brand-primary)]">{item.step}</p>
                  <p className="mt-4 text-lg font-semibold tracking-[-0.035em] text-[var(--brand-ink-deep)]">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--brand-muted-ink)]">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center border-b border-[var(--brand-border)] bg-[var(--brand-surface)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="border border-[#111] bg-white p-6 shadow-neo sm:p-8">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">Why people can trust it</p>
              <h2 className="font-display mt-3 max-w-xl text-4xl tracking-[-0.055em] text-[var(--brand-ink-deep)] sm:text-5xl">
                Know what will happen before money moves.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--brand-muted-ink)]">
                The average user should not need to understand every privacy detail to feel in control. They need clear review, private payment paths, and records they can find later.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/docs" className="w-full sm:w-auto">
                  <Button variant="primary" size="lg" className="w-full sm:min-w-[180px]">
                    Read docs
                  </Button>
                </Link>
                <Link href="/privacy" className="w-full sm:w-auto">
                  <Button variant="secondary" size="lg" className="w-full sm:min-w-[180px]">
                    Privacy
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {trustClaims.map((claim) => (
                <div key={claim.title} className="border border-[var(--brand-border)] bg-white p-5 shadow-neoSm">
                  <div className="mb-4 flex h-8 w-8 items-center justify-center border border-[#111] bg-[var(--brand-primary)] text-white">
                    <ShieldIcon className="h-5 w-5" />
                  </div>
                  <p className="text-base font-semibold tracking-[-0.035em] text-[var(--brand-ink-deep)]">{claim.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--brand-muted-ink)]">{claim.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center border-b border-[var(--brand-border)] bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">Pick your job</p>
            <h2 className="font-display mt-3 text-4xl tracking-[-0.055em] text-[var(--brand-ink-deep)] sm:text-5xl">
              Start where your payment problem already is.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--brand-muted-ink)]">
              Teams do not all pay the same way. Open the workspace that matches the work in front of you.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Bulk pay", "/bulk-pay", "Pay a contributor list from one review screen."],
              ["Agent pay", "/agent-pay", "Review invoices created by linked agents."],
              ["History", "/history", "Check what was sent, when, and where it stands."],
            ].map(([label, href, body]) => (
              <Link key={href} href={href} className="group border border-[#111] bg-[var(--brand-surface)] p-5 shadow-neoSm transition-transform hover:-translate-y-0.5 hover:shadow-neo">
                <p className="text-lg font-semibold tracking-[-0.04em] text-[var(--brand-ink-deep)]">{label}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--brand-muted-ink)]">{body}</p>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">Open workspace</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default function LandingPage() {
  return (
    <main className="overflow-x-hidden bg-[var(--brand-surface)] text-[var(--brand-ink)]">
      <div className="w-full border-b border-[#111] bg-[#111] text-white">
        <div
          className="mx-auto max-w-7xl px-4 py-1.5 text-left font-mono text-xs sm:px-6 lg:px-8"
          style={{ fontFamily: "Consolas, ui-monospace, SFMono-Regular, Menlo, Monaco, 'Liberation Mono', 'Courier New', monospace" }}
        >
          Status: Live on Mainnet
        </div>
      </div>

      <section className="relative border-b border-[var(--brand-border)]" id="product">
        <div className="mx-auto flex min-h-[82dvh] w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex w-full max-w-[calc(100vw-2rem)] flex-wrap items-center justify-between gap-3 sm:max-w-none sm:gap-4">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <div className="border border-[var(--brand-border)] bg-white px-1.5 py-1 sm:px-2">
                <Image
                  src="/logo/cipherpay_branding.png"
                  alt="CipherPay"
                  width={220}
                  height={40}
                  className="h-8 w-auto sm:h-10"
                  priority
                />
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Link href="/docs">
                <Button variant="ghost" size="sm" className="px-2.5 sm:px-3">
                  Docs
                </Button>
              </Link>
              {/*
                Launch restore:
                1. Remove or hide the WaitlistModal button below.
                2. Restore the WalletSignInButton import from "@/components/auth/WalletSignInButton".
                3. Uncomment this WalletSignInButton so users can sign in from the homepage again.
                4. Remove INVITE_CODE from the deployment environment to disable the route/API invite gate.
              */}
              {/*
                <WalletSignInButton variant="secondary" size="sm" nextPath={nextPath} className="hidden px-2.5 sm:inline-flex sm:px-3">
                  Sign in
                </WalletSignInButton>
              */}
              <WaitlistModal buttonVariant="secondary" buttonSize="sm" buttonClassName="px-2.5 sm:px-3" />
            </div>
          </header>

          <div className="grid flex-1 content-center pb-10 pt-12">
            <div className="w-[calc(100vw-2rem)] min-w-0 sm:w-full sm:max-w-4xl">
              <h1 className="font-display text-[2.05rem] leading-[1.04] tracking-[-0.035em] sm:text-[3.45rem] sm:tracking-[-0.05em] lg:text-[4.15rem]">
                <span className="block sm:inline">On-chain Private </span>
                <span className="block sm:inline">Agentic Invoicing </span>
                <span className="block sm:inline">infrastructure</span>
              </h1>
              <p className="mt-5 w-[calc(100vw-2rem)] max-w-full text-base leading-7 text-[var(--brand-muted-ink)] sm:w-auto sm:max-w-2xl sm:text-lg">
                Build a payout in a single prompt and send it privately instantly to thousands of recipients.
              </p>

              <div className="mt-7 flex w-full flex-col items-start gap-3 sm:flex-row">
                {/*
                  Launch restore:
                  1. Remove or hide the WaitlistModal button below.
                  2. Restore the LandingSignInCTA import from "@/components/auth/LandingSignInCTA".
                  3. Restore the searchParams/nextPath/autoStartSignIn logic that existed before waitlist mode.
                  4. Uncomment this LandingSignInCTA to restore the original Open workspace flow.
                  5. Remove INVITE_CODE from the deployment environment to disable the route/API invite gate.
                */}
                {/*
                  <LandingSignInCTA
                    autoStart={autoStartSignIn}
                    nextPath={nextPath}
                    label="Open workspace"
                    className="w-[calc(100vw-2rem)] min-w-0 sm:w-auto sm:min-w-[220px]"
                  />
                */}
                <WaitlistModal buttonClassName="w-[calc(100vw-2rem)] min-w-0 sm:w-auto sm:min-w-[220px]" />
                <Link href="/docs" className="block w-[calc(100vw-2rem)] min-w-0 sm:w-auto">
                  <Button variant="secondary" size="lg" className="w-full min-w-0 sm:min-w-[220px]">
                    Read docs
                  </Button>
                </Link>
              </div>

              <div className="mt-8 flex items-center gap-3 border-t border-[var(--brand-border)] pt-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--brand-muted-ink)]">Powered by</p>
                <Image
                  src="/solanaLogo.svg"
                  alt="Solana"
                  width={120}
                  height={24}
                  className="h-5 w-auto opacity-80"
                  priority
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      <section className="border-b border-[var(--brand-border)] bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <p className="w-[calc(100vw-2rem)] max-w-full text-lg font-semibold leading-7 tracking-[-0.025em] text-[var(--brand-ink-deep)] sm:w-auto sm:max-w-4xl sm:text-2xl sm:leading-8 sm:tracking-[-0.035em]">
            private payrolls and invoicing built for DAOs, AI Agents and anonymous entities on the internet.
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--brand-border)]">
        <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
          <PayrollFlowIllustration />
          <div className="max-w-xl lg:justify-self-end">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">DAO payroll</p>
            <h2 className="font-display mt-3 text-4xl tracking-[-0.055em] text-[var(--brand-ink-deep)] sm:text-5xl">
              Built for DAOs sending payments to hundreds of contributors privately in seconds.
            </h2>
            <p className="mt-5 text-base leading-7 text-[var(--brand-muted-ink)]">
              One treasury wallet can approve a payroll run, route it through the shielded rail, and settle a dense recipient list without exposing the full roster on the public surface.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--brand-border)] bg-[var(--brand-surface-muted)]">
        <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
          <div className="max-w-xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">Agent invoicing</p>
            <h2 className="font-display mt-3 text-4xl tracking-[-0.055em] text-[var(--brand-ink-deep)] sm:text-5xl">
              AI agents can invoice humans and other agents privately for completed work.
            </h2>
            <p className="mt-5 text-base leading-7 text-[var(--brand-muted-ink)]">
              A linked agent can create two encrypted invoices, one to a human and one to another agent, each for $100, while the payment path stays private until the payer approves it.
            </p>
          </div>
          <AgentInvoiceFlowIllustration />
        </div>
      </section>

      <TrustSections />

      <footer className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1.8fr]">
            <div className="max-w-md">
              <Image
                src="/logo/cipherpay_branding.png"
                alt="CipherPay"
                width={220}
                height={40}
                className="h-11 w-auto"
              />
              <p className="mt-4 text-sm leading-7 text-[var(--brand-muted-ink)]">
                Private Solana payout infrastructure for single sends, batch approvals, recurring payables, and AI-prepared drafts.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-3">
              {footerGroups.map((group) => (
                <div key={group.title}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-muted-ink)]">{group.title}</p>
                  <div className="mt-4 grid gap-2">
                    {group.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="text-sm text-[var(--brand-ink)] transition-colors hover:text-[var(--brand-primary)]"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
