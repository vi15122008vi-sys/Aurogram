import { useEffect, useState } from "react";
import { ArrowLeft, ChartNoAxesColumn, MessageSquareText, Radio, Settings2, Users, Wrench } from "lucide-react";
import { api, type ChannelDetails, type ChannelRecord } from "../lib/api";
import { StudioModal } from "../components/StudioModal";
import { MessageList } from "./MessageList";
import { PostEditor } from "./PostEditor";
import { useI18n } from "../lib/i18n";

type ChannelTab = "posts" | "stats" | "settings";

interface ChannelDetailProps {
  channel: ChannelRecord;
  onBack: () => void;
  initialTab?: "posts" | "studio" | "stats";
  /** Открыть редактор сразу в режиме «Отложить» (кнопка из списка каналов). */
  initialSchedule?: boolean;
}

const tabs: { id: ChannelTab; label: string; icon: typeof Radio }[] = [
  { id: "posts", label: "Посты", icon: MessageSquareText },
  { id: "stats", label: "Статистика", icon: ChartNoAxesColumn },
  { id: "settings", label: "Настройки", icon: Settings2 },
];

export function ChannelDetail({ channel, onBack, initialTab = "posts", initialSchedule = false }: ChannelDetailProps) {
  const { t, locale } = useI18n();
  // «Студия» больше не вкладка — из неё ведёт кнопка в шапке.
  const [active, setActive] = useState<ChannelTab>(initialTab === "studio" ? "posts" : initialTab);
  const [details, setDetails] = useState<ChannelDetails | null>(null);
  const [metrics, setMetrics] = useState<{ deleted: number; mutes: number; bans: number } | null>(null);
  const [postsReloadKey, setPostsReloadKey] = useState(0);
  const [studioOpen, setStudioOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activeRequest = true;
    api.channels.get(channel.id)
      .then((result) => { if (activeRequest) setDetails(result); })
      .catch((cause: unknown) => { if (activeRequest) setError(t(cause instanceof Error ? cause.message : "Не удалось загрузить канал")); });
    return () => { activeRequest = false; };
  }, [channel.id]);

  useEffect(() => {
    if (active !== "stats") return;
    let activeRequest = true;
    api.channels.antispam.metrics(channel.id)
      .then((result) => { if (activeRequest) setMetrics(result); })
      .catch((cause: unknown) => {
        if (!activeRequest) return;
        setMetrics(null);
        setError(t(cause instanceof Error ? cause.message : "Не удалось загрузить статистику"));
      });
    return () => { activeRequest = false; };
  }, [active, channel.id]);

  const title = details?.title ?? channel.title;
  const username = details?.username ?? channel.username;
  const subscribers = details?.subscribers ?? channel.subscribers;
  return (
    <section className="animate-[rise-in_240ms_ease-out]">
      <button type="button" onClick={onBack} className="mb-4 inline-flex h-8 items-center gap-2 rounded-lg px-2 text-xs font-medium text-muted hover:bg-surface hover:text-ink"><ArrowLeft size={15} />{t("Каналы")}</button>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Radio size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t("CHANNEL")} / {channel.id}</p>
          <h1 className="mt-1 truncate text-[25px] font-semibold">{title}</h1>
          <p className="mt-1 truncate text-sm text-muted">{username ? `@${username}` : t("Канал")}</p>
        </div>
        <button
          type="button"
          onClick={() => setStudioOpen(true)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent/10 px-3 text-xs font-medium text-accent transition hover:bg-accent/20"
        >
          <Wrench size={14} />{t("Студия")}
        </button>
        <span className="hidden items-center gap-1.5 rounded-lg bg-surface/60 px-3 py-2 font-mono text-xs text-muted sm:inline-flex"><Users size={14} />{subscribers.toLocaleString("ru-RU")}</span>
      </div>

      <div role="tablist" aria-label={t("Раздел канала")} className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => setActive(id)} className={`inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-medium transition ${active === id ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>
            <Icon size={15} strokeWidth={1.7} />{t(label)}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="mt-5">
        {active === "posts" && <div className="space-y-5"><PostEditor channelId={channel.id} focusSchedule={initialSchedule} onPublished={() => setPostsReloadKey((key) => key + 1)} /><div><h2 className="mb-3 text-sm font-semibold">{t("Последние публикации")}</h2><MessageList key={`${channel.id}:${postsReloadKey}`} chatId={channel.id} pageSize={20} /></div></div>}
        {active === "stats" && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={t("Подписчики")} value={subscribers.toLocaleString(locale === "ru" ? "ru-RU" : "en-US")} />
          <Stat label={t("Удалено за 24 часа")} value={metrics?.deleted.toLocaleString(locale === "ru" ? "ru-RU" : "en-US") ?? "—"} />
          <Stat label={t("Муты / баны")} value={metrics ? `${metrics.mutes} / ${metrics.bans}` : "—"} />
          <Stat label={t("Чат обсуждений")} value={details?.linked_chat_id ? t("Привязан") : t("Не привязан")} />
        </div>}
        {active === "settings" && <dl className="max-w-3xl divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          <Info label={t("Название")} value={title} />
          <Info label="Username" value={username ? `@${username}` : t("Не задан")} />
          <Info label={t("Описание")} value={details?.about || t("Нет описания")} />
          <Info label={t("Чат обсуждений")} value={details?.linked_chat_id ? String(details.linked_chat_id) : t("Не привязан")} mono />
        </dl>}
      </div>
      <StudioModal open={studioOpen} onClose={() => setStudioOpen(false)} channelId={channel.id} channelTitle={title} />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-surface p-3"><p className="text-xs text-muted">{label}</p><p className="mt-2 font-mono text-xl font-medium tabular-nums">{value}</p></div>;
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="grid gap-1 px-3 py-3 sm:grid-cols-[160px_1fr] sm:items-center"><dt className="text-xs text-muted">{label}</dt><dd className={`break-words text-sm ${mono ? "font-mono" : ""}`}>{value}</dd></div>;
}
