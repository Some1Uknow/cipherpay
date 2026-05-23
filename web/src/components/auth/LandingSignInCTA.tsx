"use client";

import * as React from "react";

import { WalletSignInButton } from "@/components/auth/WalletSignInButton";

export function LandingSignInCTA({
  className,
  label = "Open workspace",
  nextPath,
  autoStart,
}: {
  className?: string;
  label?: string;
  nextPath?: string | null;
  autoStart?: boolean;
}) {
  const [status, setStatus] = React.useState<"idle" | "connecting" | "signing" | "error" | "success">("idle");
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className={className}>
      <WalletSignInButton
        size="lg"
        className="w-full rounded-2xl px-6"
        nextPath={nextPath}
        autoStart={autoStart}
        onStatusChange={(nextStatus) => {
          setStatus(nextStatus);
          if (nextStatus !== "error") setError(null);
        }}
        onSignInError={(message) => {
          setError(message);
        }}
        onMouseDown={() => {
          setError(null);
        }}
      >
        {status === "signing" ? "Verifying wallet…" : status === "connecting" ? "Connect wallet…" : label}
      </WalletSignInButton>

      {error ? (
        <p className="mt-3 text-sm text-red-800">{error}</p>
      ) : null}
    </div>
  );
}
