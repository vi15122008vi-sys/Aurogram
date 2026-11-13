import { LogOut, Phone } from "lucide-react";
import { AurogramLogo } from "./AurogramLogo";
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
          <AurogramLogo size={30} className="shrink-0 transition duration-200 group-hover:scale-105 motion-reduce:transition-none" />
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
