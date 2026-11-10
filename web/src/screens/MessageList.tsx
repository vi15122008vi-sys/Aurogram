import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowDownToLine, LoaderCircle, Send } from "lucide-react";
import { api, type MessageRecord } from "../lib/api";
import { VoicePlayer } from "../components/VoicePlayer";
import { useI18n } from "../lib/i18n";

interface MessageListProps {
  chatId: number;
  allowSend?: boolean;
  pageSize?: number;
}

function displayDate(value: string, locale: "ru" | "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function displayDateDivider(value: string, locale: "ru" | "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", { dateStyle: "full" }).format(date);
}

async function saveMedia(chatId: number, messageId: number) {
  const blob = await api.messages.media(chatId, messageId);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `media-${messageId}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MessageList({ chatId, allowSend = false, pageSize = 50 }: MessageListProps) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSentId, setLastSentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dateGroups = messages.reduce<{ label: string; messages: MessageRecord[] }[]>((groups, message) => {
    const label = displayDateDivider(message.date, locale);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.label === label) lastGroup.messages.push(message);
    else groups.push({ label, messages: [message] });
    return groups;
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessages([]);
    setError(null);
    api.messages.list(chatId, pageSize)
      .then((result) => {
        if (!active) return;
        setMessages([...result].reverse());
        setHasMore(result.length === pageSize);
      })
      .catch((cause: unknown) => {
        if (active) setError(t(cause instanceof Error ? cause.message : "Не удалось загрузить сообщения"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [chatId, pageSize]);

  async function loadOlder() {
    const offsetId = messages[0]?.id;
    if (!offsetId || loadingOlder) return;
    setLoadingOlder(true);
    setError(null);
    try {
      const older = await api.messages.list(chatId, pageSize, offsetId);
      setMessages((current) => [...older.reverse(), ...current]);
      setHasMore(older.length === pageSize);
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : "Не удалось загрузить сообщения"));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const sent = await api.messages.send(chatId, body);
      setMessages((current) => [...current, sent]);
      setLastSentId(sent.id);
      setText("");
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : "Не удалось отправить сообщение"));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface/90 shadow-[0_12px_36px_rgb(0_0_0_/_12%)]">
      {hasMore && <div className="border-b border-line p-2 text-center"><button type="button" onClick={loadOlder} disabled={loadingOlder} className="inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-medium text-muted hover:bg-raised disabled:opacity-50"><ArrowDownToLine size={14} />{loadingOlder ? t("Загружаем…") : t("Загрузить предыдущие")}</button></div>}
      <div className="max-h-[55vh] min-h-48 space-y-3 overflow-y-auto bg-canvas/70 p-3 sm:p-4">
        {loading && <div className="flex justify-center py-8 text-muted"><LoaderCircle size={18} className="animate-spin" /></div>}
        {!loading && !messages.length && <p className="py-10 text-center text-sm text-muted">{t("Сообщений нет")}</p>}
        {dateGroups.map((group) => (
          <div key={group.label}>
            <div className="sticky top-0 z-10 flex justify-center py-1"><span className="rounded-lg border border-line bg-surface px-2.5 py-1 font-mono text-[9px] capitalize text-muted">{group.label}</span></div>
            <div className="space-y-3 pt-2">
              {group.messages.map((message) => (
                <motion.article key={`${message.chat_id}:${message.id}`} initial={message.id === lastSentId ? { opacity: 0, scale: 0.96, y: 6 } : false} animate={message.id === lastSentId ? { opacity: 1, scale: [0.96, 1.02, 1], y: 0 } : undefined} transition={message.id === lastSentId ? { duration: 0.34, ease: [0.2, 0.85, 0.3, 1] } : undefined} onAnimationComplete={() => { if (message.id === lastSentId) setLastSentId(null); }} className={`flex ${message.out ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] min-w-[min(16rem,88%)] rounded-xl border px-3 py-2.5 sm:max-w-[76%] ${message.out ? "border-accent/15 bg-accent/12 shadow-[inset_0_1px_0_rgb(255_255_255_/_4%)]" : "border-border bg-surfaceRaised"}`}>
                    {!message.out && message.sender_name && <p className="mb-1 text-[10px] font-semibold text-accent">{message.sender_name}</p>}
                    {message.text && <p className="whitespace-pre-wrap break-words text-sm leading-5 text-ink">{message.text}</p>}
                    {message.media_type === "voice" && <VoicePlayer chatId={chatId} messageId={message.id} durationHint={message.duration} waveform={message.waveform_data} />}
                    {message.media_type && message.media_type !== "voice" && (
                      <button type="button" onClick={() => void saveMedia(chatId, message.id).catch((cause: unknown) => setError(t(cause instanceof Error ? cause.message : "Не удалось скачать медиа")))} className="mt-2 inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-xs text-muted hover:text-ink">
                        <ArrowDownToLine size={13} />{t("Скачать")} {t(message.media_type)}
                      </button>
                    )}
                    <p className="mt-1.5 text-right font-mono text-[9px] tabular-nums text-muted">{displayDate(message.date, locale)}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="border-t border-line bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
      {allowSend && <form onSubmit={send} className="flex items-center gap-2 border-t border-line bg-surface p-3">
        <input value={text} onChange={(event) => setText(event.target.value)} maxLength={4096} placeholder={t("Сообщение…")} className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 text-sm text-ink outline-none focus:border-accent" />
        <button type="submit" disabled={sending || !text.trim()} aria-label={t("Отправить сообщение")} className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white hover:bg-accent-strong disabled:opacity-50"><Send size={15} /></button>
      </form>}
    </section>
  );
}
