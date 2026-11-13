import type { CSSProperties } from "react";

/** Серая пульсирующая плашка: держит высоту блока, пока грузятся данные. */
export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`block animate-pulse rounded-[10px] bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] ${className}`}
    />
  );
}
