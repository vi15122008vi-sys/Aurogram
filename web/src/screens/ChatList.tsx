import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Archive, ArchiveRestore, Check, FolderPlus, MessageCircle, MoreHorizontal, Phone, Search, X } from "lucide-react";
import { api, chatAvatarUrl, storyAvatarUrl, type ChatFolder, type ChatRecord, type GlobalSearchResult, type StoryPeer } from "../lib/api";
import { Avatar } from "../components/Avatar";
import { Fab } from "../components/Fab";
import { StoryViewer } from "../components/StoryViewer";
import { OfflineBanner } from "../components/OfflineBanner";
import { Skeleton } from "../components/Skeleton";
import { openCall } from "../lib/callbus";
import { useI18n } from "../lib/i18n";

export type ChatFilter = "all" | "user" | "group" | "channel" | "archive";

interface ChatListProps {
  chats: ChatRecord[];
  filter: ChatFilter;
  archivingId?: number | null;
  loading?: boolean;
  error?: string | null;
  /** Данные пришли из локального кэша: сети нет. */
  offline?: boolean;
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

const chatTypeLabel = ({ user: "Личный чат", group: "Группа", channel: "Канал", bot: "Бот" } as const);

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

/* Разделитель строк — волосяная линия вместо border у ячейки. */
const rowDivider = "after:pointer-events-none after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] after:content-[''] last:after:hidden";

export function ChatList({ chats, filter, archivingId, loading = false, error, offline = false, onFilterChange, onOpen, onArchive }: ChatListProps) {
  const { t, locale } = useI18n();
  const [menuChatId, setMenuChatId] = useState<number | null>(null);
  const [stories, setStories] = useState<StoryPeer[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    api.chats.stories().then((items) => { if (active) setStories(items); }).catch(() => { if (active) setStories([]); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    api.chats.folders().then((items) => { if (active) setFolders(items); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    let active = true;
    setSearchResults(null);
    setSearching(true);
    const timer = window.setTimeout(() => {
      api.chats.search(term)
        .then((result) => { if (active) setSearchResults(result); })
        .catch(() => { if (active) setSearchResults({ chats: [], messages: [] }); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);
  const visibleChats = useMemo(() => {
    const subset = selectedFolderId === null
      ? chats
      : chats.filter((chat) => folders.find((folder) => folder.id === selectedFolderId)?.chat_ids.includes(chat.id));
    return filter === "all" || filter === "archive" ? subset : subset.filter((chat) => chat.type === filter);
  }, [chats, filter, folders, selectedFolderId]);

  /* Локальный поиск: имя, username и текст последнего сообщения из кэша. */
  const localChats = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return visibleChats;
    return visibleChats.filter((chat) =>
      `${chat.title} ${chat.username ?? ""} ${chat.last_message ?? ""}`.toLocaleLowerCase().includes(term),
    );
  }, [visibleChats, query]);

  /* Личные диалоги идём отдельной группой сверху, остальное — ниже. */
  const orderedChats = useMemo(() => {
    if (filter !== "all") return localChats;
    return [...localChats].sort((a, b) => Number(b.type === "user") - Number(a.type === "user"));
  }, [localChats, filter]);

  async function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    setFolderError(null);
    try {
      const folder = await api.chats.createFolder(name);
      setFolders((current) => [...current, folder]);
      setSelectedFolderId(folder.id);
      setFolderName("");
      setCreatingFolder(false);
    } catch (cause) {
      setFolderError(t(cause instanceof Error ? cause.message : "Не удалось создать папку"));
    }
  }

  async function assignFolder(chat: ChatRecord, folderId: number | null) {
    setFolderError(null);
    try {
      await api.chats.assignFolder(chat.id, folderId);
      setFolders((current) => current.map((folder) => ({
        ...folder,
        chat_ids: folder.id === folderId
          ? [...new Set([...folder.chat_ids, chat.id])]
          : folder.chat_ids.filter((id) => id !== chat.id),
      })));
      setMenuChatId(null);
    } catch (cause) {
      setFolderError(t(cause instanceof Error ? cause.message : "Не удалось переместить чат"));
    }
  }

  return (
    <section className="animate-[rise-in_240ms_ease-out]">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t("INBOX")}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink">{t("Чаты")}</h1>
        <span className="rounded-full bg-surface/60 px-2.5 py-1 font-mono text-[10px] tabular-nums text-muted">
          {localChats.length}{query.trim() ? ` / ${visibleChats.length}` : ""}
        </span>
      </div>
      {offline && <OfflineBanner className="mt-3" />}

      <label className="glass-panel mt-4 flex h-11 items-center gap-2 rounded-[22px] px-3.5 text-muted focus-within:text-accent">
        <Search size={16} />
        <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Поиск чатов и сообщений")} aria-label={t("Поиск чатов и сообщений")} className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
      </label>

      <div className="mt-5" aria-label={t("Истории")}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-ink">{t("Истории")}</h2>
          {stories.length > 0 && <span className="font-mono text-[10px] text-muted">{stories.length}</span>}
        </div>
        <div className="flex min-h-[76px] gap-3 overflow-x-auto pb-1">
          {stories.length ? stories.map((story, index) => (
            <button
              key={story.peer_id}
              type="button"
              onClick={() => setStoryIndex(index)}
              aria-label={`${story.title} — ${t("открыть историю", "open story")}`}
              className="flex w-[58px] shrink-0 flex-col items-center gap-1.5 rounded-[16px] p-0.5 transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
            >
              <span className={`size-[54px] rounded-full p-[2px] ${story.unread ? "bg-gradient-to-br from-fuchsia-500 via-accent to-amber-400" : "bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"}`}>
                <Avatar name={story.title} id={story.peer_id} src={storyAvatarUrl(story.peer_id)} className="size-full" />
              </span>
              <span className="w-full truncate text-center text-[10px] text-muted">{story.title}</span>
            </button>
          )) : <p className="flex items-center text-xs text-muted">{t("Новых историй пока нет")}</p>}
        </div>
      </div>

      {query.trim().length >= 2 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-ink">{t("Глобальный поиск", "Global search")}</h2>
            <span className="ml-auto text-[10px] text-muted">{t("по кэшу аккаунта", "in the account cache")}</span>
          </div>
          {searching && <p className="text-xs text-muted">{t("Ищем в кэше…")}</p>}
          {!!searchResults?.chats.length && <section><h2 className="mb-2 text-xs font-semibold text-muted">{t("Чаты")}</h2><div className="glass-panel overflow-hidden rounded-[24px] p-1">{searchResults.chats.map((chat) => <button key={chat.id} type="button" onClick={() => onOpen?.({ ...chat, archived: false, last_message: null })} className={`relative flex w-full items-center gap-3 rounded-[20px] p-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] ${rowDivider}`}><span className="grid size-9 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent">{chat.title.slice(0, 1)}</span><span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{chat.title}</span>{chat.username && <span className="text-xs text-muted">@{chat.username}</span>}</button>)}</div></section>}
          {!!searchResults?.messages.length && <section><h2 className="mb-2 text-xs font-semibold text-muted">{t("Сообщения")}</h2><div className="glass-panel overflow-hidden rounded-[24px] p-1">{searchResults.messages.map((message) => <button key={`${message.chat_id}:${message.message_id}`} type="button" onClick={() => onOpen?.({ id: message.chat_id, title: message.chat_title || String(message.chat_id), type: message.chat_type || "user", archived: false, unread: 0, last_message: message.text, last_message_date: message.date })} className={`relative block w-full rounded-[20px] p-3 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] ${rowDivider}`}><span className="block truncate text-xs font-semibold text-accent">{message.chat_title || t("Чат")}</span><span className="mt-1 block line-clamp-2 text-sm text-ink">{message.text}</span></button>)}</div></section>}
          {!searching && searchResults && !searchResults.chats.length && !searchResults.messages.length && <p className="py-8 text-center text-sm text-muted">{t("Ничего не найдено в кэше")}</p>}
          {!searchResults && !searching && <p className="py-8 text-center text-xs text-muted">{t("Введите не менее двух символов")}</p>}
        </div>
      )}
      <>
      <div role="tablist" aria-label={t("Фильтр чатов")} className="glass-panel mt-5 flex w-full gap-1 overflow-x-auto rounded-[22px] p-1.5">
        {filters.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => { setMenuChatId(null); onFilterChange(id); }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${filter === id ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_16%,transparent)]" : "text-muted hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink"}`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1" aria-label={t("Папки чатов")}>
        <button type="button" aria-pressed={selectedFolderId === null} onClick={() => setSelectedFolderId(null)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${selectedFolderId === null ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_16%,transparent)]" : "bg-surface/50 text-muted hover:text-ink"}`}>{t("Все папки")}</button>
        {folders.map((folder) => <button key={folder.id} type="button" aria-pressed={selectedFolderId === folder.id} onClick={() => setSelectedFolderId(folder.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${selectedFolderId === folder.id ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_16%,transparent)]" : "bg-surface/50 text-muted hover:text-ink"}`}>{folder.name}<span className="ml-1.5 font-mono opacity-70">{folder.chat_ids.length}</span></button>)}
        <button type="button" onClick={() => setCreatingFolder((open) => !open)} className="grid size-8 shrink-0 place-items-center rounded-full bg-surface/50 text-muted transition hover:text-accent" aria-label={t("Создать папку")}><FolderPlus size={15} /></button>
      </div>
      {creatingFolder && <form onSubmit={createFolder} className="mt-2 flex max-w-sm gap-2"><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={32} placeholder={t("Название папки")} className="h-9 min-w-0 flex-1 rounded-[16px] bg-surface/60 px-3 text-xs text-ink outline-none placeholder:text-muted focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]" /><button type="submit" disabled={!folderName.trim()} className="rounded-[16px] bg-accent px-3 text-xs font-medium text-white disabled:opacity-50">{t("Создать")}</button></form>}
      {folderError && <p role="alert" className="mt-2 text-xs text-danger">{folderError}</p>}

      {error && <p role="alert" className="mt-3 rounded-[18px] bg-danger/10 px-3 py-2 text-sm text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_18%,transparent)]">{error}</p>}

      {loading && !visibleChats.length ? (
        <div className="glass-panel mt-3 rounded-[26px] p-1" aria-busy="true" aria-live="polite" aria-label={t("Загружаем чаты", "Loading chats")}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 p-2">
              <Skeleton className="size-12 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      ) : (
      <div className="glass-panel mt-3 overflow-visible rounded-[26px] p-1">
        {orderedChats.map((chat, index) => {
          const previous = orderedChats[index - 1];
          const isDirect = chat.type === "user";
          const sectionLabel = filter === "all"
            ? isDirect && index === 0
              ? t("Личные")
              : !isDirect && (!previous || previous.type === "user")
                ? t("Группы и каналы")
                : null
            : null;
          return (
          <Fragment key={chat.id}>
            {sectionLabel && (
              <div className="flex items-center justify-between px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                <span>{sectionLabel}</span>
                <span>{filter === "all" && isDirect ? orderedChats.filter((item) => item.type === "user").length : null}</span>
              </div>
            )}
          <article className={`group relative flex items-center gap-1 px-0.5 ${rowDivider}`}>
            <button type="button" onClick={() => onOpen?.(chat)} className="glass-hover flex min-w-0 flex-1 items-center gap-3 rounded-[20px] p-2 text-left transition duration-200 hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]">
              <Avatar name={chat.title} id={chat.id} src={chatAvatarUrl(chat.id)} className="size-12 shrink-0 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_8%),0_8px_20px_rgb(0_0_0_/_18%)]" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={`min-w-0 flex-1 truncate text-[14px] ${chat.unread > 0 ? "font-semibold text-ink" : "font-medium text-ink/90"}`}>{chat.title}</span>
                  <time className={`shrink-0 font-mono text-[10px] tabular-nums ${chat.unread > 0 ? "text-accent" : "text-muted"}`}>{chatTime(chat.last_message_date, locale)}</time>
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <span className={`min-w-0 flex-1 truncate text-xs ${chat.unread > 0 ? "text-ink/75" : "text-muted"}`}>{chat.last_message || t(chatTypeLabel[chat.type])}</span>
                  {chat.unread > 0 && (
                    <span className="grid min-w-[20px] shrink-0 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-[0_4px_12px_color-mix(in_srgb,var(--accent)_35%,transparent)]">
                      {chat.unread > 99 ? "99+" : chat.unread}
                    </span>
                  )}
                </span>
              </span>
            </button>

            <div className="relative flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label={t("Позвонить", "Call")}
                title={t("Позвонить", "Call")}
                onClick={() => openCall({ room: `chat:${chat.id}`, title: chat.title })}
                className="grid size-8 place-items-center rounded-full text-muted transition hover:text-success sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
              >
                <Phone size={15} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-label={t("Действия чата")}
                aria-haspopup="menu"
                aria-expanded={menuChatId === chat.id}
                disabled={archivingId === chat.id}
                onClick={() => setMenuChatId((current) => current === chat.id ? null : chat.id)}
                className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
              >
                <MoreHorizontal size={18} />
              </button>
              {menuChatId === chat.id && (
                <div role="menu" className="glass-panel absolute right-0 top-11 z-20 min-w-44 rounded-[22px] p-1.5 shadow-2xl">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={archivingId === chat.id}
                    onClick={() => { setMenuChatId(null); onArchive?.(chat); }}
                    className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left text-xs text-ink transition hover:bg-accent/10 hover:text-accent disabled:opacity-50"
                  >
                    {filter === "archive" ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                    {t(filter === "archive" ? "Убрать из архива" : "В архив")}
                  </button>
                  {folders.length > 0 && <div className="mt-1 pt-1"><div className="glass-divider mx-2" aria-hidden="true" /><p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted">{t("Папка")}</p>{folders.map((folder) => <button key={folder.id} type="button" role="menuitem" onClick={() => void assignFolder(chat, folder.id)} className="flex w-full items-center gap-1.5 rounded-[14px] px-3 py-2 text-left text-xs text-ink hover:bg-accent/10">{folder.chat_ids.includes(chat.id) && <Check size={12} className="shrink-0 text-accent" />}{folder.name}</button>)}{folders.some((folder) => folder.chat_ids.includes(chat.id)) && <button type="button" role="menuitem" onClick={() => void assignFolder(chat, null)} className="flex w-full items-center rounded-[14px] px-3 py-2 text-left text-xs text-muted hover:bg-raised">{t("Убрать из папки")}</button>}</div>}
                </div>
              )}
            </div>
          </article>
          </Fragment>
          );
        })}
        {!localChats.length && <div className="flex min-h-32 items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted">{query.trim() ? t("Локально ничего не нашлось", "Nothing found locally") : t(filter === "archive" ? "Архив пуст" : "Чатов пока нет")}</div>}
      </div>
      )}
      </>
      <Fab
        label={t("Написать сообщение", "Write a message")}
        onClick={() => setComposeOpen(true)}
      />

      {composeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("Новое сообщение", "New message")}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-md sm:items-center"
          onClick={() => setComposeOpen(false)}
        >
          <div className="glass-modal w-full max-w-md p-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">{t("Новое сообщение", "New message")}</h2>
                <p className="mt-1 text-[11px] leading-4 text-muted">{t("Выберите контакт или группу из списка", "Pick a contact or group from the list")}</p>
              </div>
              <button type="button" onClick={() => setComposeOpen(false)} aria-label={t("Закрыть")} className="grid size-8 shrink-0 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink">
                <X size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setComposeOpen(false);
                requestAnimationFrame(() => {
                  searchRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
                  searchRef.current?.focus();
                });
              }}
              className="mt-4 flex w-full items-center gap-3 rounded-[18px] bg-surface/60 p-3 text-left transition hover:bg-accent/10"
            >
              <span className="grid size-9 place-items-center rounded-[12px] bg-accent/15 text-accent"><MessageCircle size={15} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{t("Написать сообщение")}</span>
                <span className="block text-[11px] text-muted">{t("Поиск контактов и чатов", "Search contacts and chats")}</span>
              </span>
            </button>
          </div>
        </div>
      )}
      {storyIndex !== null && stories[storyIndex] && (
        <StoryViewer
          stories={stories}
          index={storyIndex}
          onIndexChange={(next) => setStoryIndex(Math.max(0, Math.min(stories.length - 1, next)))}
          onClose={() => setStoryIndex(null)}
        />
      )}
    </section>
  );
}

