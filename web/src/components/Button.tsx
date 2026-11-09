import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "accent" | "outline" | "quiet" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  accent: "bg-accent text-white hover:bg-accent-strong",
  outline: "border border-line bg-surface text-ink hover:bg-raised",
  quiet: "text-muted hover:bg-raised hover:text-ink",
  danger: "border border-line bg-danger/10 text-danger hover:bg-danger/15",
};

export function Button({ variant = "accent", className = "", children, ...props }: ButtonProps) {
  return <button {...props} className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}>{children}</button>;
}