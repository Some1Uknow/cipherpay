import Image from "next/image";
import Link from "next/link";

import { LandingSignInCTA } from "@/components/auth/LandingSignInCTA";
import { WalletSignInButton } from "@/components/auth/WalletSignInButton";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LandingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};


const featureCards = [
  {
    title: "Create",
    body: "Draft invoices or payout rows via form or CSV, with inline validation before anything moves.",
  },
  {
    title: "Approve",
    body: "Review totals + exceptions and lock intent (who, what, how much) before settlement.",
  },
  {
    title: "Reconcile",
    body: "Attach outcomes (tx id + confirmations) back to rows so ops can audit without guesswork.",
  },
] as const;

const stats = [
  { k: "Row-level validation", v: "Built-in" },
  { k: "Run totals", v: "Deterministic" },
  { k: "Receipts", v: "Planned" },
  { k: "Execution", v: "Next layer" },
] as const;

function ArchitectureDiagram() {
  return (
    <svg role="img" aria-label="CipherPay architecture diagram" viewBox="0 0 980 420" className="h-auto w-full">
      <title>CipherPay architecture</title>
      <defs>
        <linearGradient id="cpAccent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0E5BFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#4D7CFF" stopOpacity="0.85" />
        </linearGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="18" floodColor="rgba(15,23,42,0.12)" />
        </filter>
      </defs>

      <rect x="0" y="0" width="980" height="420" rx="26" fill="rgba(14,91,255,0.04)" />

      <g filter="url(#soft)">
        <rect x="64" y="92" width="250" height="108" rx="22" fill="var(--brand-surface)" />
        <rect x="365" y="72" width="250" height="148" rx="22" fill="var(--brand-surface)" />
        <rect x="666" y="62" width="250" height="158" rx="22" fill="var(--brand-surface)" />

        <rect x="365" y="262" width="250" height="98" rx="22" fill="var(--brand-surface)" />
        <rect x="666" y="272" width="250" height="88" rx="22" fill="var(--brand-surface)" />
      </g>

      <g fontFamily="ui-sans-serif, system-ui" fill="rgba(61,72,82,0.9)">
        <text x="92" y="128" fontSize="14" fontWeight="700">Operator</text>
        <text x="92" y="152" fontSize="12" fill="rgba(61,72,82,0.62)">Wallet connect + signed auth</text>
        <text x="92" y="176" fontSize="12" fill="rgba(61,72,82,0.62)">Compose + validate payout rows</text>

        <text x="393" y="108" fontSize="14" fontWeight="700">Next.js app</text>
        <text x="393" y="132" fontSize="12" fill="rgba(61,72,82,0.62)">Review surface: totals + exceptions</text>
        <text x="393" y="156" fontSize="12" fill="rgba(61,72,82,0.62)">Protected routes: /pay, /history</text>
        <text x="393" y="180" fontSize="12" fill="rgba(61,72,82,0.62)">Receipts mapped back to rows</text>

        <text x="694" y="98" fontSize="14" fontWeight="700">Execution (later)</text>
        <text x="694" y="122" fontSize="12" fill="rgba(61,72,82,0.62)">Transfers / batch program</text>
        <text x="694" y="146" fontSize="12" fill="rgba(61,72,82,0.62)">tx ids + confirmations</text>
        <text x="694" y="170" fontSize="12" fill="rgba(61,72,82,0.62)">Reconcile outcomes</text>

        <text x="393" y="298" fontSize="14" fontWeight="700">Postgres (planned)</text>
        <text x="393" y="322" fontSize="12" fill="rgba(61,72,82,0.62)">payout_runs, payout_rows, receipts</text>

        <text x="694" y="308" fontSize="14" fontWeight="700">Solana RPC</text>
        <text x="694" y="332" fontSize="12" fill="rgba(61,72,82,0.62)">Confirm + link explorers</text>
      </g>

      <g stroke="url(#cpAccent)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M314 146 C340 146 340 146 365 146" />
        <path d="M615 146 C640 146 640 146 666 146" />
        <path d="M490 220 C490 240 490 240 490 262" />
        <path d="M740 220 C740 246 740 246 740 272" />
      </g>

      <g fill="#0E5BFF">
        <circle cx="365" cy="146" r="5" />
        <circle cx="666" cy="146" r="5" />
        <circle cx="490" cy="262" r="5" />
        <circle cx="740" cy="272" r="5" />
      </g>
    </svg>
  );
}

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = typeof resolvedSearchParams?.next === "string" ? resolvedSearchParams.next : null;
  const autoStartSignIn = resolvedSearchParams?.signin === "1";

  return (
    <main className="bg-[var(--brand-surface)] text-[var(--brand-ink)]">
      {/* HERO (structure inspired by base-home.png) */}
      <section className="relative overflow-hidden" id="product">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,91,255,0.14),transparent_48%),radial-gradient(circle_at_top_left,rgba(14,91,255,0.10),transparent_46%)]" />

        <div className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-6 py-7 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="hidden overflow-hidden rounded-2xl shadow-neoSm sm:block">
                <Image
                  src="/logo/cipherpay_branding.png"
                  alt="CipherPay"
                  width={220}
                  height={40}
                  className="h-12 w-auto"
                  priority
                />
              </div>
            </Link>

            <div className="shrink-0">
              <WalletSignInButton variant="secondary" size="sm" nextPath={nextPath}>
                Sign in
              </WalletSignInButton>
            </div>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center pb-12 pt-12">
            <div className="w-full max-w-3xl text-center">
              <h1 className="font-display text-[3.05rem] leading-[0.98] tracking-[-0.06em] sm:text-[4.05rem] lg:text-[4.8rem]">
                On-chain private invoicing infrastructure
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--brand-muted-ink)] sm:text-xl">
                Create and track invoices, pay in USDC, and keep outcomes easy to reconcile — with wallet-based sign-in and receipts you can audit.
              </p>

              <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
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

              <div className="mt-10 flex items-center justify-center gap-3">
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

      {/* ARCHITECTURE */}
      <section id="architecture" className="relative">
        <div className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col justify-center px-6 py-16 sm:px-8 lg:px-10">
          <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="max-w-xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">Architecture</p>
              <h2 className="font-display mt-4 text-4xl tracking-[-0.05em] sm:text-5xl">A clean boundary between review and settlement.</h2>
              <p className="mt-5 text-base leading-7 text-[var(--brand-muted-ink)] sm:text-lg">
                Ship a review surface first, then wire settlement. It stays operator-friendly and audit-friendly as the backend evolves.
              </p>

              <div className="mt-8 grid gap-3">
                {[
                  ["Auth", "Signed wallet challenge creates a short-lived session"],
                  ["Review", "Totals + exceptions computed consistently"],
                  ["Receipts", "Map outcomes back to rows (tx id, confirmation)"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[24px] bg-[var(--brand-surface)] p-4 shadow-neoInsetSm">
                    <p className="text-sm font-semibold text-[var(--brand-ink)]">{k}</p>
                    <p className="mt-1 text-sm text-[var(--brand-muted-ink)]">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            <Card className="p-6">
              <ArchitectureDiagram />
              <p className="mt-4 text-xs leading-6 text-[var(--brand-muted-ink)]">
                Diagram is simplified on purpose—enough detail for reviewers, without a wall of text.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative">
        <div className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col justify-center px-6 py-16 sm:px-8 lg:px-10">
          <Card className="p-8 sm:p-10">
            <div className="max-w-3xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">What matters</p>
              <h2 className="font-display mt-4 text-4xl tracking-[-0.05em] sm:text-5xl">Less UI. More certainty.</h2>
              <p className="mt-5 text-base leading-7 text-[var(--brand-muted-ink)] sm:text-lg">
                User-facing clarity, with just enough technical specificity to feel credible.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((s) => (
                <div key={s.k} className="rounded-[24px] bg-[var(--brand-surface)] px-4 py-4 shadow-neoInsetSm">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">{s.k}</p>
                  <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--brand-ink)]">{s.v}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="relative">
        <div className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col justify-center px-6 py-16 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">Workflow</p>
            <h2 className="font-display mt-4 text-4xl tracking-[-0.05em] sm:text-5xl">Three states. No extra screens.</h2>
            <p className="mt-5 text-base leading-7 text-[var(--brand-muted-ink)] sm:text-lg">
              Compose → review → execute. Keep the operator loop tight.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {featureCards.map((step, index) => (
              <Card key={step.title} className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(14,91,255,0.10)] text-sm font-semibold text-[var(--brand-primary)] shadow-neoInsetSm">
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
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(14,91,255,0.12),transparent_55%)]" />
        <div className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col justify-center px-6 py-16 sm:px-8 lg:px-10">
          <Card className="p-8 sm:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">Phase 1</p>
                <h2 className="font-display mt-4 text-4xl tracking-[-0.05em] sm:text-5xl">Open the workspace and build a run.</h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--brand-muted-ink)] sm:text-lg">
                  The goal is boring correctness: fewer mistakes, clearer outcomes.
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
    </main>
  );
}
