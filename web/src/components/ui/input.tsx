import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-2xl bg-[var(--brand-surface)] px-4 text-sm text-[var(--brand-ink)] shadow-neoInsetSm",
        "placeholder:text-[rgba(61,72,82,0.45)]",
        "transition-[box-shadow] duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-surface)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
