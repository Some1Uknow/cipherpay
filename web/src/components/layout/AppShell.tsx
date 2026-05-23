"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/pay", label: "Pay" },
  { href: "/history", label: "History" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-transparent text-[var(--brand-ink)]">
      <header className="sticky top-0 z-30 border-b border-[rgba(226,232,240,0.85)] bg-[rgba(250,250,250,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/pay" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--brand-primary-gradient-start),var(--brand-primary-gradient-end))] text-sm font-semibold text-white shadow-neoSm">
                CP
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">CipherPay</p>
                <p className="truncate text-xs text-[var(--brand-muted-ink)]">Private payout runs</p>
              </div>
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              {navigation.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-[background-color,color,border-color] duration-200 ease-out",
                      active
                        ? "bg-[rgba(0,82,255,0.08)] text-[var(--brand-primary)]"
                        : "text-[var(--brand-muted-ink)] hover:bg-[var(--brand-surface-muted)] hover:text-[var(--brand-ink)]",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone="blue" className="hidden sm:inline-flex">
              Devnet
            </Badge>
            <div className="hidden sm:block">
              <WalletMultiButton className="!h-10 !rounded-xl !px-4 !text-sm !font-medium" />
            </div>
            <form action="/api/auth/logout" method="post">
              <Button variant="secondary" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>

        <div className="border-t border-[rgba(226,232,240,0.8)] md:hidden">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
            {navigation.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-[background-color,color] duration-200 ease-out",
                    active
                      ? "bg-[rgba(0,82,255,0.08)] text-[var(--brand-primary)]"
                      : "bg-white text-[var(--brand-muted-ink)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid gap-6">{children}</div>
      </main>
    </div>
  );
}
