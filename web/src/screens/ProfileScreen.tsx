import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot, CalendarDays, Download, Loader2, LogOut, MessageSquare, Pencil, Radio, Send, Sparkles, Users, X,
} from "lucide-react";
import { api, storyAvatarUrl, type AiAnswer, type AuthAccount, type ChannelRecord, type MyProfile, type StoryPeer } from "../lib/api";
import { springModal } from "../lib/motion";
import { useI18n } from "../lib/i18n";

interface ProfileScreenProps {
  account: AuthAccount;
  onLogout: () => void;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Профиль как в Telegram: шапка, закреплённые истории, канал, активность и AI. */
export function ProfileScreen({ account, onLogout }: ProfileScreenProps) {
  const { t } = useI18n();
  const [me, setMe] = useState<MyProfile | null>(null);
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [stories, setStories] = useState<StoryPeer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [birthday, setBirthday] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<AiAnswer | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.users.me(), api.channels.list().catch(() => []), api.chats.stories().catch(() => [])])
      .then(([profile, channelList, storyList]) => {
        if (!active) return;
        setMe(profile);
        setChannels(channelList);
        setStories(storyList);
        setName(profile.profile.display_name ?? profile.account.name ?? "");
        setBio(profile.profile.bio ?? "");
        setBirthday(profile.profile.birthday ?? "");
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : t("Не удалось загрузить профиль"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const pinnedIds = me?.profile.pinned_story_ids ?? [];
  const pinnedStories = useMemo(
    () => pinnedIds.map((id) => stories.find((story) => story.peer_id === id)).filter((story): story is StoryPeer => Boolean(story)),
    [pinnedIds, stories],
  );
  const myChannel = channels.find((channel) => channel.id === me?.profile.channel_id) ?? null;

  async function patch(payload: Parameters<typeof api.users.update>[0]) {
    setSaving(true);
    setError(null);
    try {
      const result = await api.users.update(payload);
      setMe((current) => (current ? { ...current, profile: { ...current.profile, ...result.profile } } : current));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось сохранить"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    const ok = await patch({ display_name: name.trim() || null, bio: bio.trim() || null, birthday: birthday || null });
    if (ok) setEditOpen(false);
  }

  async function togglePinned(peerId: number) {
    const next = pinnedIds.includes(peerId) ? pinnedIds.filter((id) => id !== peerId) : [...pinnedIds, peerId].slice(0, 3);
    await patch({ pinned_story_ids: next });
  }

  async function exportData() {
    setExporting(true);
    try {
      saveBlob(await api.profile.exportData(), "aurogram-profile.json");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось экспортировать данные"));
    } finally {
      setExporting(false);
    }
  }

  async function askAi() {
    const trimmed = question.trim();
    if (trimmed.length < 3) return;
    setAiBusy(true);
    setAiError(null);
    try {
      setAiAnswer(await api.ai.ask(trimmed));
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : t("AI не ответил"));
    } finally {
      setAiBusy(false);
    }
  }

  const displayName = me?.profile.display_name || me?.account.name || account.name || account.phone;
  const username = me?.account.username ?? account.username;
  const phone = me?.account.phone || account.phone;
  const stats = me?.stats;

  return (
    <section className="animate-[rise-in_240ms_ease-out]">
      <div className="glass-panel overflow-hidden rounded-[30px]">
        <div className="h-24 bg-gradient-to-br from-[#2AABEE]/35 via-accent/25 to-[#8B5CF6]/30" />
        <div className="-mt-12 flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-3">
            <span className="grid size-24 shrink-0 place-items-center rounded-full border-4 border-[color-mix(in_srgb,var(--surface)_88%,transparent)] bg-gradient-to-br from-[#2AABEE] to-[#6366F1] text-3xl font-semibold text-white shadow-[0_14px_34px_rgb(99_102_241_/_30%)]">
              {displayName.trim().slice(0, 1).toUpperCase() || "A"}
            </span>
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-xl font-semibold text-ink">{displayName}</h1>
              <p className="mt-0.5 truncate text-xs text-muted">{username ? `@${username}` : t("Без username", "No username")}</p>
              <p className="mt-1 truncate font-mono text-[11px] text-muted">{phone}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pb-1">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[11px] font-semibold text-white transition hover:bg-accent-strong"
            >
              <Pencil size={13} />{t("Редактировать профиль")}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-danger/10 px-3.5 text-[11px] font-medium text-danger transition hover:bg-danger/15"
            >
              <LogOut size={13} />{t("Выйти")}
            </button>
          </div>
        </div>
        {me?.profile.bio && <p className="px-4 pb-4 text-sm leading-6 text-ink/85">{me.profile.bio}</p>}
        {me?.profile.birthday && (
          <p className="inline-flex items-center gap-1.5 px-4 pb-4 font-mono text-[11px] text-muted">
            <CalendarDays size={12} />{me.profile.birthday}
          </p>
        )}
      </div>

      {error && <p role="alert" className="mt-3 rounded-[18px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

      <div className="glass-panel mt-3 rounded-[26px] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{t("Закреплённые истории")}</h2>
          <span className="font-mono text-[10px] text-muted">{pinnedStories.length}/3</span>
        </div>
        {stories.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted">{t("Историй пока нет — закрепить нечего.", "No stories yet — nothing to pin.")}</p>
        ) : (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {stories.map((story) => {
              const active = pinnedIds.includes(story.peer_id);
              return (
                <button
                  key={story.peer_id}
                  type="button"
                  disabled={saving}
                  onClick={() => void togglePinned(story.peer_id)}
                  aria-pressed={active}
                  className={`flex w-[58px] shrink-0 flex-col items-center gap-1.5 rounded-[16px] p-1 transition ${active ? "bg-accent/10" : "hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"}`}
                >
                  <span className={`size-[52px] rounded-full p-[2px] ${active ? "bg-gradient-to-br from-fuchsia-500 via-accent to-amber-400" : "bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"}`}>
                    <img
                      src={storyAvatarUrl(story.peer_id)}
                      alt=""
                      onError={(event) => { (event.currentTarget as HTMLImageElement).style.opacity = "0"; }}
                      className="size-full rounded-full object-cover"
                    />
                  </span>
                  <span className={`w-full truncate text-center text-[10px] ${active ? "text-accent" : "text-muted"}`}>{story.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass-panel mt-3 rounded-[26px] p-4">
        <h2 className="text-sm font-semibold text-ink">{t("Мой канал")}</h2>
        {channels.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted">{t("Каналы не найдены.", "No channels found.")}</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={myChannel?.id ?? ""}
              onChange={(event) => void patch({ channel_id: event.target.value ? Number(event.target.value) : null })}
              className="h-10 min-w-0 flex-1 rounded-[14px] bg-surface/60 px-3 text-xs text-ink outline-none"
              aria-label={t("Привязать канал")}
            >
              <option value="">{t("Не привязан")}</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.title}</option>
              ))}
            </select>
            {myChannel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 font-mono text-[10px] text-accent">
                {myChannel.username ? `@${myChannel.username}` : `id ${myChannel.id}`}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="glass-panel mt-3 rounded-[26px] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{t("Активность")}</h2>
          {loading && <Loader2 size={14} className="animate-spin text-muted" />}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: t("Сообщений"), value: stats?.messages, icon: MessageSquare },
            { label: t("Чатов"), value: stats?.chats, icon: Users },
            { label: t("Каналов"), value: stats?.channels, icon: Radio },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-[18px] bg-surface/50 p-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted"><Icon size={11} />{label}</span>
              <p className="mt-1.5 font-mono text-lg font-medium tabular-nums text-ink">{loading ? "…" : value?.toLocaleString("ru-RU") ?? "—"}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportData()}
            disabled={exporting}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface/60 px-3.5 text-[11px] font-medium text-ink transition hover:text-accent disabled:opacity-50"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {t("Экспорт данных")}
          </button>
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[11px] font-semibold text-white transition hover:bg-accent-strong"
          >
            <Bot size={13} />{t("Спросить AI")}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {editOpen && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t("Редактировать профиль")}
              className="glass-modal w-full max-w-md p-4"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={springModal}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink">{t("Редактировать профиль")}</h2>
                <button type="button" onClick={() => setEditOpen(false)} aria-label={t("Закрыть")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink"><X size={14} /></button>
              </div>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-1.5 text-[11px] text-muted">
                  {t("Имя")}
                  <input value={name} maxLength={64} onChange={(event) => setName(event.target.value)} className="h-10 rounded-[14px] bg-surface/60 px-3 text-sm text-ink outline-none focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]" />
                </label>
                <label className="grid gap-1.5 text-[11px] text-muted">
                  {t("Био")}
                  <textarea value={bio} maxLength={200} rows={3} onChange={(event) => setBio(event.target.value)} className="resize-none rounded-[14px] bg-surface/60 px-3 py-2 text-sm text-ink outline-none focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]" />
                </label>
                <label className="grid gap-1.5 text-[11px] text-muted">
                  {t("День рождения")}
                  <input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} className="h-10 rounded-[14px] bg-surface/60 px-3 font-mono text-sm text-ink outline-none" />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={saving}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[14px] bg-accent text-xs font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}{t("Сохранить")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aiOpen && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAiOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t("Спросить AI")}
              className="glass-modal w-full max-w-lg p-4"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={springModal}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-[12px] bg-accent/10 text-accent"><Sparkles size={16} /></span>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-ink">{t("Спросить AI")}</h2>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t("по последним 50 сообщениям")}</p>
                </div>
                <button type="button" onClick={() => setAiOpen(false)} aria-label={t("Закрыть")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink"><X size={14} /></button>
              </div>
              <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void askAi(); }}>
                <input
                  autoFocus
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  maxLength={500}
                  placeholder={t("Что я обсуждал вчера?")}
                  className="h-11 min-w-0 flex-1 rounded-[16px] bg-surface/60 px-3.5 text-sm text-ink outline-none placeholder:text-muted"
                />
                <button type="submit" disabled={aiBusy || question.trim().length < 3} className="inline-flex h-11 items-center gap-1.5 rounded-[16px] bg-accent px-4 text-xs font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50">
                  {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </form>
              {aiError && <p role="alert" className="mt-3 rounded-[14px] bg-danger/10 px-3 py-2 text-xs text-danger">{aiError}</p>}
              {aiAnswer && (
                <div className="mt-3 rounded-[18px] bg-surface/60 p-3">
                  <p className="whitespace-pre-line text-sm leading-6 text-ink">{aiAnswer.answer}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{aiAnswer.model} · {aiAnswer.context_messages} {t("сообщений")}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
