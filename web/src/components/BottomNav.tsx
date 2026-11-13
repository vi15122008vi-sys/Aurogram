import { Bot, MessageCircle, Rss, Settings2 } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { springPress } from "../lib/motion";

export type AppTab = "channels" | "bots" | "chats" | "settings";

interface BottomNavProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

/* Тонкие иконки Lucide (stroke 1.4) вместо плотных заливок. */
const items = [
  { id: "chats", label: "Чаты", icon: MessageCircle },
  { id: "channels", label: "Каналы", icon: Rss },
  { id: "bots", label: "Боты", icon: Bot },
  { id: "settings", label: "Настройки", icon: Settings2 },
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
                ? "bg-accent/10 text-accent"
                : "text-muted hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink"}`}
            >
              <Icon size={17} strokeWidth={1.4} />
              <span>{t(label)}</span>
              {selected && (
                <motion.span
                  layoutId="bottom-nav-marker"
                  className="absolute inset-x-[34%] top-1 h-0.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]"
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



