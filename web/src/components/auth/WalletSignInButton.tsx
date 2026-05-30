"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import { Button, type ButtonProps } from "@/components/ui/button";
import { createWalletSession } from "@/lib/auth/client";

type WalletSignInButtonProps = Omit<ButtonProps, "onClick"> & {
  redirectTo?: string;
  nextPath?: string | null;
  autoStart?: boolean;
  onStatusChange?: (status: "idle" | "connecting" | "signing" | "error" | "success") => void;
  onSignInError?: (message: string) => void;
};

export function WalletSignInButton({
  redirectTo = "/pay",
  nextPath,
  autoStart = false,
  onStatusChange,
  onSignInError,
  children,
  disabled,
  ...props
}: WalletSignInButtonProps) {
  const router = useRouter();

  const { setVisible, visible } = useWalletModal();
  const { connected, connecting, publicKey, signIn: walletSignIn, signMessage } = useWallet();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [pendingAfterConnect, setPendingAfterConnect] = React.useState(false);
  const didAutoStartRef = React.useRef(false);

  const target = nextPath && nextPath.startsWith("/") ? nextPath : redirectTo;

  const signIn = React.useCallback(async () => {
    onStatusChange?.("signing");
    setIsSubmitting(true);

    try {
      if (!connected || !publicKey) {
        throw new Error("Connect a supported wallet before creating a session.");
      }

      if (!signMessage && !walletSignIn) {
        throw new Error("This wallet does not expose message signing. Use a supported Solana wallet.");
      }

      await createWalletSession({
        walletAddress: publicKey.toBase58(),
        signMessage,
        signIn: walletSignIn,
      });
      onStatusChange?.("success");
      router.push(target);
      router.refresh();
    } catch (error) {
      onStatusChange?.("error");
      throw error;
    } finally {
      setIsSubmitting(false);
      setPendingAfterConnect(false);
    }
  }, [connected, onStatusChange, publicKey, router, walletSignIn, signMessage, target]);

  const start = React.useCallback(async () => {
    onStatusChange?.("idle");

    if (connected && publicKey) {
      await signIn();
      return;
    }

    onStatusChange?.("connecting");
    setPendingAfterConnect(true);
    setVisible(true);
  }, [connected, onStatusChange, publicKey, setVisible, signIn]);

  React.useEffect(() => {
    if (!pendingAfterConnect) return;
    if (isSubmitting) return;
    if (!connected || !publicKey) return;

    void signIn().catch((error) => {
      const message = error instanceof Error ? error.message : "Wallet sign-in failed.";
      onSignInError?.(message);
    });
  }, [connected, isSubmitting, onSignInError, pendingAfterConnect, publicKey, signIn]);

  React.useEffect(() => {
    if (!pendingAfterConnect) return;
    if (visible) return;
    if (connecting) return;
    if (connected) return;

    setPendingAfterConnect(false);
    onStatusChange?.("idle");
  }, [connected, connecting, onStatusChange, pendingAfterConnect, visible]);

  React.useEffect(() => {
    if (!autoStart) return;
    if (didAutoStartRef.current) return;

    didAutoStartRef.current = true;
    void start().catch((error) => {
      const message = error instanceof Error ? error.message : "Wallet sign-in failed.";
      onSignInError?.(message);
    });
  }, [autoStart, onSignInError, start]);

  const isDisabled =
    disabled ||
    isSubmitting ||
    connecting ||
    (pendingAfterConnect && !connected) ||
    (connected && !publicKey);

  return (
    <Button
      {...props}
      disabled={isDisabled}
      onClick={() => {
        void start().catch((error) => {
          const message = error instanceof Error ? error.message : "Wallet sign-in failed.";
          onSignInError?.(message);
        });
      }}
    >
      {children}
    </Button>
  );
}
