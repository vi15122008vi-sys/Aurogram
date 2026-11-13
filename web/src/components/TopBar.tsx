import { LogOut, Phone } from "lucide-react";
import { useI18n } from "../lib/i18n";

interface TopBarProps {
  accountName: string;
  onLogout: () => void;
  onCall?: () => void;
}

export function TopBar({ accountName, onLogout, onCall }: TopBarProps) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--canvas)_78%,transparent)] px-2 pt-2 backdrop-blur-[18px] sm:px-4 sm:pt-3">
      <div className="glass-panel mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-[26px] px-2.5 sm:px-3.5">
        <div className="group flex min-w-0 items-center gap-2.5 text-ink" aria-label="Aurogram">
          <span className="grid size-9 shrink-0 place-items-center rounded-[14px] bg-accent/10 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_16%,transparent),inset_0_1px_0_var(--glass-highlight),0_0_18px_color-mix(in_srgb,var(--accent)_22%,transparent)] transition duration-200 group-hover:scale-105 group-hover:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_26%,transparent),inset_0_1px_0_var(--glass-highlight),0_0_26px_color-mix(in_srgb,var(--accent)_34%,transparent)] motion-reduce:transition-none">
            <svg aria-hidden="true" viewBox="0 0 32 32" className="size-[21px] overflow-visible drop-shadow-[0_0_5px_color-mix(in_srgb,var(--accent)_38%,transparent)] transition duration-200 group-hover:drop-shadow-[0_0_8px_color-mix(in_srgb,var(--accent-strong)_65%,transparent)] motion-reduce:transition-none">
              <defs>
                <linearGradient id="aurogram-logo-gradient" x1="5" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--accent)" />
                  <stop offset="1" stopColor="var(--accent-strong)" />
                </linearGradient>
              </defs>
              <path d="M6.5 25 16 6.5 25.5 25M10.3 17.6h11.4" fill="none" stroke="url(#aurogram-logo-gradient)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">Aurogram</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full bg-surface/60 px-3 py-1.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)] sm:flex">
            <span className="size-1.5 rounded-full bg-success shadow-[0_0_8px_var(--success)]" aria-label={t("Аккаунт активен")} title={t("Аккаунт активен")} />
            <span className="max-w-40 truncate text-xs text-muted">{accountName}</span>
          </span>
          <span className="size-2 rounded-full bg-success shadow-[0_0_8px_var(--success)] sm:hidden" aria-hidden="true" />
          {onCall && (
            <button
              type="button"
              className="glass-hover flex h-9 items-center gap-1.5 rounded-[14px] bg-surface/60 px-2.5 text-muted transition duration-200 hover:bg-success/10 hover:text-success"
              onClick={onCall}
              aria-label={t("Позвонить", "Call")}
              title={t("Позвонить", "Call")}
            >
              <Phone size={16} strokeWidth={1.6} />
              <span className="hidden text-xs font-medium sm:inline">{t("Позвонить", "Call")}</span>
            </button>
          )}
          <button
            type="button"
            className="glass-hover grid size-9 place-items-center rounded-[14px] bg-surface/60 text-muted transition duration-200 hover:bg-accent/10 hover:text-accent"
            onClick={onLogout}
            aria-label={t("Выйти из аккаунта")}
            title={t("Выйти")}
          >
            <LogOut size={17} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </header>
  );
}
