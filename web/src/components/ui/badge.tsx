import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "blue" | "green" | "amber" | "slate";

const toneClasses: Record<BadgeTone, string> = {
  blue: "border-[var(--brand-primary)] bg-white text-[var(--brand-primary)]",
  green: "border-[var(--brand-success)] bg-white text-[var(--brand-success)]",
  amber: "border-[var(--brand-warning)] bg-white text-[var(--brand-warning)]",
  slate: "border-[var(--brand-border)] bg-white text-[var(--brand-muted-ink)]",
};

export function Badge({
  className,
  tone = "slate",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-[2px] border px-2.5 text-[11px] font-medium uppercase tracking-[0.08em]",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
