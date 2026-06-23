import Image from "next/image";
import Link from "next/link";

const palette = [
  { name: "Primary", value: "#0e5bff" },
  { name: "Primary dark", value: "#0847cf" },
  { name: "Surface", value: "#f7fbff" },
  { name: "Ink", value: "#0f172a" },
  { name: "Muted ink", value: "#516074" },
] as const;

export default function BrandKitPage() {
  return (
    <main className="min-h-screen bg-[#f7fbff] text-[var(--brand-ink)]">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo/cipherpay_logo.png" alt="CipherPay" width={36} height={36} className="h-9 w-9 rounded-xl" priority />
            <span className="text-sm font-semibold tracking-[-0.02em] text-[var(--brand-ink-deep)]">Brand kit</span>
          </Link>
          <Link href="/docs" className="text-sm font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-dark)]">
            View docs
          </Link>
        </div>

        <section className="mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">Identity</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-[-0.06em] text-[var(--brand-ink-deep)] sm:text-6xl">
            Core brand elements for product, demos, and launch materials.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--brand-muted-ink)]">
            Use this page as the lightweight reference for logo usage, product tone, and base colors across docs, decks, and social assets.
          </p>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="border border-[var(--brand-border)] bg-white p-8 shadow-neoSm">
            <p className="text-sm font-semibold text-[var(--brand-ink)]">Primary lockup</p>
            <div className="mt-6 border border-[var(--brand-border)] bg-[var(--brand-surface)] p-8">
              <Image src="/logo/cipherpay_branding.png" alt="CipherPay brand lockup" width={320} height={58} className="h-14 w-auto" priority />
            </div>
            <p className="mt-5 text-sm leading-7 text-[var(--brand-muted-ink)]">
              Use the full lockup on light surfaces where CipherPay needs to read as a product brand, not just an app icon.
            </p>
          </div>

          <div className="border border-[var(--brand-border)] bg-white p-8 shadow-neoSm">
            <p className="text-sm font-semibold text-[var(--brand-ink)]">Product voice</p>
            <div className="mt-5 grid gap-3 text-sm leading-7 text-[var(--brand-muted-ink)]">
              <p>Clear, operational, and approval-first.</p>
              <p>Private by default, but never vague about control.</p>
              <p>Built for finance workflows, not speculative consumer messaging.</p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {palette.map((color) => (
              <div key={color.name} className="border border-[var(--brand-border)] bg-white p-4 shadow-neoSm">
                <div className="h-28 border border-[var(--brand-border)]" style={{ backgroundColor: color.value }} />
                <p className="mt-4 text-sm font-semibold text-[var(--brand-ink)]">{color.name}</p>
                <p className="mt-1 font-mono text-xs text-[var(--brand-muted-ink)]">{color.value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
