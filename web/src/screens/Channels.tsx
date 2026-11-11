import { useEffect, useState } from "react";
import { ArrowRight, ChartNoAxesColumn, Radio, RefreshCw, Search, Send, Users } from "lucide-react";
import { api, type ChannelRecord } from "../lib/api";
import { Avatar } from "../components/Avatar";
import { useI18n } from "../lib/i18n";

interface ChannelsProps {
  onOpen: (channel: ChannelRecord) => void;
  onPublish?: (channel: ChannelRecord) => void;
  onStatistics?: (channel: ChannelRecord) => void;
}

export function Channels({ onOpen, onPublish, onStatistics }: ChannelsProps) {
  const { t } = useI18n();
  const [listView, setListView] = useState<"channels" | "mine">("channels");
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (listView === "mine" ? api.channels.admined() : api.channels.list())
      .then((result) => {
        if (active) setChannels(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(t(cause instanceof Error ? cause.message : "Не удалось загрузить каналы"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey, listView]);

  const filteredChannels = channels.filter((channel) => `${channel.title} ${channel.username ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));

  return (
    <section className="animate-[rise-in_240ms_ease-out]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t("PUBLISHING")}</p>
          <h1 className="mt-2 text-[28px] font-semibold">{t("Каналы")}</h1>
        </div>
        <button
          type="button"
          className="grid size-9 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:bg-raised hover:text-ink disabled:opacity-50"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
          aria-label={t("Обновить каналы")}
          title={t("Обновить")}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="mt-5 inline-flex rounded-xl border border-line bg-surface/70 p-1" role="tablist" aria-label={t("Раздел каналов")}>
        {([ ["channels", "Каналы"], ["mine", "Мои каналы"] ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={listView === id} onClick={() => setListView(id)} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${listView === id ? "bg-accent/15 text-accent" : "text-muted hover:text-ink"}`}>
            {t(label)}
          </button>
        ))}
      </div>
      <label className="mt-5 flex h-9 max-w-lg items-center gap-2 rounded-lg border border-line bg-surface px-3 text-muted">
        <Search size={15} />
        <input aria-label={t("Поиск каналов")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Поиск каналов")} className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
      </label>
      {error && <p role="alert" className="mt-5 rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {filteredChannels.length ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {filteredChannels.map((channel) => (
            <article key={channel.id} className="group/card rounded-xl border border-border bg-surface/90 p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/25 hover:bg-surface hover:shadow-[0_12px_36px_rgb(0_0_0_/_18%)]">
              <button type="button" onClick={() => onOpen(channel)} className="group flex w-full items-center gap-3 text-left">
                <Avatar name={channel.title} id={channel.id} className="size-10 border border-white/10" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-ink">{channel.title}</span>{(channel.scheduled_count ?? 0) > 0 && <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent"><span className="size-1.5 rounded-full bg-accent" />{channel.scheduled_count} {t("отложено")}</span>}</span>
                  <span className="mt-1 block truncate text-xs text-muted">{channel.username ? `@${channel.username}` : `ID ${channel.id}`}</span>
                  <span className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-muted"><Users size={12} />{channel.subscribers.toLocaleString("ru-RU")}</span>
                </span>
                <ArrowRight size={15} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
              </button>
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <button type="button" onClick={() => (onPublish ?? onOpen)(channel)} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-2 text-xs font-medium text-white transition hover:bg-accent-strong"><Send size={13} strokeWidth={1.5} />{t("Опубликовать")}</button>
                <button type="button" onClick={() => (onStatistics ?? onOpen)(channel)} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-2 text-xs font-medium text-ink transition hover:border-accent/20 hover:bg-surfaceRaised"><ChartNoAxesColumn size={13} strokeWidth={1.5} />{t("Статистика")}</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid min-h-[280px] place-items-center rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center">
          <div className="max-w-xs">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-raised text-muted"><Radio size={21} strokeWidth={1.5} /></span>
            <h2 className="mt-4 text-base font-semibold">{loading ? t("Загружаем каналы…") : query ? t("Совпадений нет") : t("Каналов пока нет")}</h2>
            {!loading && !error && !query && <p className="mt-2 text-sm leading-6 text-muted">{t(listView === "mine" ? "Здесь появятся публичные каналы, которыми вы управляете." : "Здесь появятся каналы, где у аккаунта есть права администратора.")}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
