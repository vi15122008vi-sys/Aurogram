import { Bot, MessagesSquare, RadioTower, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { springPress } from "../lib/motion";

export type AppTab = "channels" | "bots" | "chats" | "settings";

interface BottomNavProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

const items = [
  { id: "channels", label: "Каналы", icon: RadioTower },
  { id: "bots", label: "Боты", icon: Bot },
  { id: "chats", label: "Чаты", icon: MessagesSquare },
  { id: "settings", label: "Настройки", icon: SlidersHorizontal },
] as const;

export function BottomNav({ active, onChange }: BottomNavProps) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("Основная навигация")} className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="glass-panel mx-auto grid h-16 max-w-md grid-cols-4 gap-1 rounded-[26px] p-1.5">
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
              className={`relative flex flex-col items-center justify-center gap-1 rounded-[20px] text-[10px] font-medium transition duration-200 ${selected
                ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_18%,transparent),0_8px_20px_color-mix(in_srgb,var(--accent)_16%,transparent)]"
                : "text-muted hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink"}`}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span>{t(label)}</span>
              {selected && (
                <motion.span
                  layoutId="bottom-nav-marker"
                  className="absolute inset-x-[32%] top-1 h-0.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]"
                  aria-hidden="true"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}

