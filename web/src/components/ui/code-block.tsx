"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type CodeBlockProps = {
  code: string;
  className?: string;
  tone?: "light" | "dark";
};

export function CodeBlock({ code, className, tone = "light" }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<number | null>(null);
  const isDark = tone === "dark";

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }

    timeoutRef.current = window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border",
        isDark ? "border-white/10 bg-[#101820] text-white/80" : "border-[rgba(15,23,42,0.12)] bg-white text-[var(--brand-muted-ink)]",
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          "absolute right-3 top-3 text-xs font-medium",
          isDark ? "text-white/70 hover:text-white" : "text-[var(--brand-muted-ink)] hover:text-[var(--brand-ink)]",
        )}
        onClick={() => void handleCopy()}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto px-4 py-3 text-xs leading-5">
        <code className="whitespace-pre-wrap break-words">{code}</code>
      </pre>
    </div>
  );
}
