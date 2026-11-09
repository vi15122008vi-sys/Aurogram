import { useEffect, useState, type FormEvent } from "react";
import { ArrowDownToLine, LoaderCircle, Send } from "lucide-react";
import { api, type MessageRecord } from "../lib/api";
import { VoicePlayer } from "../components/VoicePlayer";

interface MessageListProps {
  chatId: number;
  allowSend?: boolean;
  pageSize?: number;
}

function displayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function displayDateDivider(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "full" }).format(date);
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
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateGroups = messages.reduce<{ label: string; messages: MessageRecord[] }[]>((groups, message) => {
    const label = displayDateDivider(message.date);
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
        if (active) setError(cause instanceof Error ? cause.message : "Не удалось загрузить сообщения");
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
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить сообщения");
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
      setText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      {hasMore && <div className="border-b border-line p-2 text-center"><button type="button" onClick={loadOlder} disabled={loadingOlder} className="inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-medium text-muted hover:bg-raised disabled:opacity-50"><ArrowDownToLine size={14} />{loadingOlder ? "Загружаем…" : "Загрузить предыдущие"}</button></div>}
      <div className="max-h-[55vh] min-h-48 space-y-3 overflow-y-auto bg-canvas p-3">
        {loading && <div className="flex justify-center py-8 text-muted"><LoaderCircle size={18} className="animate-spin" /></div>}
        {!loading && !messages.length && <p className="py-10 text-center text-sm text-muted">Сообщений нет</p>}
        {dateGroups.map((group) => (
          <div key={group.label}>
            <div className="sticky top-0 z-10 flex justify-center py-1"><span className="rounded-lg border border-line bg-surface px-2.5 py-1 font-mono text-[9px] capitalize text-muted">{group.label}</span></div>
            <div className="space-y-3 pt-2">
              {group.messages.map((message) => (
                <article key={`${message.chat_id}:${message.id}`} className={`flex ${message.out ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] min-w-[min(16rem,88%)] rounded-xl border px-3 py-2.5 sm:max-w-[76%] ${message.out ? "border-line bg-accent/15" : "border-line bg-raised"}`}>
                    {!message.out && message.sender_name && <p className="mb-1 text-[10px] font-semibold text-accent">{message.sender_name}</p>}
                    {message.text && <p className="whitespace-pre-wrap break-words text-sm leading-5 text-ink">{message.text}</p>}
                    {message.media_type === "voice" && <VoicePlayer chatId={chatId} messageId={message.id} durationHint={message.duration} waveform={message.waveform_data} />}
                    {message.media_type && message.media_type !== "voice" && (
                      <button type="button" onClick={() => void saveMedia(chatId, message.id).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Не удалось скачать медиа"))} className="mt-2 inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-xs text-muted hover:text-ink">
                        <ArrowDownToLine size={13} />Скачать {message.media_type}
                      </button>
                    )}
                    <p className="mt-1.5 text-right font-mono text-[9px] tabular-nums text-muted">{displayDate(message.date)}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="border-t border-line bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
      {allowSend && <form onSubmit={send} className="flex items-center gap-2 border-t border-line bg-surface p-3">
        <input value={text} onChange={(event) => setText(event.target.value)} maxLength={4096} placeholder="Сообщение…" className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 text-sm text-ink outline-none focus:border-accent" />
        <button type="submit" disabled={sending || !text.trim()} aria-label="Отправить сообщение" className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white hover:bg-accent-strong disabled:opacity-50"><Send size={15} /></button>
      </form>}
    </section>
  );
}