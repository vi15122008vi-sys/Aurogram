import { useId } from "react";

interface AurogramLogoProps {
  size?: number;
  className?: string;
  title?: string;
  glow?: boolean;
}

/**
 * «Призрачный самолёт»: буква «A», собранная из крыльев бумажного самолётика.
 * Градиент Telegram Blue → Aurogram Indigo, полупрозрачные крылья,
 * мягкое фиолетовое свечение. Без рамок и фона.
 */
export function AurogramLogo({ size = 26, className = "", title = "Aurogram", glow = true }: AurogramLogoProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradientId = `aurogram-logo-${rawId}`;

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
      fill="none"
      style={glow ? { filter: "drop-shadow(0 0 6px rgba(139,92,246,0.5))" } : undefined}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradientId} x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2AABEE" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      {/* Крылья: правое — «лицо» самолётика, левое — призрачная тень. */}
      <path d="M16 5.5 26.6 14.2 18.7 16.6Z" fill={`url(#${gradientId})`} fillOpacity="0.36" />
      <path d="M16 5.5 5.4 14.2 13.3 16.6Z" fill={`url(#${gradientId})`} fillOpacity="0.16" />
      {/* Ноги буквы «A» и перекладина. */}
      <path d="M5.5 26.6 16 5.5 26.5 26.6" stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.2 19.4h11.6" stroke={`url(#${gradientId})`} strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}
