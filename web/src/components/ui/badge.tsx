import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "blue" | "green" | "amber" | "slate";

const toneClasses: Record<BadgeTone, string> = {
  blue: "border-[rgba(0,82,255,0.15)] bg-[rgba(0,82,255,0.06)] text-[var(--brand-primary)]",
  green: "border-[rgba(15,159,110,0.15)] bg-[rgba(15,159,110,0.08)] text-[var(--brand-success)]",
  amber: "border-[rgba(183,121,31,0.18)] bg-[rgba(183,121,31,0.08)] text-[var(--brand-warning)]",
  slate: "border-[rgba(61,72,82,0.14)] bg-[rgba(61,72,82,0.06)] text-[var(--brand-muted-ink)]",
};

export function Badge({
  className,
  tone = "slate",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-3 text-[11px] font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
