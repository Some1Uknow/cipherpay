"use client";

import * as React from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

import { WalletDialog } from "@/components/layout/WalletDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type WalletSheet = null | "manage" | "send" | "receive";

type SidebarWalletSectionProps = {
  collapsed?: boolean;
};

function WalletIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M21 9H17a2 2 0 0 0 0 4h4" />
      <path d="M17 11h.01" />
    </svg>
  );
}

function SendIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function ReceiveIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M22 22L11 11" />
      <path d="M15 11H11v4" />
      <path d="M2 2l9 9" />
    </svg>
  );
}

function CopyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M9 9h10v10H9z" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function SignOutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
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

export function SidebarWalletSection({ collapsed }: SidebarWalletSectionProps) {
  const { connection } = useConnection();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { connected, disconnect, publicKey, sendTransaction, wallet } = useWallet();

  const [sheet, setSheet] = React.useState<WalletSheet>(null);
  const [balanceLamports, setBalanceLamports] = React.useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [sendTo, setSendTo] = React.useState("");
  const [sendAmount, setSendAmount] = React.useState("");
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const copyTimeoutRef = React.useRef<number | null>(null);

  const walletAddress = publicKey?.toBase58() ?? null;
  const balanceLabel = balanceLamports == null ? "—" : formatSol(balanceLamports);
  const walletLabel = wallet?.adapter?.name ?? "Wallet";

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
    void refreshBalance();

    if (!publicKey) return;
    const interval = window.setInterval(() => {
      void refreshBalance();
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [publicKey, refreshBalance]);

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyAddress = React.useCallback(async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore clipboard failures
    }
  }, [walletAddress]);

  const resetSendState = React.useCallback(() => {
    setSendError(null);
    setSendSuccess(null);
  }, []);

  const closeSheet = React.useCallback(() => {
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
    setSheet(null);
    setCopied(false);
    resetSendState();
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, [resetSendState]);

  const openWalletManage = (event: React.MouseEvent<HTMLButtonElement>) => {
    triggerRef.current = event.currentTarget;
    if (!connected) {
      setWalletModalVisible(true);
      return;
    }
    setSheet("manage");
  };

  const openSheet = (nextSheet: Exclude<WalletSheet, null>) => {
    resetSendState();
    setSheet(nextSheet);
  };

  const handleChangeWallet = () => {
    setSheet(null);
    setWalletModalVisible(true);
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      closeSheet();
    } catch {
      // ignore disconnect failures
    }
  };

  const handleSend = async () => {
    resetSendState();

    if (!connected || !publicKey) {
      setSendError("Connect a wallet first.");
      return;
    }

    if (!sendTransaction) {
      setSendError("This wallet cannot sign transfers.");
      return;
    }

    const recipient = sendTo.trim();
    if (!recipient) {
      setSendError("Enter a recipient address.");
      return;
    }

    let destination: PublicKey;
    try {
      destination = new PublicKey(recipient);
    } catch {
      setSendError("Recipient address is not valid.");
      return;
    }

    const amount = Number(sendAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSendError("Enter an amount greater than 0.");
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
      const message = error instanceof Error ? error.message : "Send failed.";
      setSendError(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {collapsed ? (
        <div className="grid justify-items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-11 w-11 p-0"
            aria-label={connected ? "Manage wallet" : "Connect wallet"}
            title={connected ? "Manage wallet" : "Connect wallet"}
            onClick={openWalletManage}
          >
            <WalletIcon className="h-5 w-5" aria-hidden="true" />
          </Button>

          <form action="/api/auth/logout" method="post" className="grid">
            <Button type="submit" variant="secondary" size="sm" className="h-11 w-11 p-0" title="Sign out">
              <SignOutIcon className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Sign out</span>
            </Button>
          </form>
        </div>
      ) : (
        <div className="rounded-[28px] bg-[var(--brand-surface)] p-4 shadow-neoInset">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-muted-ink)]">Wallet</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">
              {connected ? `${walletLabel} connected` : "Connect a wallet"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--brand-muted-ink)]">
              Open the wallet panel for connection tools, address actions, and transfers.
            </p>
          </div>

          <div className="mt-4 grid gap-2">
            <Button type="button" size="lg" className="w-full" onClick={openWalletManage}>
              {connected ? "Manage wallet" : "Connect wallet"}
            </Button>

            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="secondary" size="lg" className="w-full">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      )}

      {sheet ? (
        <WalletDialog
          title={sheet === "manage" ? "Manage wallet" : sheet === "send" ? "Send SOL" : "Receive address"}
          description={
            sheet === "manage"
              ? "Review your connection, copy the address, and move into send or receive flows from one place."
              : sheet === "send"
                ? "Double-check the destination and amount before you approve the transfer in your wallet."
                : "Share the address below when you want someone to send funds into this wallet."
          }
          onClose={closeSheet}
        >
          {sheet === "manage" ? (
            <div className="grid gap-4">
              <section className="rounded-[30px] bg-[linear-gradient(135deg,rgba(14,91,255,0.12),rgba(255,255,255,0.55))] p-5 shadow-[inset_1px_1px_0_rgba(255,255,255,0.55),0_18px_40px_rgba(16,33,58,0.08)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.72)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-ink)] shadow-neoInsetSm">
                      <span className="h-2 w-2 rounded-full bg-[var(--brand-success)]" aria-hidden="true" />
                      Connected
                    </div>
                    <p className="mt-4 text-xl font-semibold tracking-[-0.04em] text-[var(--brand-ink)]">{walletLabel}</p>
                    <p className="mt-2 font-mono-ui text-sm text-[var(--brand-muted-ink)]">
                      {walletAddress ? truncateAddress(walletAddress) : "No address available"}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-11 w-11 shrink-0 p-0"
                    aria-label="Refresh balance"
                    title="Refresh balance"
                    onClick={refreshBalance}
                    disabled={isRefreshing}
                  >
                    <RefreshIcon className={cn("h-5 w-5", isRefreshing && "animate-spin")} aria-hidden="true" />
                  </Button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-[24px] bg-[rgba(255,255,255,0.78)] p-4 shadow-neoInsetSm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-muted-ink)]">Available balance</p>
                    <p className="mt-2 text-[1.9rem] font-semibold tracking-[-0.05em] text-[var(--brand-ink)] tabular-nums">
                      {balanceLabel}
                      <span className="ml-2 text-sm font-medium text-[var(--brand-muted-ink)]">SOL</span>
                    </p>
                  </div>

                  <div className="rounded-[24px] bg-[rgba(255,255,255,0.78)] p-4 shadow-neoInsetSm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-muted-ink)]">Address</p>
                    <p className="mt-2 break-all font-mono-ui text-sm leading-6 text-[var(--brand-ink)]">
                      {walletAddress ?? "Connect a wallet to view your address."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <Button type="button" variant="secondary" size="lg" className="w-full gap-2" onClick={handleCopyAddress} disabled={!walletAddress}>
                  <CopyIcon className="h-4 w-4" aria-hidden="true" />
                  {copied ? "Copied address" : "Copy address"}
                </Button>
                <Button type="button" variant="secondary" size="lg" className="w-full gap-2" onClick={() => openSheet("receive")}>
                  <ReceiveIcon className="h-4 w-4" aria-hidden="true" />
                  Receive
                </Button>
                <Button type="button" variant="secondary" size="lg" className="w-full gap-2" onClick={() => openSheet("send")}>
                  <SendIcon className="h-4 w-4" aria-hidden="true" />
                  Send SOL
                </Button>
                <Button type="button" variant="secondary" size="lg" className="w-full" onClick={handleChangeWallet}>
                  Change wallet
                </Button>
              </section>

              <section className="rounded-[24px] bg-[rgba(14,91,255,0.08)] px-4 py-3 text-sm leading-6 text-[var(--brand-muted-ink)]">
                Transfers still require wallet approval. Nothing moves until you confirm inside your wallet extension.
              </section>

              <Button type="button" variant="danger" size="lg" className="w-full" onClick={handleDisconnect}>
                Disconnect wallet
              </Button>
            </div>
          ) : null}

          {sheet === "receive" ? (
            <div className="grid gap-4">
              <section className="rounded-[30px] bg-[linear-gradient(135deg,rgba(14,91,255,0.10),rgba(255,255,255,0.6))] p-5 shadow-[inset_1px_1px_0_rgba(255,255,255,0.55),0_18px_40px_rgba(16,33,58,0.08)]">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(255,255,255,0.82)] text-[var(--brand-primary)] shadow-neoInsetSm">
                  <ReceiveIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-4 text-lg font-semibold tracking-[-0.03em] text-[var(--brand-ink)]">Incoming funds</p>
                <p className="mt-2 text-sm leading-6 text-[var(--brand-muted-ink)]">
                  Share this exact address when you want to receive SOL into the wallet connected to CipherPay.
                </p>
              </section>

              <div className="grid gap-2">
                <Label htmlFor="wallet-receive-address">Wallet address</Label>
                <Input
                  id="wallet-receive-address"
                  value={walletAddress ?? ""}
                  readOnly
                  placeholder="Connect a wallet"
                  className="font-mono-ui text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" size="lg" className="w-full" onClick={handleCopyAddress} disabled={!walletAddress}>
                  {copied ? "Copied address" : "Copy address"}
                </Button>
                <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => openSheet("manage")}>
                  Back to wallet
                </Button>
              </div>
            </div>
          ) : null}

          {sheet === "send" ? (
            <div className="grid gap-4">
              {!connected || !publicKey ? (
                <section className="rounded-[24px] bg-[rgba(255,255,255,0.72)] p-5 text-sm leading-6 text-[var(--brand-muted-ink)] shadow-neoInsetSm">
                  Connect a wallet before you send funds.
                </section>
              ) : (
                <>
                  <section className="rounded-[30px] bg-[linear-gradient(135deg,rgba(14,91,255,0.12),rgba(255,255,255,0.58))] p-5 shadow-[inset_1px_1px_0_rgba(255,255,255,0.55),0_18px_40px_rgba(16,33,58,0.08)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-muted-ink)]">Sending from</p>
                        <p className="mt-2 font-mono-ui text-sm text-[var(--brand-ink)]">{walletAddress ? truncateAddress(walletAddress) : "No wallet"}</p>
                      </div>
                      <div className="rounded-[22px] bg-[rgba(255,255,255,0.78)] px-4 py-3 text-right shadow-neoInsetSm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-muted-ink)]">Available</p>
                        <p className="mt-1 text-lg font-semibold tracking-[-0.04em] text-[var(--brand-ink)] tabular-nums">
                          {balanceLabel} <span className="text-xs font-medium text-[var(--brand-muted-ink)]">SOL</span>
                        </p>
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-2">
                    <Label htmlFor="wallet-send-to">Recipient address</Label>
                    <Input
                      id="wallet-send-to"
                      value={sendTo}
                      onChange={(event) => setSendTo(event.target.value)}
                      placeholder="Enter a Solana address"
                      autoComplete="off"
                      inputMode="text"
                      className="font-mono-ui text-sm"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="wallet-send-amount">Amount</Label>
                    <Input
                      id="wallet-send-amount"
                      value={sendAmount}
                      onChange={(event) => setSendAmount(event.target.value)}
                      placeholder="0.00"
                      autoComplete="off"
                      inputMode="decimal"
                    />
                  </div>

                  {sendError ? (
                    <div className="rounded-[22px] bg-[rgba(209,67,67,0.12)] px-4 py-3 text-sm text-red-800 shadow-[inset_1px_1px_0_rgba(255,255,255,0.55)]">
                      {sendError}
                    </div>
                  ) : null}

                  {sendSuccess ? (
                    <div className="rounded-[22px] bg-[rgba(15,159,110,0.12)] px-4 py-3 text-sm text-emerald-800 shadow-[inset_1px_1px_0_rgba(255,255,255,0.55)]">
                      {sendSuccess}
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => openSheet("manage")}>
                      Back to wallet
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      className="w-full"
                      onClick={handleSend}
                      disabled={isSending}
                      aria-busy={isSending}
                    >
                      {isSending ? "Waiting for approval..." : "Review and send"}
                    </Button>
                  </div>

                  <p className="text-xs leading-6 text-[var(--brand-muted-ink)]">
                    CipherPay prepares the transfer, but your wallet still has the final approval step.
                  </p>
                </>
              )}
            </div>
          ) : null}
        </WalletDialog>
      ) : null}
    </>
  );
}
