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
    "bg-[var(--brand-primary)] text-white shadow-neoSm hover:bg-[var(--brand-primary-dark)] hover:shadow-neo active:shadow-neoPrimaryInsetSm",
  secondary:
    "bg-[var(--brand-surface)] text-[var(--brand-ink)] shadow-neoSm hover:shadow-neo active:shadow-neoInsetSm",
  ghost:
    "bg-transparent text-[var(--brand-primary)] hover:bg-[var(--brand-surface)] hover:shadow-neoInsetSm active:shadow-neoInset",
  danger:
    "bg-[var(--brand-danger)] text-white shadow-neoSm hover:opacity-95 active:shadow-neoPrimaryInsetSm",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-11 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex min-w-fit items-center justify-center rounded-2xl font-medium",
          "transition-[box-shadow,transform,background-color,color] duration-300 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-surface)]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
          "hover:-translate-y-[1px] active:translate-y-[0.5px]",
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
