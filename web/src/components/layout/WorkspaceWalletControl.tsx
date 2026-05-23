"use client";

import * as React from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

import { WalletDialog } from "@/components/layout/WalletDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicConfig } from "@/lib/public-config";
import { cn } from "@/lib/utils";

type Panel = "overview" | "receive" | "send";

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

function ArrowDownLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17 7 7 17" />
      <path d="M16 17H7V8" />
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

export function WorkspaceWalletControl() {
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const { connected, disconnect, publicKey, sendTransaction, wallet } = useWallet();

  const [open, setOpen] = React.useState(false);
  const [panel, setPanel] = React.useState<Panel>("overview");
  const [balanceLamports, setBalanceLamports] = React.useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [sendTo, setSendTo] = React.useState("");
  const [sendAmount, setSendAmount] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const copyTimeoutRef = React.useRef<number | null>(null);

  const walletAddress = publicKey?.toBase58() ?? null;
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
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setPanel("overview");
    setSendError(null);
    setSendSuccess(null);
  };

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

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setOpen(false);
    } catch {
      // ignore disconnect failures
    }
  };

  const handleSend = async () => {
    setSendError(null);
    setSendSuccess(null);

    if (!connected || !publicKey || !sendTransaction) {
      setSendError("Connect a wallet with transaction signing enabled.");
      return;
    }

    let destination: PublicKey;
    try {
      destination = new PublicKey(sendTo.trim());
    } catch {
      setSendError("Recipient address is not valid.");
      return;
    }

    const amount = Number(sendAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSendError("Enter a valid SOL amount.");
      return;
    }

    const lamports = Math.round(amount * LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      setSendError("Amount is too small.");
      return;
    }

    setIsSending(true);
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
      const transaction = new Transaction({ feePayer: publicKey, recentBlockhash: blockhash }).add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: destination, lamports }),
      );
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
      setSendSuccess(`Sent ${amount} SOL`);
      setSendTo("");
      setSendAmount("");
      void refreshBalance();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Send failed.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="group inline-flex h-12 items-center gap-3 rounded-full bg-[var(--brand-surface)] px-3 py-2 shadow-neoSm transition-all duration-200 hover:-translate-y-px hover:shadow-neo"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-primary-gradient-start),var(--brand-primary-gradient-end))] text-white shadow-neoSm">
          <WalletIcon className="h-4.5 w-4.5" />
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold tracking-[-0.03em] text-[var(--brand-ink)]">
            {walletAddress ? truncateAddress(walletAddress) : "Wallet"}
          </span>
          <span className="block text-xs text-[var(--brand-muted-ink)]">{walletAddress ? balanceLabel : "Open controls"}</span>
        </span>
      </button>

      {open ? (
        <WalletDialog
          title={connected && walletAddress ? "Wallet control center" : "Connect your funding wallet"}
          description={
            connected && walletAddress
              ? "Manage the wallet that signs payout runs. Everything important should be reachable from one calm surface."
              : "Choose a supported wallet, then sign in and fund payout runs without leaving the workspace."
          }
          onClose={() => setOpen(false)}
        >
          <div className="grid gap-5">
            <div className="grid gap-3 rounded-[28px] bg-[var(--brand-surface)] p-4 shadow-neoInsetSm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary)]">Active wallet</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--brand-ink)]">
                    {walletAddress ? truncateAddress(walletAddress) : "No wallet connected"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="blue">{publicConfig.solanaCluster}</Badge>
                  {connected ? <Badge tone="slate">{walletLabel}</Badge> : null}
                </div>
              </div>

              {walletAddress ? (
                <>
                  <div className="rounded-[22px] bg-[var(--brand-surface)] px-4 py-3 shadow-neoInsetSm">
                    <p className="text-xs text-[var(--brand-muted-ink)]">Balance</p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--brand-ink)]">{balanceLabel}</p>
                      <Button variant="secondary" size="sm" className="rounded-full" onClick={() => void refreshBalance()} disabled={isRefreshing}>
                        <RefreshIcon className={cn("h-4 w-4", isRefreshing ? "animate-spin" : "")} />
                        <span className="ml-2">{isRefreshing ? "Refreshing" : "Refresh"}</span>
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant={panel === "overview" ? "primary" : "secondary"} className="rounded-full" onClick={() => setPanel("overview")}>
                      Overview
                    </Button>
                    <Button variant={panel === "receive" ? "primary" : "secondary"} className="rounded-full" onClick={() => setPanel("receive")}>
                      Receive
                    </Button>
                    <Button variant={panel === "send" ? "primary" : "secondary"} className="rounded-full" onClick={() => setPanel("send")}>
                      Send SOL
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setVisible(true)}>
                    Choose wallet
                  </Button>
                </div>
              )}
            </div>

            {walletAddress && panel === "overview" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-[24px] bg-[var(--brand-surface)] p-4 text-left shadow-neoSm transition-all duration-200 hover:-translate-y-px hover:shadow-neo"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-surface)] text-[var(--brand-primary)] shadow-neoInsetSm">
                      <CopyIcon className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">{copied ? "Address copied" : "Copy address"}</p>
                    </div>
                  </div>
                </button>

                <a
                  href={explorerAccountUrl(walletAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[24px] bg-[var(--brand-surface)] p-4 text-left shadow-neoSm transition-all duration-200 hover:-translate-y-px hover:shadow-neo"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-surface)] text-[var(--brand-primary)] shadow-neoInsetSm">
                      <ArrowUpRightIcon className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">Open explorer</p>
                    </div>
                  </div>
                </a>

                <button
                  type="button"
                  onClick={() => setVisible(true)}
                  className="rounded-[24px] bg-[var(--brand-surface)] p-4 text-left shadow-neoSm transition-all duration-200 hover:-translate-y-px hover:shadow-neo"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-surface)] text-[var(--brand-primary)] shadow-neoInsetSm">
                      <RefreshIcon className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">Change wallet</p>
                    </div>
                  </div>
                </button>

                <form action="/api/auth/logout" method="post" className="contents">
                  <button
                    type="submit"
                    className="rounded-[24px] bg-[var(--brand-surface)] p-4 text-left shadow-neoSm transition-all duration-200 hover:-translate-y-px hover:shadow-neo"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-surface)] text-[var(--brand-danger)] shadow-neoInsetSm">
                        <ExitIcon className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">Sign out</p>
                      </div>
                    </div>
                  </button>
                </form>
              </div>
            ) : null}

            {walletAddress && panel === "receive" ? (
              <div className="grid gap-3 rounded-[28px] bg-[var(--brand-surface)] p-5 shadow-neoInsetSm">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-surface)] text-[var(--brand-primary)] shadow-neoInsetSm">
                    <ArrowDownLeftIcon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">Receive funds</p>
                  </div>
                </div>
                <div className="rounded-[22px] bg-[var(--brand-surface)] px-4 py-4 text-sm leading-7 text-[var(--brand-ink)] shadow-neoInsetSm">
                  {walletAddress}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="rounded-full" onClick={handleCopy}>
                    {copied ? "Copied" : "Copy address"}
                  </Button>
                  <a href={explorerAccountUrl(walletAddress)} target="_blank" rel="noreferrer">
                    <Button variant="ghost" className="rounded-full">
                      Open explorer
                    </Button>
                  </a>
                </div>
              </div>
            ) : null}

            {walletAddress && panel === "send" ? (
              <div className="grid gap-4 rounded-[28px] bg-[var(--brand-surface)] p-5 shadow-neoInsetSm">
                <div>
                  <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">Send native SOL</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--brand-muted-ink)]">
                    Separate from payout runs.
                  </p>
                </div>
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="wallet-send-to">Recipient address</Label>
                    <Input id="wallet-send-to" value={sendTo} onChange={(event) => setSendTo(event.target.value)} placeholder="Enter Solana address" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="wallet-send-amount">Amount</Label>
                    <Input
                      id="wallet-send-amount"
                      inputMode="decimal"
                      value={sendAmount}
                      onChange={(event) => setSendAmount(event.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {sendError ? <p className="text-sm text-red-700">{sendError}</p> : null}
                {sendSuccess ? <p className="text-sm text-emerald-700">{sendSuccess}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-full" onClick={() => void handleSend()} disabled={isSending}>
                    {isSending ? "Sending..." : "Send SOL"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => {
                      setSendTo("");
                      setSendAmount("");
                      setSendError(null);
                      setSendSuccess(null);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-[var(--brand-surface)] px-4 py-3 shadow-neoInsetSm">
              <p className="text-xs leading-6 text-[var(--brand-muted-ink)]">
                Supported now: {publicConfig.supportedWallets.join(", ")}.
              </p>
              {connected ? (
                <Button variant="ghost" className="rounded-full" onClick={() => void handleDisconnect()}>
                  Disconnect wallet
                </Button>
              ) : (
                <Button variant="secondary" className="rounded-full" onClick={() => setVisible(true)}>
                  Open wallet picker
                </Button>
              )}
            </div>
          </div>
        </WalletDialog>
      ) : null}
    </>
  );
}
