import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, Copy, Gamepad2, Images, Search, Send, Sticker, X } from "lucide-react";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { springModal } from "../lib/motion";
import { escapeHtml, studioWidgets, widgetAccents, widgetCategories, widgetPost, widgetSnippet, type StudioWidget, type WidgetCategory } from "../lib/studioWidgets";
import { MediaLibrary } from "./studio/MediaLibrary";
import { ScheduledPosts } from "./studio/ScheduledPosts";
import { StickerStudio } from "./studio/StickerStudio";

type StudioSection = "widgets" | "stickers" | "media" | "scheduled";

interface ChannelStudioProps {
  channelId: number;
  channelTitle: string;
}

const sections: { id: StudioSection; title: string; titleEn: string; hint: string; hintEn: string; icon: typeof Gamepad2; badge?: string }[] = [
  { id: "widgets", title: "HTML-Виджеты", titleEn: "HTML widgets", hint: "Игры и опросы для постов", hintEn: "Games and polls for posts", icon: Gamepad2, badge: String(studioWidgets.length) },
  { id: "stickers", title: "Стикеры", titleEn: "Stickers", hint: "Генератор и стикерпаки", hintEn: "Generator and packs", icon: Sticker },
  { id: "media", title: "Медиа-библиотека", titleEn: "Media library", hint: "Фото и видео канала", hintEn: "Channel photos and videos", icon: Images },
  { id: "scheduled", title: "Отложенные посты", titleEn: "Scheduled posts", hint: "Календарь публикаций", hintEn: "Publishing calendar", icon: CalendarClock },
];

export function ChannelStudio({ channelId, channelTitle }: ChannelStudioProps) {
  const { t, locale } = useI18n();
  const [section, setSection] = useState<StudioSection>("widgets");
  const [category, setCategory] = useState<WidgetCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<StudioWidget | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [accent, setAccent] = useState(widgetAccents[0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return studioWidgets.filter((widget) => {
      if (category !== "all" && widget.category !== category) return false;
      if (!term) return true;
      return `${widget.name} ${widget.nameEn} ${widget.hint}`.toLocaleLowerCase().includes(term);
    });
  }, [category, query]);

  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  function open(widget: StudioWidget) {
    setActive(widget);
    setTitle(widget.name);
    setText(locale === "ru" ? widget.hint : widget.hintEn);
    setAccent(widgetAccents[0].value);
    setError(null);
    setNotice(null);
  }

  function close() {
    setActive(null);
    setBusy(false);
    setError(null);
  }

  async function send() {
    if (!active || !title.trim() || !text.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.editor.publish(channelId, {
        text: widgetPost(active, title.trim(), text.trim()),
        parse_mode: "html",
        schedule_at: null,
      });
      setNotice(t("Виджет отправлен в канал", "Widget sent to the channel"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось отправить виджет", "Could not send the widget"));
    } finally {
      setBusy(false);
    }
  }

  async function copySnippet() {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(widgetSnippet(active, title.trim() || active.name, text.trim() || active.hint, accent));
      setNotice(t("HTML-код скопирован", "HTML snippet copied"));
    } catch {
      setError(t("Браузер не разрешил доступ к буферу обмена", "Clipboard access was blocked"));
    }
  }

  return (
    <div className="space-y-4">
      {/* Панель инструментов: четыре стеклянные плитки-раздела. */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {sections.map(({ id, title: label, titleEn, hint, hintEn, icon: Icon, badge }) => {
          const selected = section === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => setSection(id)}
              className={`group relative overflow-hidden rounded-[24px] p-3 text-left transition duration-200 ${selected
                ? "bg-accent/10 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_22%,transparent),0_14px_34px_color-mix(in_srgb,var(--accent)_16%,transparent)]"
                : "glass-panel hover:-translate-y-0.5"}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className={`grid size-9 place-items-center rounded-[14px] ${selected ? "bg-accent text-white" : "bg-surface/60 text-muted group-hover:text-accent"}`}>
                  <Icon size={17} strokeWidth={1.7} />
                </span>
                {badge && <span className="rounded-full bg-surface/60 px-2 py-0.5 font-mono text-[10px] text-muted">{badge}</span>}
              </span>
              <span className={`mt-2.5 block truncate text-[13px] font-semibold ${selected ? "text-accent" : "text-ink"}`}>{t(label, titleEn)}</span>
              <span className="mt-0.5 block truncate text-[11px] text-muted">{t(hint, hintEn)}</span>
            </button>
          );
        })}
      </div>

      {section === "widgets" ? (
        <div className="glass-panel rounded-[26px] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label={t("Категории виджетов", "Widget categories")}>
              {widgetCategories.map(({ id, label, labelEn }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={category === id}
                  onClick={() => setCategory(id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${category === id ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_16%,transparent)]" : "text-muted hover:text-ink"}`}
                >
                  {t(label, labelEn)}
                </button>
              ))}
            </div>
            <label className="ml-auto flex h-9 min-w-[10rem] flex-1 items-center gap-2 rounded-full bg-surface/60 px-3 text-muted focus-within:text-accent sm:max-w-xs">
              <Search size={14} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Поиск виджета", "Find a widget")} aria-label={t("Поиск виджета", "Find a widget")} className="h-full min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-muted" />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((widget) => (
              <button
                key={widget.id}
                type="button"
                onClick={() => open(widget)}
                className="group rounded-[20px] bg-surface/40 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-accent/10 hover:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_18%,transparent),0_10px_26px_color-mix(in_srgb,var(--accent)_12%,transparent)]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="grid size-9 place-items-center rounded-[12px] bg-surface/60 text-base">{widget.emoji}</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted opacity-0 transition group-hover:opacity-100">{t("настроить", "set up")}</span>
                </span>
                <span className="mt-2 block truncate text-[13px] font-semibold text-ink">{locale === "ru" ? widget.name : widget.nameEn}</span>
                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted">{locale === "ru" ? widget.hint : widget.hintEn}</span>
              </button>
            ))}
            {!visible.length && <p className="col-span-full py-8 text-center text-xs text-muted">{t("Ничего не найдено", "Nothing found")}</p>}
          </div>
        </div>
      ) : section === "stickers" ? (
        <StickerStudio channelId={channelId} />
      ) : section === "media" ? (
        <MediaLibrary channelId={channelId} />
      ) : (
        <ScheduledPosts channelId={channelId} />
      )}

      <AnimatePresence>
        {active && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={locale === "ru" ? active.name : active.nameEn}
              className="glass-modal w-full max-w-lg overflow-hidden"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={springModal}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start gap-3 p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-[16px] bg-accent/10 text-xl">{active.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t("ВИДЖЕТ", "WIDGET")}</p>
                  <h3 className="mt-1 truncate text-base font-semibold text-ink">{locale === "ru" ? active.name : active.nameEn}</h3>
                  <p className="mt-0.5 truncate text-xs text-muted">{t("канал", "channel")} · {channelTitle}</p>
                </div>
                <button type="button" onClick={close} aria-label={t("Закрыть", "Close")} className="grid size-9 shrink-0 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink">
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-3 px-4 pb-4">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-medium text-muted">{t("Заголовок", "Title")}</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="h-10 w-full rounded-[16px] bg-surface/60 px-3.5 text-sm text-ink outline-none placeholder:text-muted focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-medium text-muted">{t("Текст", "Text")}</span>
                  <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={600} className="w-full resize-none rounded-[16px] bg-surface/60 px-3.5 py-2.5 text-sm leading-5 text-ink outline-none placeholder:text-muted focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]" />
                </label>

                <div>
                  <span className="mb-1.5 block text-[11px] font-medium text-muted">{t("Цвет акцента", "Accent color")}</span>
                  <div className="flex flex-wrap gap-2">
                    {widgetAccents.map(({ id, value }) => (
                      <button
                        key={id}
                        type="button"
                        aria-label={id}
                        aria-pressed={accent === value}
                        onClick={() => setAccent(value)}
                        className="grid size-8 place-items-center rounded-full transition hover:scale-105"
                        style={{ backgroundColor: value, boxShadow: accent === value ? "0 0 0 2px var(--ink) inset" : "none" }}
                      >
                        {accent === value && <Check size={14} className="text-black/70" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Живое превью стеклянной плитки виджета. */}
                <div className="rounded-[20px] border-0 bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] p-3.5">
                  <p className="text-lg leading-none">{active.emoji}</p>
                  <p className="mt-2 text-sm font-semibold" style={{ color: accent }}>{title || active.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{text || active.hint}</p>
                  <span className="mt-2.5 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-white" style={{ backgroundColor: accent }}>{t("Играть", "Play")}</span>
                </div>

                {error && <p role="alert" className="rounded-[16px] bg-danger/10 px-3 py-2 text-xs text-danger">{escapeHtml(error)}</p>}
                {notice && <p role="status" className="rounded-[16px] bg-success/10 px-3 py-2 text-xs text-success">{notice}</p>}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button type="button" onClick={() => void copySnippet()} className="inline-flex h-10 items-center gap-2 rounded-full bg-surface/60 px-3.5 text-xs font-medium text-ink transition hover:text-accent">
                    <Copy size={14} />{t("HTML-код", "HTML code")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={busy || !title.trim() || !text.trim()}
                    className="ml-auto inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 text-xs font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50 sm:flex-none"
                  >
                    <Send size={14} />{busy ? t("Отправляем…", "Sending…") : t("Отправить в канал", "Send to channel")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
