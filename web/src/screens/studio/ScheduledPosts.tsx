import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, LoaderCircle, RefreshCw } from "lucide-react";
import { api, type MessageRecord } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ScheduledPosts({ channelId }: { channelId: number }) {
  const { t, locale } = useI18n();
  const [posts, setPosts] = useState<MessageRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.editor.scheduled(channelId)
      .then((items) => { if (active) setPosts(items); })
      .catch((cause: unknown) => { if (active) setError(t(cause instanceof Error ? cause.message : "Не удалось загрузить расписание", "Could not load the schedule")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [channelId, reloadKey]);

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" }),
    [locale],
  );
  const monthFormat = useMemo(
    () => new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", { month: "long", year: "numeric" }),
    [locale],
  );
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "long", weekday: "short" }),
    [locale],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, MessageRecord[]>();
    for (const post of posts ?? []) {
      if (!post.date) continue;
      const key = dayKey(new Date(post.date));
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [posts]);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const list: (Date | null)[] = Array.from({ length: offset }, () => null);
    for (let day = 1; day <= total; day += 1) list.push(new Date(month.getFullYear(), month.getMonth(), day));
    return list;
  }, [month]);

  const weekdays = locale === "ru" ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const todayKey = dayKey(new Date());
  const selectedPosts = selected ? byDay.get(selected) ?? [] : posts ?? [];
  const selectedLabel = selected
    ? dayFormat.format(new Date(`${selected}T12:00:00`))
    : t("Все запланированные", "All scheduled");

  return (
    <div className="glass-panel rounded-[26px] p-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-ink">{monthFormat.format(month)}</p>
        <span className="rounded-full bg-surface/60 px-2 py-0.5 font-mono text-[10px] text-muted">{(posts ?? []).length}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label={t("Предыдущий месяц", "Previous month")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-accent">
            <ChevronLeft size={15} />
          </button>
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label={t("Следующий месяц", "Next month")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-accent">
            <ChevronRight size={15} />
          </button>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading} aria-label={t("Обновить расписание", "Reload schedule")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-accent disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {weekdays.map((day) => <span key={day} className="py-1 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-muted">{day}</span>)}
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} aria-hidden="true" />;
          const key = dayKey(date);
          const count = byDay.get(key)?.length ?? 0;
          const isSelected = selected === key;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${dayFormat.format(date)}${count ? `, ${count}` : ""}`}
              onClick={() => setSelected(isSelected ? null : key)}
              className={`relative aspect-square rounded-[14px] text-xs font-medium transition ${isSelected
                ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_25%,transparent)]"
                : count
                  ? "bg-surface/60 text-ink hover:bg-accent/10 hover:text-accent"
                  : "text-muted hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink"}`}
            >
              <span className={isToday ? "underline decoration-accent decoration-2 underline-offset-2" : ""}>{date.getDate()}</span>
              {count > 0 && <span className="absolute inset-x-0 bottom-1 mx-auto size-1 rounded-full bg-accent shadow-[0_0_6px_var(--accent)]" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {error && <p role="alert" className="mt-3 rounded-[18px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink">{selectedLabel}</p>
          {selected && <button type="button" onClick={() => setSelected(null)} className="rounded-full bg-surface/60 px-2.5 py-1 text-[10px] text-muted transition hover:text-ink">{t("Сбросить", "Reset")}</button>}
        </div>
        {loading && !posts && <div className="grid min-h-[80px] place-items-center text-muted"><LoaderCircle size={16} className="animate-spin" /></div>}
        {!loading && !selectedPosts.length && (
          <p className="rounded-[18px] bg-surface/40 px-3 py-4 text-center text-xs text-muted">{t("На этот день ничего не запланировано", "Nothing scheduled for this day")}</p>
        )}
        {selectedPosts.map((post) => (
          <article key={post.id} className="flex items-start gap-3 rounded-[18px] bg-surface/40 px-3 py-2.5">
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
              <Clock size={10} />{post.date ? timeFormat.format(new Date(post.date)) : "—"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 block text-xs leading-5 text-ink">{post.text || t("Без текста", "No text")}</span>
              {post.media_type && <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.1em] text-muted">{post.media_type}</span>}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}
