import { LogOut } from "lucide-react";
import { useI18n } from "../lib/i18n";

interface TopBarProps {
  accountName: string;
  onLogout: () => void;
}

export function TopBar({ accountName, onLogout }: TopBarProps) {
  const { t } = useI18n();
  return (
    <header className="glass-panel sticky top-0 z-20 border-b border-border/80 bg-surface/55 shadow-[0_1px_0_rgb(255_255_255_/_2%)] backdrop-blur-glass">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:px-5">
        <div className="group flex items-center gap-2.5 text-ink" aria-label="Aurogram">
          <span className="grid size-8 place-items-center rounded-[10px] border border-accent/25 bg-accent/10 shadow-[inset_0_1px_0_rgb(255_255_255_/_8%),0_0_14px_rgb(99_102_241_/_18%)] transition duration-200 group-hover:scale-105 group-hover:border-violet-400/40 group-hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_10%),0_0_20px_rgb(139_92_246_/_38%)] motion-reduce:transition-none">
            <svg aria-hidden="true" viewBox="0 0 32 32" className="size-[21px] overflow-visible drop-shadow-[0_0_5px_rgb(99_102_241_/_35%)] transition duration-200 group-hover:drop-shadow-[0_0_8px_rgb(139_92_246_/_65%)] motion-reduce:transition-none">
              <defs>
                <linearGradient id="aurogram-logo-gradient" x1="5" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366F1" />
                  <stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <path d="M6.5 25 16 6.5 25.5 25M10.3 17.6h11.4" fill="none" stroke="url(#aurogram-logo-gradient)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold">Aurogram</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden max-w-40 truncate text-sm text-muted sm:block">{accountName}</span>
          <span className="size-2 rounded-full bg-success" aria-label={t("Аккаунт активен")} title={t("Аккаунт активен")} />
          <button
            type="button"
            className="glass-hover grid size-9 place-items-center rounded-lg border border-transparent text-muted transition duration-200 hover:border-border hover:bg-surfaceRaised hover:text-ink"
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
