"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createWalletSession } from "@/lib/auth/client";
import { clearStoredWalletPreference } from "@/lib/wallet/local-wallet-preference";

export function WalletAuthPanel() {
  const router = useRouter();
  const { connected, publicKey, signIn, signMessage } = useWallet();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    clearStoredWalletPreference();
  }, []);

  const handleWalletSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    if (!connected || !publicKey) {
      setErrorMessage("Connect a supported wallet before creating a session.");
      setIsSubmitting(false);
      return;
    }

    if (!signMessage && !signIn) {
      setErrorMessage("This wallet does not expose message signing. Use a supported Solana wallet.");
      setIsSubmitting(false);
      return;
    }

    try {
      const walletAddress = publicKey.toBase58();
      await createWalletSession({ walletAddress, signMessage, signIn });

      setSuccessMessage("Wallet verified. Opening your payout workspace.");
      router.push("/pay");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet sign-in failed.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open your workspace</CardTitle>
        <CardDescription>Use the wallet that will fund and approve payout runs.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface-muted)] p-5">
          <p className="text-sm leading-6 text-[var(--brand-muted-ink)]">
            You will sign a message to prove wallet ownership. No transaction is sent and no funds move.
          </p>
        </div>

        <WalletMultiButton className="!h-12 !w-full !justify-center !rounded-2xl !px-5 !text-sm !font-medium" />

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={!connected || !publicKey || (!signMessage && !signIn) || isSubmitting}
          onClick={handleWalletSignIn}
        >
          {isSubmitting ? "Verifying wallet..." : "Sign message and continue"}
        </Button>

        {!connected ? (
          <p className="text-sm text-[var(--brand-muted-ink)]">
            Supported now: Phantom, Solflare, and Wallet Standard wallets.
          </p>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-[rgba(209,67,67,0.12)] bg-[rgba(209,67,67,0.07)] px-4 py-3 text-sm text-red-800">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-[rgba(15,159,110,0.12)] bg-[rgba(15,159,110,0.07)] px-4 py-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
