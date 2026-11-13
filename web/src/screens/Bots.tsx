import { ChevronRight } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { Avatar } from "../components/Avatar";

export interface BotSummary {
  id: number;
  name: string;
  username: string;
  webhookSet?: boolean;
}

interface BotsProps {
  bots: BotSummary[];
  onOpen?: (bot: BotSummary) => void;
}

export function Bots({ bots, onOpen }: BotsProps) {
  const { t } = useI18n();
  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t("AUTOMATION")}</p>
      <h1 className="mt-2 text-[28px] font-semibold text-ink">{t("Боты")}</h1>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {bots.map((bot) => (
          <button key={bot.id} type="button" onClick={() => onOpen?.(bot)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:bg-raised">
            <Avatar name={bot.name} id={bot.id} className="size-10 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_8%,transparent)]" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{bot.name}</span><span className="mt-1 block truncate font-mono text-xs text-muted">@{bot.username}</span></span>
            <span className={`size-2 rounded-full ${bot.webhookSet ? "bg-success" : "bg-muted/40"}`} aria-label={bot.webhookSet ? t("Webhook включён") : t("Webhook выключен")} />
            <ChevronRight size={15} className="text-muted" />
          </button>
        ))}
        {!bots.length && <div className="rounded-xl border border-dashed border-line bg-surface p-3 text-center text-sm text-muted">{t("Боты не подключены")}</div>}
      </div>
    </section>
  );
}

