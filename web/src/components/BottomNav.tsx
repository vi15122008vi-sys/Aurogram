import { Bot, MessageCircle, Radio, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { springPress } from "../lib/motion";

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
  const { t } = useI18n();
  return (
    <nav aria-label={t("Основная навигация")} className="glass-panel fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-surface/55 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_36px_rgb(0_0_0_/_18%)] backdrop-blur-glass">
      <div className="mx-auto grid h-14 max-w-2xl grid-cols-4">
        {items.map(({ id, label, icon: Icon }) => {
          const selected = active === id;
          return (
            <motion.button
              key={id}
              type="button"
              aria-current={selected ? "page" : undefined}
              aria-label={t(label)}
              onClick={() => onChange(id)}
              whileTap={springPress}
              className={`glass-hover relative mx-1 my-1 flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition duration-200 ${selected ? "bg-accent/10 text-accent" : "text-muted hover:bg-surfaceRaised/70 hover:text-ink"}`}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span>{t(label)}</span>
              {selected && <span className="absolute inset-x-5 -top-1 h-px rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" aria-hidden="true" />}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
