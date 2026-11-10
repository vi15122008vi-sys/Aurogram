import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, LoaderCircle, MessageCircle, MoreHorizontal } from "lucide-react";
import type { ChatRecord } from "../lib/api";
import { useI18n } from "../lib/i18n";

export type ChatFilter = "all" | "user" | "group" | "channel" | "archive";

interface ChatListProps {
  chats: ChatRecord[];
  filter: ChatFilter;
  archivingId?: number | null;
  loading?: boolean;
  error?: string | null;
  onFilterChange: (filter: ChatFilter) => void;
  onOpen?: (chat: ChatRecord) => void;
  onArchive?: (chat: ChatRecord) => void;
}

const filters: { id: ChatFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "user", label: "Личные" },
  { id: "group", label: "Группы" },
  { id: "channel", label: "Каналы" },
  { id: "archive", label: "Архив" },
];

function chatTime(value: string | null | undefined, locale: "ru" | "en"): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", sameDay
    ? { timeStyle: "short" }
    : { month: "short", day: "numeric" }).format(date);
}

export function ChatList({ chats, filter, archivingId, loading = false, error, onFilterChange, onOpen, onArchive }: ChatListProps) {
  const { t, locale } = useI18n();
  const [menuChatId, setMenuChatId] = useState<number | null>(null);
  const visibleChats = useMemo(
    () => filter === "all" || filter === "archive" ? chats : chats.filter((chat) => chat.type === filter),
    [chats, filter],
  );

  return (
    <section className="animate-[rise-in_240ms_ease-out]">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t("INBOX")}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h1 className="text-[28px] font-semibold text-ink">{t("Чаты")}</h1>
        <span className="font-mono text-xs tabular-nums text-muted">{visibleChats.length}</span>
      </div>

      <div role="tablist" aria-label={t("Фильтр чатов")} className="glass-panel mt-5 flex w-full gap-1 overflow-x-auto rounded-xl p-1">
        {filters.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => { setMenuChatId(null); onFilterChange(id); }}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition ${filter === id ? "bg-accent/15 text-accent shadow-[0_0_18px_rgb(99_102_241_/_12%)]" : "text-muted hover:bg-white/[0.04] hover:text-ink"}`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="glass-panel mt-3 overflow-visible rounded-2xl">
        {visibleChats.map((chat) => (
          <article key={chat.id} className="chat-row group relative flex items-center gap-2 border-b border-white/[0.055] px-2.5 py-2 last:border-0 sm:px-3">
            <button type="button" onClick={() => onOpen?.(chat)} className="glass-hover flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left transition duration-200">
              <span className="grid size-11 shrink-0 place-items-center rounded-[14px] border border-white/[0.08] bg-gradient-to-br from-accent/20 to-violet-500/10 text-sm font-semibold text-accent shadow-[inset_0_1px_0_rgb(255_255_255_/_6%)]">
                {chat.title.trim().slice(0, 1).toLocaleUpperCase(locale === "ru" ? "ru-RU" : "en-US") || <MessageCircle size={17} strokeWidth={1.5} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="block truncate text-sm font-semibold text-ink">{chat.title}</span>
                  {chat.unread > 0 && <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent">{chat.unread}</span>}
                </span>
                <span className="mt-1 block truncate text-xs text-muted">{chat.last_message || t(({ user: "Личный чат", group: "Группа", channel: "Канал", bot: "Бот" } as const)[chat.type])}</span>
              </span>
              <time className="shrink-0 font-mono text-[10px] tabular-nums text-muted">{chatTime(chat.last_message_date, locale)}</time>
            </button>

            <div className="relative shrink-0">
              <button
                type="button"
                aria-label={t("Действия чата")}
                aria-haspopup="menu"
                aria-expanded={menuChatId === chat.id}
                disabled={archivingId === chat.id}
                onClick={() => setMenuChatId((current) => current === chat.id ? null : chat.id)}
                className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-white/[0.06] hover:text-ink disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
              >
                <MoreHorizontal size={18} />
              </button>
              {menuChatId === chat.id && (
                <div role="menu" className="glass-panel absolute right-0 top-10 z-20 min-w-44 rounded-xl p-1.5 shadow-2xl">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={archivingId === chat.id}
                    onClick={() => { setMenuChatId(null); onArchive?.(chat); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-ink transition hover:bg-accent/10 hover:text-accent disabled:opacity-50"
                  >
                    {filter === "archive" ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                    {t(filter === "archive" ? "Убрать из архива" : "В архив")}
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
        {!visibleChats.length && <div className="flex min-h-32 items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted">{loading ? <><LoaderCircle size={16} className="animate-spin" />{t("Загружаем…")}</> : t(filter === "archive" ? "Архив пуст" : "Чатов пока нет")}</div>}
      </div>
    </section>
  );
}
