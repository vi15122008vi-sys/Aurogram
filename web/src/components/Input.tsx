import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  const inputId = id || props.name;
  return (
    <label className="block min-w-0 text-sm font-medium text-ink" htmlFor={inputId}>
      {label}
      <input {...props} id={inputId} className={`mt-1.5 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent ${className}`} />
      {error && <span role="alert" className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}