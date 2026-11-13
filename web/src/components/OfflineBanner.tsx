import { WifiOff } from "lucide-react";
import { useI18n } from "../lib/i18n";

interface OfflineBannerProps {
  hint?: string;
  className?: string;
}

/** Плашка «Нет подключения. Показан кэш». */
export function OfflineBanner({ hint, className = "" }: OfflineBannerProps) {
  const { t } = useI18n();
  return (
    <p
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 rounded-[18px] bg-warning/10 px-3 py-2 text-xs font-medium text-warning shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--warning)_22%,transparent)] ${className}`}
    >
      <WifiOff size={14} className="shrink-0" />
      <span className="min-w-0 truncate">{t("Нет подключения. Показан кэш", "Offline. Showing cached data")}</span>
      {hint && <span className="shrink-0 font-mono text-[10px] text-muted">· {hint}</span>}
    </p>
  );
}
