import Image from "next/image";
import Link from "next/link";

import { LandingSignInCTA } from "@/components/auth/LandingSignInCTA";
import { CipherPayArchitectureDiagram } from "@/components/marketing/CipherPayArchitectureDiagram";
import { WalletSignInButton } from "@/components/auth/WalletSignInButton";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LandingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function StatIcon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--brand-border)] bg-white">
      {children}
    </div>
  );
}

function OneDepositIcon() {
  return (
    <StatIcon>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 text-[var(--brand-primary)]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5" width="16" height="5" rx="2" />
        <path d="M12 10v9" />
        <path d="M8 15h8" />
      </svg>
    </StatIcon>
  );
}

function RowsIcon() {
  return (
    <StatIcon>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 text-[var(--brand-primary)]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 7h12" />
        <path d="M6 12h12" />
        <path d="M6 17h12" />
        <circle cx="4" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="4" cy="17" r="1" fill="currentColor" stroke="none" />
      </svg>
    </StatIcon>
  );
}

function ClockIcon() {
  return (
    <StatIcon>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 text-[var(--brand-primary)]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </svg>
    </StatIcon>
  );
}

const featureCards = [
  {
    title: "Start a payout",
    body: "Add people or invoices by hand or by file, then check everything before you send it.",
  },
  {
    title: "Review and confirm",
    body: "Look over the amount, the recipients, and any issues before you approve it.",
  },
  {
    title: "Keep a record",
    body: "See what was sent, what finished, and what still needs attention.",
  },
] as const;

const stats = [
  { k: "Checks before send", v: "Included" },
  { k: "Totals", v: "Always visible" },
  { k: "Proof of payment", v: "On the way" },
  { k: "Sending", v: "Step by step" },
] as const;

const architectureStats = [
  {
    value: "1→N",
    label: "UTXO payout fanout",
    body: "One shielded deposit can fan out into sequential private withdrawals, with each change UTXO feeding the next recipient.",
    icon: <OneDepositIcon />,
  },
  {
    value: "1,000",
    label: "proof-aware batch rows",
    body: "Large payroll-style imports can be validated, queued, and reviewed inside one approval surface without breaking the run model.",
    icon: <RowsIcon />,
  },
  {
    value: "<4s",
    label: "relay settle cadence",
    body: "The private rail is tuned around a sub-4-second settle window between proof submission, Merkle root refresh, and the next transfer step.",
    icon: <ClockIcon />,
  },
] as const;

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

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = typeof resolvedSearchParams?.next === "string" ? resolvedSearchParams.next : null;
  const autoStartSignIn = resolvedSearchParams?.signin === "1";

  return (
    <main className="bg-[var(--brand-surface)] text-[var(--brand-ink)]">
      <div className="w-full border-b border-[#111] bg-[#111] text-white">
        <div
          className="mx-auto max-w-7xl px-4 py-1.5 text-left font-mono text-xs sm:px-6 lg:px-8"
          style={{ fontFamily: "Consolas, ui-monospace, SFMono-Regular, Menlo, Monaco, 'Liberation Mono', 'Courier New', monospace" }}
        >
          Status: Live on Mainnet
        </div>
      </div>

      <section className="relative border-b border-[var(--brand-border)]" id="product">
        <div className="mx-auto flex min-h-[82dvh] max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="border border-[var(--brand-border)] bg-white px-2 py-1">
                <Image
                  src="/logo/cipherpay_branding.png"
                  alt="CipherPay"
                  width={220}
                  height={40}
                  className="h-10 w-auto"
                  priority
                />
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              <Link href="/docs">
                <Button variant="ghost" size="sm">
                  Docs
                </Button>
              </Link>
              <WalletSignInButton variant="secondary" size="sm" nextPath={nextPath}>
                Sign in
              </WalletSignInButton>
            </div>
          </header>

          <div className="grid flex-1 content-center pb-10 pt-12">
            <div className="w-full max-w-4xl">
              <h1 className="font-display text-[2.55rem] leading-[1.02] tracking-[-0.05em] sm:text-[3.45rem] lg:text-[4.15rem]">
                On-chain Private Agentic Invoicing infrastructure
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--brand-muted-ink)] sm:text-lg">
                Build a payout in a single prompt and send it privately instantly to thousands of recipients.
              </p>

              <div className="mt-7 flex w-full flex-col items-start gap-3 sm:flex-row">
                <LandingSignInCTA
                  autoStart={autoStartSignIn}
                  nextPath={nextPath}
                  label="Open workspace"
                  className="w-full sm:w-auto sm:min-w-[220px]"
                />
                <Link href="#architecture" className="w-full sm:w-auto">
                  <Button variant="secondary" size="lg" className="w-full sm:min-w-[220px]">
                    View architecture
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

      <section id="architecture" className="relative border-b border-[var(--brand-border)]">
        <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="max-w-3xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">How it works</p>
            <h2 className="font-display mt-3 text-3xl tracking-[-0.04em] sm:text-4xl">
              Everything you need in one place.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--brand-muted-ink)] sm:text-base">
              From setup to sending to follow-up, keep the whole payout process easy to understand.
            </p>
          </div>

          <div className="mt-10">
            <CipherPayArchitectureDiagram />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {architectureStats.map((item) => (
              <div key={item.label} className="flex items-start gap-4 border border-[var(--brand-border)] bg-white p-4 shadow-neoSm">
                {item.icon}
                <div className="min-w-0">
                  <p className="text-3xl font-semibold tracking-[-0.06em] text-[var(--brand-ink-deep)]">{item.value}</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--brand-ink)]">{item.label}</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--brand-muted-ink)]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative border-b border-[var(--brand-border)]">
        <div className="mx-auto flex max-w-7xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
          <Card className="p-8 sm:p-10">
            <div className="max-w-3xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">What you get</p>
              <h2 className="font-display mt-3 text-3xl tracking-[-0.04em] sm:text-4xl">Clear steps. Fewer mistakes.</h2>
              <p className="mt-4 text-sm leading-6 text-[var(--brand-muted-ink)] sm:text-base">
                A simple flow that helps people move from draft to done without second-guessing the details.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((s) => (
                <div key={s.k} className="border border-[var(--brand-border)] bg-white px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">{s.k}</p>
                  <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--brand-ink)]">{s.v}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="relative border-b border-[var(--brand-border)]">
        <div className="mx-auto flex max-w-7xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">Workflow</p>
            <h2 className="font-display mt-3 text-3xl tracking-[-0.04em] sm:text-4xl">A simple path from draft to send.</h2>
            <p className="mt-4 text-sm leading-6 text-[var(--brand-muted-ink)] sm:text-base">
              Draft it, check it, and send it when you’re ready.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {featureCards.map((step, index) => (
              <Card key={step.title} className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center border border-[var(--brand-primary)] bg-white font-mono text-sm font-semibold text-[var(--brand-primary)]">
                      0{index + 1}
                    </div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </div>
                  <CardDescription className="mt-3 text-sm leading-7">{step.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative border-b border-[var(--brand-border)]">
        <div className="mx-auto flex max-w-7xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
          <Card className="p-8 sm:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">Next step</p>
                <h2 className="font-display mt-3 text-3xl tracking-[-0.04em] sm:text-4xl">Open the workspace and get started.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--brand-muted-ink)] sm:text-base">
                  Keep the process straightforward so your team can move faster with less back-and-forth.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <LandingSignInCTA
                  autoStart={autoStartSignIn}
                  nextPath={nextPath}
                  label="Open workspace"
                  className="w-full"
                />
                <Link href="#product" className="w-full">
                  <Button variant="secondary" size="lg" className="w-full">
                    Back to top
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>

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
