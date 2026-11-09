import { Bot, MessageCircle, Radio, Settings } from "lucide-react";

export type AppTab = "channels" | "bots" | "chats" | "settings";

interface BottomNavProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

const items = [
  { id: "channels", label: "Каналы", icon: Radio },
  { id: "bots", label: "Боты", icon: Bot },
  { id: "chats", label: "Чаты", icon: MessageCircle },
  { id: "settings", label: "Настройки", icon: Settings },
] as const;

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav aria-label="Основная навигация" className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-30 h-14 border-t border-line bg-surface/95 px-2 backdrop-blur-xl">
      <div className="mx-auto grid h-14 max-w-2xl grid-cols-4">
        {items.map(({ id, label, icon: Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={selected ? "page" : undefined}
              aria-label={label}
              onClick={() => onChange(id)}
              className={`relative flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition ${selected ? "text-accent" : "text-muted hover:text-ink"}`}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span>{label}</span>
              {selected && <span className="absolute bottom-1 size-1 rounded-full bg-accent" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}