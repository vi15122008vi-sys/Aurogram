import { useEffect, useState } from "react";

const gradients = [
  ["#6366F1", "#8B5CF6"], ["#0EA5E9", "#2563EB"], ["#10B981", "#0F766E"],
  ["#F97316", "#DB2777"], ["#EC4899", "#8B5CF6"], ["#14B8A6", "#4F46E5"],
  ["#F59E0B", "#EF4444"], ["#06B6D4", "#7C3AED"],
] as const;

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.codePointAt(0) ?? 0;
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function initials(name: string, id?: string | number): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0] ?? "").join("");
  return (letters || String(id ?? "?").slice(0, 1)).toLocaleUpperCase();
}

interface AvatarProps {
  name: string;
  id?: string | number;
  src?: string | null;
  className?: string;
}

export function Avatar({ name, id, src, className = "size-10" }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [src]);
  const [start, end] = gradients[hash(`${name}:${id ?? ""}`) % gradients.length];

  return (
    <span
      role="img"
      aria-label={name || String(id ?? "")}
      className={`relative inline-grid aspect-square shrink-0 place-items-center overflow-hidden rounded-full text-sm font-semibold text-white ${className}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${start}, ${end})`,
        boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.22), inset 0 -12px 24px rgb(0 0 0 / 0.18), 0 6px 16px ${start}33`,
      }}
    >
      {src && !imageFailed && <img src={src} alt="" loading="lazy" className="absolute inset-0 size-full rounded-full object-cover" onError={() => setImageFailed(true)} />}
      {(!src || imageFailed) && <span className="drop-shadow-[0_1px_2px_rgb(0_0_0_/_25%)]">{initials(name, id)}</span>}
    </span>
  );
}
