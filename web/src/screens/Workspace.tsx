import { useEffect, useState } from "react";
import { ArrowLeft, Bot, MessageCircle, Radio, RefreshCw } from "lucide-react";
import { api, type AuthAccount, type BotRecord, type ChatRecord } from "../lib/api";
import type { AppTab } from "../components/BottomNav";
import { Channels } from "./Channels";
import { ChannelDetail } from "./ChannelDetail";
import { MessageList } from "./MessageList";
import { ProfileScreen } from "./ProfileScreen";
import { Settings } from "./Settings";
import { ChatList, type ChatFilter } from "./ChatList";
import { isOfflineError, readCache, writeCache } from "../lib/offline";
import { useI18n } from "../lib/i18n";

interface WorkspaceProps {
  tab: AppTab;
  account: AuthAccount;
  onLogout: () => void;
}

type Row = BotRecord | ChatRecord;

const tabContent = {
  channels: { title: "Студия", kicker: "STUDIO", icon: Radio, empty: "Каналов пока нет", hint: "Здесь появятся каналы, где у аккаунта есть права администратора." },
  bots: { title: "Боты", kicker: "AUTOMATION", icon: Bot, empty: "Боты не подключены", hint: "Подключённые боты и состояние webhook будут отображаться здесь." },
  chats: { title: "Чаты", kicker: "INBOX", icon: MessageCircle, empty: "Чатов пока нет", hint: "Диалоги аккаунта появятся здесь после синхронизации." },
} as const;

function itemTitle(item: Row): string {
  if ("title" in item) return item.title;
  return item.name || `@${item.username}`;
}

function itemMeta(item: Row, tab: AppTab): string {
  if (tab === "bots" && "webhook_set" in item) return item.webhook_set ? "Webhook настроен" : "Webhook не настроен";
  if (tab === "chats" && "type" in item) return item.type;
  return "";
}

export function Workspace({ tab, account, onLogout }: WorkspaceProps) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<{ id: number; title: string; username: string | null; subscribers: number; posts_count: number } | null>(null);
  const [selectedChannelTab, setSelectedChannelTab] = useState<"posts" | "stats">("posts");
  const [selectedChat, setSelectedChat] = useState<ChatRecord | null>(null);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [scheduleFocus, setScheduleFocus] = useState(false);
  const [chatFilter, setChatFilter] = useState<ChatFilter>("all");
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const chatMode = tab === "chats" && chatFilter === "archive" ? "archive" : "active";

  useEffect(() => {
    setSelectedChannel(null);
    setSelectedChannelTab("posts");
    setSelectedChat(null);
    setScheduleFocus(false);
  }, [tab]);

  useEffect(() => {
    if (tab === "settings" || tab === "channels") return;
    let active = true;
    setLoading(true);
    setError(null);
    setOffline(false);
    const cacheKey = tab === "bots" ? "bots" : `chats:${chatMode}`;
    const load = tab === "bots" ? api.bots.list() : api.chats.list(chatMode === "archive");
    load
      .then((items) => {
        if (!active) return;
        setRows(items);
        writeCache(cacheKey, items);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        // Нет сети — показываем последний удачный ответ и баннер «Показан кэш».
        if (isOfflineError(cause)) {
          const cached = readCache<Row[]>(cacheKey);
          if (cached?.length) {
            setRows(cached);
            setOffline(true);
            return;
          }
        }
        setError(t(cause instanceof Error ? cause.message : "Не удалось загрузить данные"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, reloadKey, chatMode]);

  async function toggleChatArchive(chat: ChatRecord) {
    setArchivingId(chat.id);
    setError(null);
    try {
      await api.chats.archive(chat.id, chatFilter !== "archive");
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : "Не удалось архивировать чат"));
    } finally {
      setArchivingId(null);
    }
  }

  if (tab === "channels") {
    return selectedChannel
      ? <ChannelDetail channel={selectedChannel} initialTab={selectedChannelTab} initialSchedule={scheduleFocus} onBack={() => { setSelectedChannel(null); setScheduleFocus(false); }} />
      : <Channels
          onOpen={(channel) => { setSelectedChannel(channel); setSelectedChannelTab("posts"); setScheduleFocus(false); }}
          onPublish={(channel) => { setSelectedChannel(channel); setSelectedChannelTab("posts"); setScheduleFocus(false); }}
          onSchedule={(channel) => { setSelectedChannel(channel); setSelectedChannelTab("posts"); setScheduleFocus(true); }}
          onStatistics={(channel) => { setSelectedChannel(channel); setSelectedChannelTab("stats"); setScheduleFocus(false); }}
        />;
  }

  if (tab === "settings") {
    if (profileSettingsOpen) {
      return (
        <section className="animate-[rise-in_240ms_ease-out]">
          <button
            type="button"
            onClick={() => setProfileSettingsOpen(false)}
            className="mb-4 inline-flex h-8 items-center gap-2 rounded-lg px-2 text-xs font-medium text-muted hover:bg-surface hover:text-ink"
          >
            ‹ {t("Профиль")}
          </button>
          <Settings accountName={account.name || account.phone} phone={account.phone} onLogout={onLogout} />
        </section>
      );
    }
    return <ProfileScreen account={account} onLogout={onLogout} onOpenSettings={() => setProfileSettingsOpen(true)} />;
  }

  if (tab === "chats" || (tab === "bots" && selectedChat)) {
    if (selectedChat) {
      return (
        <section className="animate-[rise-in_240ms_ease-out]">
          <button type="button" onClick={() => setSelectedChat(null)} className="mb-4 inline-flex h-8 items-center gap-2 rounded-full px-2 text-xs font-medium text-muted hover:text-ink"><ArrowLeft size={15} />{t(tab === "bots" ? "Боты" : "Чаты")}</button>
          <div className="mb-4"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t(tab === "bots" ? "AUTOMATION" : "INBOX")} / {t(({ user: "Личный чат", group: "Группа", channel: "Канал", bot: "Бот" } as const)[selectedChat.type])}</p><h1 className="mt-1 text-[25px] font-semibold">{selectedChat.title}</h1></div>
          <MessageList chatId={selectedChat.id} allowSend />
        </section>
      );
    }
    return <ChatList chats={rows as ChatRecord[]} filter={chatFilter} onFilterChange={setChatFilter} onOpen={setSelectedChat} onArchive={(chat) => void toggleChatArchive(chat)} archivingId={archivingId} loading={loading} error={error} offline={offline} />;
  }

  const content = tabContent[tab];
  const Icon = content.icon;
  return (
    <section className="animate-[rise-in_240ms_ease-out]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t(content.kicker)}</p>
          <h1 className="mt-2 text-[28px] font-semibold">{t(content.title)}</h1>
        </div>
        <button
          type="button"
          className="grid size-9 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:bg-raised hover:text-ink disabled:opacity-50"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
          aria-label={t("Обновить список")}
          title={t("Обновить")}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {error && <p role="alert" className="mt-5 rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {rows.length ? (
        <div className="glass-panel mt-6 divide-y divide-line overflow-hidden rounded-2xl">
          {rows.map((item) => {
            const content = <>
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-raised text-muted"><Icon size={18} strokeWidth={1.7} /></span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold">{itemTitle(item)}</span>
                <span className="mt-1 block truncate text-xs text-muted">{"last_message" in item && item.last_message ? item.last_message : t(itemMeta(item, tab))}</span>
              </span>
              {"unread" in item && item.unread > 0 && <span className="rounded-lg bg-accent/10 px-2 py-1 font-mono text-xs text-accent">{item.unread}</span>}
            </>;
            const openBot = tab === "bots"
              ? () => setSelectedChat({ id: item.id, title: itemTitle(item), username: "username" in item ? item.username : null, type: "bot" as const, unread: 0, last_message: null, last_message_date: null })
              : null;
            return openBot
              ? <button key={item.id} type="button" onClick={openBot} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]">{content}</button>
              : <article key={item.id} className="glass-hover flex items-center gap-3 p-3">{content}</article>;
          })}
        </div>
      ) : (
        <div className="mt-6 grid min-h-[280px] place-items-center rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center">
          <div className="max-w-xs">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-raised text-muted"><Icon size={21} strokeWidth={1.5} /></span>
            <h2 className="mt-4 text-base font-semibold">{loading ? t("Загружаем…") : t(content.empty)}</h2>
            {!loading && <p className="mt-2 text-sm leading-6 text-muted">{t(content.hint)}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
