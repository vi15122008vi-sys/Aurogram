import { AudioLines, LogOut } from "lucide-react";

interface TopBarProps {
  accountName: string;
  onLogout: () => void;
}

export function TopBar({ accountName, onLogout }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:px-5">
        <div className="flex items-center gap-2.5 text-ink" aria-label="Aurogram">
          <span className="grid size-8 place-items-center rounded-lg bg-ink text-canvas">
            <AudioLines aria-hidden="true" size={17} strokeWidth={1.5} />
          </span>
          <span className="text-[15px] font-semibold">Aurogram</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden max-w-40 truncate text-sm text-muted sm:block">{accountName}</span>
          <span className="size-2 rounded-full bg-success" aria-label="Аккаунт активен" title="Аккаунт активен" />
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-raised hover:text-ink"
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