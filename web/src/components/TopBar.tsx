import { AudioLines, LogOut } from "lucide-react";

interface TopBarProps {
  accountName: string;
  onLogout: () => void;
}

export function TopBar({ accountName, onLogout }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-surface/75 shadow-[0_1px_0_rgb(255_255_255_/_2%)] backdrop-blur-2xl supports-[backdrop-filter]:bg-surface/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:px-5">
        <div className="flex items-center gap-2.5 text-ink" aria-label="Aurogram">
          <span className="grid size-8 place-items-center rounded-[10px] border border-accent/20 bg-accent/10 text-accent shadow-[inset_0_1px_0_rgb(255_255_255_/_8%)]">
            <AudioLines aria-hidden="true" size={17} strokeWidth={1.5} />
          </span>
          <span className="text-[15px] font-semibold">Aurogram</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden max-w-40 truncate text-sm text-muted sm:block">{accountName}</span>
          <span className="size-2 rounded-full bg-success" aria-label="Аккаунт активен" title="Аккаунт активен" />
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg border border-transparent text-muted transition duration-200 hover:border-border hover:bg-surfaceRaised hover:text-ink"
            onClick={onLogout}
            aria-label="Выйти из аккаунта"
            title="Выйти"
          >
            <LogOut size={17} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </header>
  );
}
