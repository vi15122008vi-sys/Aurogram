import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ChartNoAxesColumn, Eye, Gamepad2, Radio, RefreshCw, Search, Send, Sticker, Timer, Users, X } from "lucide-react";
import { ApiError, api, type ChannelRecord } from "../lib/api";
import { Avatar } from "../components/Avatar";
import { Fab } from "../components/Fab";
import { StudioModal, type StudioSection } from "../components/StudioModal";
import { AuthErrorBanner } from "../components/AuthErrorBanner";
import { useI18n } from "../lib/i18n";

interface ChannelsProps {
  onOpen: (channel: ChannelRecord) => void;
  onPublish?: (channel: ChannelRecord) => void;
  onSchedule?: (channel: ChannelRecord) => void;
  onStatistics?: (channel: ChannelRecord) => void;
}

export function Channels({ onOpen, onPublish, onSchedule, onStatistics }: ChannelsProps) {
  const { t, locale } = useI18n();
  const [listView, setListView] = useState<"channels" | "mine">("channels");
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioSection, setStudioSection] = useState<StudioSection>("widgets");

  const number = useMemo(
    () => new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US"),
    [locale],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (listView === "mine" ? api.channels.admined() : api.channels.list())
      .then((result) => {
        if (active) setChannels(result);
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 401) { setAuthExpired(true); return; }
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

  /* Сводка по всем каналам: просмотры агрегируем только там, где бэкенд их отдал. */
  const summary = useMemo(() => {
    const viewsKnown = channels.filter((channel) => typeof channel.views === "number" && channel.views > 0);
    return {
      channels: channels.length,
      subscribers: channels.reduce((sum, channel) => sum + channel.subscribers, 0),
      views: viewsKnown.length ? viewsKnown.reduce((sum, channel) => sum + (channel.views ?? 0), 0) : null,
      scheduled: channels.reduce((sum, channel) => sum + (channel.scheduled_count ?? 0), 0),
      posts: channels.reduce((sum, channel) => sum + (channel.posts_count ?? 0), 0),
    };
  }, [channels]);

  const shown = number.format(summary.subscribers);

  return (
    <section className="animate-[rise-in_240ms_ease-out]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t("STUDIO", "STUDIO")}</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink">{t("Студия")}</h1>
        </div>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-accent disabled:opacity-50"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
          aria-label={t("Обновить каналы")}
          title={t("Обновить")}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Панель быстрой статистики — витрина админского режима. */}
      <div className="glass-panel mt-5 grid grid-cols-2 gap-2 rounded-[26px] p-2 sm:grid-cols-4">
        <Metric label={t("Каналы")} value={number.format(summary.channels)} hint={t("под управлением", "managed")} />
        <Metric label={t("Подписчики")} value={shown} hint={t("суммарно", "total")} icon={<Users size={13} />} />
        <Metric
          label={t("Просмотры")}
          value={summary.views === null ? "—" : number.format(summary.views)}
          hint={summary.views === null ? t("нет данных", "no data") : t("по последним постам", "last posts")}
          icon={<Eye size={13} />}
        />
        <Metric
          label={t("Отложено")}
          value={number.format(summary.scheduled)}
          hint={t("в расписании", "scheduled")}
          icon={<Timer size={13} />}
          tone={summary.scheduled > 0 ? "accent" : "muted"}
        />
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{t("Мои каналы")}</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t("Под управлением", "Managed")} · {channels.length}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="glass-panel inline-flex rounded-full p-1" role="tablist" aria-label={t("Раздел каналов")}>
          {([["channels", "Все каналы"], ["mine", "Мои"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={listView === id}
              onClick={() => setListView(id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${listView === id ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_16%,transparent)]" : "text-muted hover:text-ink"}`}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface/60 px-3.5 text-muted focus-within:text-accent sm:max-w-xs">
          <Search size={15} />
          <input aria-label={t("Поиск каналов")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Поиск каналов")} className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
        </label>
      </div>

      {authExpired && <AuthErrorBanner />}
      {error && <p role="alert" className="mt-4 rounded-[20px] bg-danger/10 px-3.5 py-2.5 text-sm text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_18%,transparent)]">{error}</p>}

      {filteredChannels.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filteredChannels.map((channel) => {
            const scheduled = channel.scheduled_count ?? 0;
            const views = typeof channel.views === "number" && channel.views > 0 ? channel.views : null;
            return (
              <article key={channel.id} className="glass-panel group/card rounded-[26px] p-3.5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--ring),inset_0_1px_0_var(--glass-highlight),0_18px_44px_color-mix(in_srgb,var(--accent)_14%,transparent)]">
                <button type="button" onClick={() => onOpen(channel)} className="group flex w-full items-center gap-3 rounded-[20px] text-left">
                  <Avatar name={channel.title} id={channel.id} className="size-12 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_8%,transparent),0_8px_20px_rgb(0_0_0_/_18%)]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{channel.title}</span>
                      {scheduled > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
                          <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
                          {scheduled} {t("отложено")}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted">{channel.username ? `@${channel.username}` : `ID ${channel.id}`}</span>
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
                </button>

                <div className="mt-3 flex items-center gap-4 rounded-[18px] bg-surface/40 px-3 py-2">
                  <ChannelStat icon={<Users size={12} />} value={number.format(channel.subscribers)} label={t("подписчиков", "subscribers")} />
                  <ChannelStat icon={<Eye size={12} />} value={views === null ? "—" : number.format(views)} label={t("просмотров", "views")} />
                  <ChannelStat icon={<Timer size={12} />} value={number.format(scheduled)} label={t("в очереди", "queued")} />
                </div>

                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => (onPublish ?? onOpen)(channel)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-strong">
                    <Send size={13} strokeWidth={1.7} />{t("Опубликовать")}
                  </button>
                  <button type="button" onClick={() => (onSchedule ?? onPublish ?? onOpen)(channel)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-surface/60 px-3 text-xs font-medium text-ink transition hover:bg-accent/10 hover:text-accent">
                    <Timer size={13} strokeWidth={1.7} />{t("Отложить")}
                  </button>
                  <button type="button" onClick={() => (onStatistics ?? onOpen)(channel)} aria-label={t("Статистика")} title={t("Статистика")} className="grid size-9 shrink-0 place-items-center rounded-full bg-surface/60 text-muted transition hover:bg-accent/10 hover:text-accent">
                    <ChartNoAxesColumn size={14} strokeWidth={1.7} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel mt-4 grid min-h-[280px] place-items-center rounded-[26px] px-4 py-6 text-center">
          <div className="max-w-xs">
            <span className="mx-auto grid size-14 place-items-center rounded-[20px] bg-accent/10 text-accent"><Radio size={22} strokeWidth={1.5} /></span>
            <h2 className="mt-4 text-base font-semibold text-ink">{loading ? t("Загружаем каналы…") : query ? t("Совпадений нет") : t("Каналов пока нет")}</h2>
            {!loading && !error && !query && <p className="mt-2 text-sm leading-6 text-muted">{t(listView === "mine" ? "Здесь появятся публичные каналы, которыми вы управляете." : "Здесь появятся каналы, где у аккаунта есть права администратора.")}</p>}
          </div>
        </div>
      )}
      <Fab onClick={() => setSheetOpen(true)} label={t("Создать", "Create")} />

      {sheetOpen && (
        <div role="dialog" aria-modal="true" aria-label={t("Создать")} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-md sm:items-center" onClick={() => setSheetOpen(false)}>
          <div className="glass-modal w-full max-w-md p-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">{t("Создать")}</h2>
                <p className="mt-1 text-[11px] leading-4 text-muted">{channels[0]?.title ?? t("Сначала добавьте канал", "Add a channel first")}</p>
              </div>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label={t("Закрыть")} className="grid size-8 shrink-0 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink">
                <X size={14} />
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              <button type="button" disabled={!channels.length} onClick={() => { setSheetOpen(false); if (channels[0]) onPublish?.(channels[0]); }} className="flex items-center gap-3 rounded-[18px] bg-surface/60 p-3 text-left transition hover:bg-accent/10 disabled:opacity-50">
                <span className="grid size-9 place-items-center rounded-[12px] bg-accent/15 text-accent"><Send size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{t("Написать пост")}</span>
                  <span className="block text-[11px] text-muted">{t("Откроет редактор канала", "Opens the channel editor")}</span>
                </span>
              </button>
              <button type="button" disabled={!channels.length} onClick={() => { setSheetOpen(false); setStudioSection("widgets"); setStudioOpen(true); }} className="flex items-center gap-3 rounded-[18px] bg-surface/60 p-3 text-left transition hover:bg-accent/10 disabled:opacity-50">
                <span className="grid size-9 place-items-center rounded-[12px] bg-accent/15 text-accent"><Gamepad2 size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{t("Создать виджет")}</span>
                  <span className="block text-[11px] text-muted">{t("Галерея HTML-игр и опросов", "HTML games and polls gallery")}</span>
                </span>
              </button>
              <button type="button" disabled={!channels.length} onClick={() => { setSheetOpen(false); setStudioSection("stickers"); setStudioOpen(true); }} className="flex items-center gap-3 rounded-[18px] bg-surface/60 p-3 text-left transition hover:bg-accent/10 disabled:opacity-50">
                <span className="grid size-9 place-items-center rounded-[12px] bg-accent/15 text-accent"><Sticker size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{t("Создать стикерпак")}</span>
                  <span className="block text-[11px] text-muted">{t("Стикер-студия канала", "Channel sticker studio")}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {channels[0] && (
        <StudioModal
          open={studioOpen}
          onClose={() => setStudioOpen(false)}
          channelId={channels[0].id}
          channelTitle={channels[0].title}
          initialSection={studioSection}
        />
      )}
    </section>
  );
}

function Metric({ label, value, hint, icon, tone = "muted" }: { label: string; value: string; hint: string; icon?: ReactNode; tone?: "muted" | "accent" }) {
  return (
    <div className="rounded-[20px] bg-surface/40 px-3 py-2.5">
      <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{icon}{label}</p>
      <p className={`mt-1.5 font-mono text-[22px] font-medium leading-none tabular-nums ${tone === "accent" ? "text-accent" : "text-ink"}`}>{value}</p>
      <p className="mt-1 truncate text-[10px] text-muted">{hint}</p>
    </div>
  );
}

function ChannelStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] tabular-nums text-muted">
      <span className="text-accent/80">{icon}</span>
      <span className="truncate"><span className="text-ink">{value}</span> <span className="text-[10px]">{label}</span></span>
    </span>
  );
}


