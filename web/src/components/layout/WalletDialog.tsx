"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WalletDialogProps = {
  children: React.ReactNode;
  description: string;
  onClose: () => void;
  title: string;
};

function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6l-12 12" />
    </svg>
  );
}

export function WalletDialog({ children, description, onClose, title }: WalletDialogProps) {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(16,33,58,0.34)] backdrop-blur-[10px]"
        aria-label="Close"
        onClick={onClose}
      />

      <div
        className={cn(
          "relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-[560px] overflow-y-auto rounded-[36px]",
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,0.72))]",
          "shadow-[0_32px_80px_rgba(16,33,58,0.18),inset_1px_1px_0_rgba(255,255,255,0.7)]",
        )}
      >
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(14,91,255,0.16),transparent_72%)]" aria-hidden="true" />

        <div className="relative p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-muted-ink)]">Wallet</p>
              <h2 className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em] text-[var(--brand-ink)]">{title}</h2>
              <p className="mt-2 max-w-[34ch] text-sm leading-6 text-[var(--brand-muted-ink)]">{description}</p>
            </div>

            <Button type="button" variant="secondary" size="sm" className="h-11 w-11 shrink-0 p-0" onClick={onClose}>
              <CloseIcon className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
