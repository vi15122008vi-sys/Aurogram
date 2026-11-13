import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { api, type MessageRecord } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

interface CalendarPanelProps {
  channelId: number;
}

function isoDay(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

/** Календарь месяца: отложенные посты по дням + перенос даты по клику. */
export function CalendarPanel({ channelId }: CalendarPanelProps) {
  const { t, locale } = useI18n();
  const [posts, setPosts] = useState<MessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setPosts(await api.editor.scheduled(channelId));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось загрузить расписание"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [channelId]);

  const byDay = useMemo(() => {
    const map = new Map<string, MessageRecord[]>();
    for (const post of posts) {
      const key = isoDay(post.date);
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [posts]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    const shift = (first.getUTCDay() + 6) % 7; // неделя с понедельника
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() - shift);
    return Array.from({ length: 42 }).map((_, index) => {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + index);
      return day;
    });
  }, [month]);

  const monthLabel = month.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  async function saveDate() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await api.channels.movePost(channelId, editing.id, new Date(editing.value).toISOString());
      setEditing(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось перенести пост"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass-panel rounded-[26px] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-[12px] bg-accent/10 text-accent"><CalendarClock size={16} /></span>
          <div>
            <h2 className="text-sm font-semibold text-ink">{t("Календарь")}</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{monthLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))} aria-label={t("Предыдущий месяц")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink"><ChevronLeft size={15} /></button>
          <button type="button" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))} aria-label={t("Следующий месяц")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink"><ChevronRight size={15} /></button>
        </div>
      </div>

      {loading && <p className="mt-3 flex items-center gap-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" />{t("Загружаем расписание…")}</p>}
      {error && <p role="alert" className="mt-3 rounded-[14px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

      <div className="mt-3 grid grid-cols-7 gap-1 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
        {[t("Пн"), t("Вт"), t("Ср"), t("Чт"), t("Пт"), t("Сб"), t("Вс")].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const inMonth = day.getUTCMonth() === month.getUTCMonth();
          const items = byDay.get(key) ?? [];
          return (
            <div key={key} className={`min-h-[64px] rounded-[10px] p-1 text-left ${inMonth ? "bg-surface/40" : "bg-surface/10 opacity-50"}`}>
              <span className="font-mono text-[10px] text-muted">{day.getUTCDate()}</span>
              <div className="mt-1 grid gap-0.5">
                {items.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setEditing({ id: post.id, value: new Date(post.date).toISOString().slice(0, 16) })}
                    className="w-full truncate rounded-[6px] bg-accent/15 px-1 py-0.5 text-left text-[9px] text-accent"
                    title={post.text || `#${post.id}`}
                  >
                    {new Date(post.date).toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" })} · {(post.text || `#${post.id}`).slice(0, 18)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[16px] bg-surface/60 p-3">
          <label className="grid gap-1 text-[10px] text-muted">
            {t("Новая дата")}
            <input
              type="datetime-local"
              value={editing.value}
              onChange={(event) => setEditing({ ...editing, value: event.target.value })}
              className="h-9 rounded-[10px] bg-surface/70 px-2 font-mono text-xs text-ink outline-none"
            />
          </label>
          <button type="button" onClick={() => void saveDate()} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-accent px-3.5 text-[11px] font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}{t("Перенести")}
          </button>
          <button type="button" onClick={() => setEditing(null)} className="inline-flex h-9 items-center rounded-[10px] bg-surface/60 px-3 text-[11px] text-muted">{t("Отмена")}</button>
        </div>
      )}

      <p className="mt-2 text-[10px] leading-4 text-muted">
        {t("Показаны отложенные посты канала. Клик по посту — перенос даты (Telegram пересоздаёт расписание).", "Scheduled posts of the channel. Click a post to move its date (Telegram re-schedules it).")}
      </p>
    </section>
  );
}
