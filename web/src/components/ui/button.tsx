import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-[#111] bg-[var(--brand-primary)] text-white shadow-neoSm hover:bg-[#111] hover:shadow-neo active:shadow-none",
  secondary:
    "border-[#111] bg-white text-[var(--brand-ink)] shadow-neoSm hover:bg-[#111] hover:text-white hover:shadow-neo active:shadow-none",
  ghost:
    "border-[var(--brand-border)] bg-transparent text-[var(--brand-primary)] hover:border-[#111] hover:bg-white hover:text-[#111] active:bg-[var(--brand-surface-muted)]",
  danger:
    "border-[#111] bg-[var(--brand-danger)] text-white shadow-neoSm hover:bg-[#111] active:shadow-none",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex min-w-fit items-center justify-center rounded-2xl font-medium",
          "border transition-[box-shadow,transform,background-color,color,border-color] duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-surface)]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
          "rounded-[2px] active:translate-x-0.5 active:translate-y-0.5",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
