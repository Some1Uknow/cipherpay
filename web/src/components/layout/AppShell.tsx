"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { WorkspaceWalletControl } from "@/components/layout/WorkspaceWalletControl";
import { cn } from "@/lib/utils";

const navigation = [
  {
    href: "/pay",
    label: "Pay",
    icon: PayIcon,
  },
  {
    href: "/bulk-pay",
    label: "Bulk pay",
    icon: BulkPayIcon,
  },
  {
    href: "/payables",
    label: "Payables",
    icon: PayablesIcon,
  },
  {
    href: "/agent-pay",
    label: "Agent pay",
    icon: AgentPayIcon,
  },
  {
    href: "/history",
    label: "History",
    icon: HistoryIcon,
  },
] as const;

function PayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7.5h16" />
      <path d="M6.5 4.5h11A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17V7A2.5 2.5 0 0 1 6.5 4.5Z" />
      <path d="M15 13h2.5" />
    </svg>
  );
}

function HistoryIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}

function BulkPayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7.5h16" />
      <path d="M6 4.5h12A2.5 2.5 0 0 1 20.5 7v10A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17V7A2.5 2.5 0 0 1 6 4.5Z" />
      <path d="M7.5 11h9" />
      <path d="M7.5 15h5" />
    </svg>
  );
}

function AgentPayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 5.5h8" />
      <path d="M9.5 3.5 12 6l2.5-2.5" />
      <path d="M6.5 8.5h11A2.5 2.5 0 0 1 20 11v5.5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V11a2.5 2.5 0 0 1 2.5-2.5Z" />
      <path d="M8.5 13h.01" />
      <path d="M15.5 13h.01" />
      <path d="M9.5 16h5" />
    </svg>
  );
}

function PayablesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 3.5v3" />
      <path d="M16 3.5v3" />
      <path d="M5.5 5h13A2.5 2.5 0 0 1 21 7.5v11A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5v-11A2.5 2.5 0 0 1 5.5 5Z" />
      <path d="M3.5 9h17" />
      <path d="m8 15 2 2 5-5" />
    </svg>
  );
}

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
    </svg>
  );
}

function ChevronIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("cipherpay-sidebar-collapsed");
    if (stored === "true") {
      setCollapsed(true);
    }
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem("cipherpay-sidebar-collapsed", collapsed ? "true" : "false");
  }, [collapsed]);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="h-[100dvh] overflow-hidden bg-[var(--brand-surface)] text-[var(--brand-ink)]">
      <div className="mx-auto flex h-full max-w-[1440px] flex-col px-3 pb-3 pt-3 sm:px-4">
        <header className="z-40 shrink-0">
          <div className="mx-auto flex items-center justify-between gap-3 border border-[var(--brand-border)] bg-white px-3 py-2 shadow-neo sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-9 w-9 p-0 lg:hidden"
                onClick={() => setMobileOpen((value) => !value)}
                aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              >
                <MenuIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="hidden h-9 w-9 p-0 lg:inline-flex"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <ChevronIcon className={cn("h-4 w-4 transition-transform duration-200", collapsed ? "rotate-180" : "")} />
              </Button>

              <Link href="/pay" className="flex min-w-0 items-center gap-3 px-1.5 py-1">
                <div className="overflow-hidden border border-[var(--brand-border)]">
                  <Image src="/logo/cipherpay_logo.png" alt="CipherPay" width={36} height={36} className="h-9 w-9" priority />
                </div>
                <div className="hidden min-w-0 sm:block">
                  <Image
                    src="/logo/cipherpay_branding.png"
                    alt="CipherPay"
                    width={180}
                    height={36}
                    className="h-7 w-auto"
                    priority
                  />
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <WorkspaceWalletControl />
            </div>
          </div>
        </header>

        <div className="relative mt-3 flex flex-1 min-h-0 gap-3 lg:gap-4">
          {mobileOpen ? (
            <button
              type="button"
              className="fixed inset-0 z-20 bg-[rgba(17,17,17,0.24)] lg:hidden"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            />
          ) : null}

          <aside
            className={cn(
              "fixed bottom-3 left-3 top-[4.75rem] z-30 flex w-[240px] flex-col overflow-y-auto border border-[var(--brand-border)] bg-white p-2 shadow-neo transition-transform duration-200 lg:sticky lg:top-0 lg:h-full lg:translate-x-0",
              mobileOpen ? "translate-x-0" : "-translate-x-[120%]",
              collapsed ? "lg:w-[92px]" : "lg:w-[240px]",
            )}
          >
            <div className="h-1" />

            <nav className="grid gap-1.5">
              {navigation.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 border px-2.5 py-2 transition-all duration-150 ease-out",
                      active
                        ? "border-[#111] bg-[#111] text-white"
                        : "border-transparent bg-transparent text-[var(--brand-muted-ink)] hover:border-[var(--brand-border)] hover:bg-[var(--brand-surface)] hover:text-[var(--brand-ink)]",
                      collapsed ? "justify-center px-0" : "",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center border transition-colors duration-150",
                        active
                          ? "border-white bg-white text-[#111]"
                          : "border-[var(--brand-border)] bg-white text-[var(--brand-muted-ink)] group-hover:text-[var(--brand-primary)]",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {!collapsed ? (
                      <span className="block text-sm font-semibold tracking-[-0.02em]">{item.label}</span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className={cn("min-w-0 flex-1 min-h-0", collapsed ? "lg:pl-1" : "")}>
            <main className="grid h-full min-w-0 auto-rows-max content-start gap-4 overflow-y-auto border border-[var(--brand-border)] bg-white p-4 shadow-neo sm:p-5">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
