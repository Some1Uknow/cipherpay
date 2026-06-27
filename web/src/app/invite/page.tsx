import Image from "next/image";
import Link from "next/link";

import { InviteGateForm } from "@/components/invite/InviteGateForm";

type InvitePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const resolvedSearchParams = await searchParams;
  const rawNext = resolvedSearchParams?.next;
  const nextPath = typeof rawNext === "string" && rawNext.startsWith("/") ? rawNext : "/pay";

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--brand-surface)] px-4 py-10 text-[var(--brand-ink)]">
      <section className="w-full max-w-xl border border-[#111] bg-white p-6 shadow-neo sm:p-8">
        <Link href="/" className="inline-flex border border-[var(--brand-border)] bg-white px-2 py-1">
          <Image src="/logo/cipherpay_branding.png" alt="CipherPay" width={190} height={35} className="h-9 w-auto" priority />
        </Link>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          Invite only
        </p>
        <h1 className="font-display mt-3 text-4xl tracking-[-0.06em] text-[var(--brand-ink-deep)] sm:text-5xl">
          Enter your access code.
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--brand-muted-ink)]">
          CipherPay is in private access mode. If you have an invite code from the team, enter it here to continue.
        </p>
        <InviteGateForm nextPath={nextPath} />
      </section>
    </main>
  );
}
