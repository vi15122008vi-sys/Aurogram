import { ArrowLeft, Bot, Webhook } from "lucide-react";
import type { BotSummary } from "./Bots";

interface BotDetailProps {
  bot: BotSummary;
  onBack: () => void;
}

export function BotDetail({ bot, onBack }: BotDetailProps) {
  return (
    <section>
      <button type="button" onClick={onBack} className="mb-4 inline-flex h-8 items-center gap-2 rounded-lg px-2 text-xs font-medium text-muted hover:bg-surface hover:text-ink"><ArrowLeft size={15} />Боты</button>
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-lg bg-accent/10 text-accent"><Bot size={19} /></span><div><h1 className="text-[25px] font-semibold text-ink">{bot.name}</h1><p className="mt-1 font-mono text-xs text-muted">@{bot.username}</p></div></div>
      <div className="mt-6 max-w-2xl divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex items-center gap-3 p-3"><Webhook size={16} className="text-muted" /><span className="flex-1 text-sm text-ink">Webhook</span><span className="font-mono text-xs text-muted">{bot.webhookSet ? "Включён" : "Не настроен"}</span></div>
        <div className="p-3 text-xs text-muted">Настройки webhook доступны в деталях подключённого бота.</div>
      </div>
    </section>
  );
}