import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, ArchiveRestore, FolderPlus, LoaderCircle, MessageCircle, MoreHorizontal, Search } from "lucide-react";
import { api, storyAvatarUrl, type ChatFolder, type ChatRecord, type GlobalSearchResult, type StoryPeer } from "../lib/api";
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
  const [stories, setStories] = useState<StoryPeer[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
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
        <h1 className="text-[28px] font-semibold text-ink">{t("Чаты")}</h1>
        <span className="font-mono text-xs tabular-nums text-muted">{visibleChats.length}</span>
      </div>

      <label className="glass-panel mt-4 flex h-11 items-center gap-2 rounded-2xl px-3 text-muted">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Поиск чатов и сообщений")} aria-label={t("Поиск чатов и сообщений")} className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
      </label>

      <div className="mt-5" aria-label={t("Истории")}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-ink">{t("Истории")}</h2>
          {stories.length > 0 && <span className="font-mono text-[10px] text-muted">{stories.length}</span>}
        </div>
        <div className="flex min-h-[76px] gap-3 overflow-x-auto pb-1">
          {stories.length ? stories.map((story) => (
            <div key={story.peer_id} className="flex w-[58px] shrink-0 flex-col items-center gap-1.5">
              <span className={`size-[54px] rounded-full p-[2px] ${story.unread ? "bg-gradient-to-br from-fuchsia-500 via-accent to-amber-400" : "bg-line"}`}>
                <span className="relative grid size-full place-items-center overflow-hidden rounded-full border-2 border-canvas bg-raised text-sm font-semibold text-accent">
                  {story.title.trim().slice(0, 1).toLocaleUpperCase(locale === "ru" ? "ru-RU" : "en-US")}
                  <img src={storyAvatarUrl(story.peer_id)} alt="" loading="lazy" className="absolute inset-0 size-full rounded-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                </span>
              </span>
              <span className="w-full truncate text-center text-[10px] text-muted">{story.title}</span>
            </div>
          )) : <p className="flex items-center text-xs text-muted">{t("Новых историй пока нет")}</p>}
        </div>
      </div>

      {query.trim().length >= 2 ? (
        <div className="mt-4 space-y-4">
          {searching && <p className="text-xs text-muted">{t("Ищем в кэше…")}</p>}
          {!!searchResults?.chats.length && <section><h2 className="mb-2 text-xs font-semibold text-muted">{t("Чаты")}</h2><div className="glass-panel overflow-hidden rounded-2xl">{searchResults.chats.map((chat) => <button key={chat.id} type="button" onClick={() => onOpen?.({ ...chat, archived: false, last_message: null })} className="flex w-full items-center gap-3 border-b border-line p-3 text-left last:border-0 hover:bg-raised/60"><span className="grid size-9 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent">{chat.title.slice(0, 1)}</span><span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{chat.title}</span>{chat.username && <span className="text-xs text-muted">@{chat.username}</span>}</button>)}</div></section>}
          {!!searchResults?.messages.length && <section><h2 className="mb-2 text-xs font-semibold text-muted">{t("Сообщения")}</h2><div className="glass-panel overflow-hidden rounded-2xl">{searchResults.messages.map((message) => <button key={`${message.chat_id}:${message.message_id}`} type="button" onClick={() => onOpen?.({ id: message.chat_id, title: message.chat_title || String(message.chat_id), type: message.chat_type || "user", archived: false, unread: 0, last_message: message.text, last_message_date: message.date })} className="block w-full border-b border-line p-3 text-left last:border-0 hover:bg-raised/60"><span className="block truncate text-xs font-semibold text-accent">{message.chat_title || t("Чат")}</span><span className="mt-1 block line-clamp-2 text-sm text-ink">{message.text}</span></button>)}</div></section>}
          {!searching && searchResults && !searchResults.chats.length && !searchResults.messages.length && <p className="py-8 text-center text-sm text-muted">{t("Ничего не найдено в кэше")}</p>}
          {!searchResults && !searching && <p className="py-8 text-center text-xs text-muted">{t("Введите не менее двух символов")}</p>}
        </div>
      ) : <>
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

      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1" aria-label={t("Папки чатов")}>
        <button type="button" aria-pressed={selectedFolderId === null} onClick={() => setSelectedFolderId(null)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${selectedFolderId === null ? "border-accent/30 bg-accent/10 text-accent" : "border-line text-muted hover:text-ink"}`}>{t("Все папки")}</button>
        {folders.map((folder) => <button key={folder.id} type="button" aria-pressed={selectedFolderId === folder.id} onClick={() => setSelectedFolderId(folder.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${selectedFolderId === folder.id ? "border-accent/30 bg-accent/10 text-accent" : "border-line text-muted hover:text-ink"}`}>{folder.name}<span className="ml-1.5 font-mono opacity-70">{folder.chat_ids.length}</span></button>)}
        <button type="button" onClick={() => setCreatingFolder((open) => !open)} className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted hover:border-accent/30 hover:text-accent" aria-label={t("Создать папку")}><FolderPlus size={15} /></button>
      </div>
      {creatingFolder && <form onSubmit={createFolder} className="mt-2 flex max-w-sm gap-2"><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={32} placeholder={t("Название папки")} className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-xs text-ink outline-none focus:border-accent" /><button type="submit" disabled={!folderName.trim()} className="rounded-xl bg-accent px-3 text-xs font-medium text-white disabled:opacity-50">{t("Создать")}</button></form>}
      {folderError && <p role="alert" className="mt-2 text-xs text-danger">{folderError}</p>}

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
                  {folders.length > 0 && <div className="mt-1 border-t border-line pt-1"><p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted">{t("Папка")}</p>{folders.map((folder) => <button key={folder.id} type="button" role="menuitem" onClick={() => void assignFolder(chat, folder.id)} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs text-ink hover:bg-accent/10">{folder.chat_ids.includes(chat.id) ? "✓ " : "  "}{folder.name}</button>)}{folders.some((folder) => folder.chat_ids.includes(chat.id)) && <button type="button" role="menuitem" onClick={() => void assignFolder(chat, null)} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs text-muted hover:bg-raised">{t("Убрать из папки")}</button>}</div>}
                </div>
              )}
            </div>
          </article>
        ))}
        {!visibleChats.length && <div className="flex min-h-32 items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted">{loading ? <><LoaderCircle size={16} className="animate-spin" />{t("Загружаем…")}</> : t(filter === "archive" ? "Архив пуст" : "Чатов пока нет")}</div>}
      </div>
      </>}
    </section>
  );
}
