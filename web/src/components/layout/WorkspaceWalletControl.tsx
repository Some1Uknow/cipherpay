"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { WalletDialog } from "@/components/layout/WalletDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createWalletSession } from "@/lib/auth/client";
import { publicConfig } from "@/lib/public-config";
import { cn } from "@/lib/utils";
import { clearStoredWalletPreference } from "@/lib/wallet/local-wallet-preference";

function WalletIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3.5 8.5A2.5 2.5 0 0 1 6 6h11.5A2.5 2.5 0 0 1 20 8.5v7A2.5 2.5 0 0 1 17.5 18H6a2.5 2.5 0 0 1-2.5-2.5v-7Z" />
      <path d="M20 10.5h-3a2 2 0 1 0 0 4h3" />
      <path d="M17.5 12.5h.01" />
    </svg>
  );
}

function CopyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 9h10v10H9z" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ArrowUpRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 5v5h-5" />
      <path d="M4 19v-5h5" />
      <path d="M6.5 9A7 7 0 0 1 18 6.5L20 10" />
      <path d="M17.5 15A7 7 0 0 1 6 17.5L4 14" />
    </svg>
  );
}

function ExitIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function formatSol(lamports: number) {
  const sol = lamports / LAMPORTS_PER_SOL;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(sol);
}

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function explorerAccountUrl(address: string) {
  const cluster = publicConfig.solanaCluster === "mainnet-beta" ? "" : `?cluster=${publicConfig.solanaCluster}`;
  return `https://solscan.io/account/${address}${cluster}`;
}

function ActionTile({
  title,
  icon,
  onClick,
  href,
  tone = "primary",
}: {
  title: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "primary" | "danger";
}) {
  const inner = (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center border border-[var(--brand-border)] bg-white",
          tone === "danger" ? "text-[var(--brand-danger)]" : "text-[var(--brand-primary)]",
        )}
      >
        {icon}
      </span>
      <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">{title}</p>
    </div>
  );

  const className = "border border-[var(--brand-border)] bg-white p-4 text-left shadow-neoSm transition-all duration-150 hover:shadow-neo";

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export function WorkspaceWalletControl() {
  const router = useRouter();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const { connected, disconnect, publicKey, signIn, signMessage, wallet } = useWallet();

  const [open, setOpen] = React.useState(false);
  const [balanceLamports, setBalanceLamports] = React.useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [sessionWalletAddress, setSessionWalletAddress] = React.useState<string | null>(null);
  const [isSyncingSession, setIsSyncingSession] = React.useState(false);
  const [sessionError, setSessionError] = React.useState<string | null>(null);
  const copyTimeoutRef = React.useRef<number | null>(null);

  const walletAddress = publicKey?.toBase58() ?? null;
  const fundingWalletMatches = Boolean(walletAddress && sessionWalletAddress && walletAddress === sessionWalletAddress);
  const walletLabel = wallet?.adapter?.name ?? "Wallet";
  const balanceLabel = balanceLamports == null ? "—" : `${formatSol(balanceLamports)} SOL`;

  const refreshBalance = React.useCallback(async () => {
    if (!publicKey) {
      setBalanceLamports(null);
      return;
    }

    setIsRefreshing(true);
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      setBalanceLamports(lamports);
    } catch {
      setBalanceLamports(null);
    } finally {
      setIsRefreshing(false);
    }
  }, [connection, publicKey]);

  React.useEffect(() => {
    if (!open) return;
    void refreshBalance();
  }, [open, refreshBalance]);

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadSessionWallet() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const payload = (await response.json()) as { session?: { walletAddress?: string } | null };
        if (!cancelled) {
          setSessionWalletAddress(payload.session?.walletAddress ?? null);
        }
      } catch {
        if (!cancelled) {
          setSessionWalletAddress(null);
        }
      }
    }

    void loadSessionWallet();

    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore
    }
  };

  const handleSignOut = async () => {
    try {
      clearStoredWalletPreference();
      await fetch("/api/auth/logout", { method: "POST" });
      await disconnect();
    } finally {
      window.location.href = "/";
    }
  };

  const handleUseConnectedWallet = async () => {
    setSessionError(null);

    if (!walletAddress || (!signMessage && !signIn)) {
      setSessionError("Connect a wallet with message signing enabled.");
      return;
    }

    setIsSyncingSession(true);
    try {
      await createWalletSession({ walletAddress, signMessage, signIn });
      setSessionWalletAddress(walletAddress);
      router.refresh();
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not update the funding wallet.");
    } finally {
      setIsSyncingSession(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex h-10 items-center gap-2.5 border border-[#111] bg-white px-3 shadow-neoSm transition-all duration-150 hover:bg-[#111] hover:text-white hover:shadow-neo"
      >
        <span className="flex h-7 w-7 items-center justify-center border border-[#111] bg-[var(--brand-primary)] text-white group-hover:border-white group-hover:bg-white group-hover:text-[#111]">
          <WalletIcon className="h-4 w-4" />
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold tracking-[-0.03em] text-[var(--brand-ink)]">
            {walletAddress ? truncateAddress(walletAddress) : "Wallet"}
          </span>
          <span className="block text-xs text-[var(--brand-muted-ink)]">{walletAddress ? balanceLabel : "Connect"}</span>
        </span>
      </button>

      {open ? (
        <WalletDialog
          title={connected && walletAddress ? "Wallet" : "Connect wallet"}
          description={connected && walletAddress ? "Balance and quick actions." : "Choose a wallet to continue."}
          onClose={() => setOpen(false)}
        >
          <div className="grid gap-4">
            <div className="grid gap-3 border border-[var(--brand-border)] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary)]">Active</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--brand-ink)]">
                    {walletAddress ? truncateAddress(walletAddress) : "No wallet"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="blue">{publicConfig.solanaCluster}</Badge>
                  {connected ? <Badge tone="slate">{walletLabel}</Badge> : null}
                </div>
              </div>

              {walletAddress ? (
                <div className="grid gap-3">
                  <div className="border border-[var(--brand-border)] bg-white px-4 py-3">
                    <p className="text-xs text-[var(--brand-muted-ink)]">Balance</p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--brand-ink)]">{balanceLabel}</p>
                      <Button variant="secondary" size="sm" onClick={() => void refreshBalance()} disabled={isRefreshing}>
                        <RefreshIcon className={cn("h-4 w-4", isRefreshing ? "animate-spin" : "")} />
                        <span className="ml-2">{isRefreshing ? "Refreshing" : "Refresh"}</span>
                      </Button>
                    </div>
                  </div>

                  <div className="border border-[var(--brand-border)] bg-white px-4 py-3">
                    <p className="text-xs text-[var(--brand-muted-ink)]">Funding wallet</p>
                    <p className="mt-1 text-sm font-medium text-[var(--brand-ink)]">
                      {fundingWalletMatches ? "This connected wallet" : "Sign this wallet to use it for payouts"}
                    </p>
                    {!fundingWalletMatches ? (
                      <div className="mt-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleUseConnectedWallet()}
                          disabled={isSyncingSession}
                        >
                          {isSyncingSession ? "Signing..." : "Use for payouts"}
                        </Button>
                      </div>
                    ) : null}
                    {sessionError ? <p className="mt-2 text-xs text-red-700">{sessionError}</p> : null}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setVisible(true)}>
                    Choose wallet
                  </Button>
                </div>
              )}
            </div>

            {walletAddress ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ActionTile title={copied ? "Copied" : "Copy address"} icon={<CopyIcon className="h-4 w-4" />} onClick={handleCopy} />
                <ActionTile title="Open explorer" icon={<ArrowUpRightIcon className="h-4 w-4" />} href={explorerAccountUrl(walletAddress)} />
                <ActionTile title="Change wallet" icon={<RefreshIcon className="h-4 w-4" />} onClick={() => setVisible(true)} />
                <ActionTile title="Sign out" icon={<ExitIcon className="h-4 w-4" />} tone="danger" onClick={() => void handleSignOut()} />
              </div>
            ) : (
              <p className="text-xs leading-6 text-[var(--brand-muted-ink)]">
                Supported: {publicConfig.supportedWallets.join(", ")}.
              </p>
            )}
          </div>
        </WalletDialog>
      ) : null}
    </>
  );
}
