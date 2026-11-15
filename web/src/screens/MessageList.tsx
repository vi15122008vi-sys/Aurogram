import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "framer-motion";
import { ArrowDownToLine, LoaderCircle, Pin, PinOff, Send, StopCircle, Video } from "lucide-react";
import { ApiError, api, type MessageRecord } from "../lib/api";
import { springPress } from "../lib/motion";
import { isOfflineError, readCache, writeCache } from "../lib/offline";
import { OfflineBanner } from "../components/OfflineBanner";
import { Skeleton } from "../components/Skeleton";
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

function VideoNotePlayer({ chatId, messageId }: { chatId: number; messageId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    api.messages.media(chatId, messageId).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => undefined);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [chatId, messageId]);
  return url ? <video src={url} controls playsInline className="mt-1 size-44 rounded-full bg-black object-cover shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_10%,transparent)]" /> : <span className="mt-1 grid size-44 place-items-center rounded-full bg-black/20 text-muted"><LoaderCircle size={18} className="animate-spin" /></span>;
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
  const [authExpired, setAuthExpired] = useState(false);
  const [retryLeft, setRetryLeft] = useState(0);
  const wasFloodWait = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (retryLeft <= 0) return;
    const timer = window.setInterval(() => {
      setRetryLeft((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryLeft > 0]);

  // Таймер дошёл до нуля после FloodWait — перезагружаем сообщения сами.
  useEffect(() => {
    if (retryLeft !== 0 || !wasFloodWait.current) return;
    wasFloodWait.current = false;
    setReloadKey((value) => value + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryLeft]);

  function formatRetry(total: number): string {
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  const [offline, setOffline] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [sendingVideo, setSendingVideo] = useState(false);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const dateGroups = useMemo(() => messages.reduce<{ label: string; messages: MessageRecord[] }[]>((groups, message) => {
    const label = displayDateDivider(message.date, locale);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.label === label) lastGroup.messages.push(message);
    else groups.push({ label, messages: [message] });
    return groups;
  }, []), [messages, locale]);
  const parentRef = useRef<HTMLDivElement>(null);

  // Плоский список строк для виртуализации: разделители дат + сообщения.
  const rows = useMemo(() => {
    const list: ({ kind: "divider"; key: string; label: string } | { kind: "message"; key: string; message: MessageRecord })[] = [];
    for (const group of dateGroups) {
      list.push({ kind: "divider", key: `d:${group.label}`, label: group.label });
      for (const message of group.messages) {
        list.push({ kind: "message", key: `m:${message.chat_id}:${message.id}`, message });
      }
    }
    return list;
  }, [dateGroups]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 8,
  });

  // Чат открывается на последнем сообщении (новые внизу).
  useEffect(() => {
    if (!rows.length) return;
    const id = window.setTimeout(() => {
      virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
    }, 40);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessages([]);
    setError(null);
    setOffline(false);
    const cacheKey = `messages:${chatId}`;
    api.messages.list(chatId, pageSize)
      .then((result) => {
        if (!active) return;
        setMessages([...result].reverse());
        setHasMore(result.length === pageSize);
        writeCache(cacheKey, result);
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 401) setAuthExpired(true);
          if (cause instanceof ApiError && cause.status === 429) {
            const seconds = cause.retryAfter ?? Number((cause.message.match(/(\d+)/) ?? [])[1] ?? 60);
            wasFloodWait.current = true;
            setRetryLeft(seconds);
          }
        if (!active) return;
        // Нет сети — поднимаем последнюю копию переписки из localStorage.
        if (isOfflineError(cause)) {
          const cached = readCache<MessageRecord[]>(cacheKey);
          if (cached?.length) {
            setMessages([...cached].reverse());
            setOffline(true);
            return;
          }
        }
        setError(t(cause instanceof Error ? cause.message : "Не удалось загрузить сообщения"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [chatId, pageSize, reloadKey]);

  useEffect(() => {
    if (videoPreviewRef.current && recordingStream) videoPreviewRef.current.srcObject = recordingStream;
  }, [recordingStream]);

  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const loadOlder = useCallback(async () => {
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
  }, [chatId, pageSize, messages.length]);
  const send = useCallback(async (event: FormEvent<HTMLFormElement>) => {
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
  }, [text, chatId, allowSend]);
  async function chooseReaction(messageId: number, emoji: "👍" | "❤️" | "🔥" | "😂") {
    setError(null);
    try {
      const updated = await api.messages.react(chatId, messageId, emoji);
      setMessages((current) => current.map((message) => message.id === messageId ? updated : message));
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : "Не удалось отправить реакцию"));
    } finally {
      setReactionTarget(null);
    }
  }

  async function togglePinned(message: MessageRecord) {
    setError(null);
    try {
      const updated = await api.messages.pin(chatId, message.id, !message.pinned);
      setMessages((current) => current.map((item) => item.id === message.id ? updated : item));
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : "Не удалось закрепить сообщение"));
    }
  }

  async function startVideoNote() {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user", width: 512, height: 512 } });
      const supported = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4"].find((mime) => MediaRecorder.isTypeSupported(mime));
      const recorder = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      streamRef.current = stream;
      chunksRef.current = [];
      stream.getTracks().forEach((track) => { track.onended = () => { if (recorder.state === "recording") recorder.stop(); }; });
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecordingStream(null);
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        if (!blob.size) return;
        setSendingVideo(true);
        try {
          const sent = await api.messages.sendVideoNote(chatId, blob);
          setMessages((current) => [...current, sent]);
          setLastSentId(sent.id);
        } catch (cause) {
          setError(t(cause instanceof Error ? cause.message : "Не удалось отправить видеосообщение"));
        } finally {
          setSendingVideo(false);
        }
      };
      recorderRef.current = recorder;
      setRecordingStream(stream);
      recorder.start(250);
      setRecording(true);
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : "Не удалось включить камеру и микрофон"));
    }
  }

  function stopVideoNote() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  return (
    <section className="glass-panel overflow-hidden rounded-[26px]">
      {hasMore && <div className="p-2 text-center shadow-[inset_0_-1px_0_color-mix(in_srgb,var(--ink)_4%,transparent)]"><button type="button" onClick={loadOlder} disabled={loadingOlder} className="inline-flex h-8 items-center gap-2 rounded-full bg-surface/60 px-3.5 text-xs font-medium text-muted hover:text-ink disabled:opacity-50"><ArrowDownToLine size={14} />{loadingOlder ? t("Загружаем…") : t("Загрузить предыдущие")}</button></div>}
      {offline && <div className="px-3 pt-3"><OfflineBanner /></div>}
      <div ref={parentRef} className="max-h-[55vh] min-h-48 overflow-y-auto bg-black/[0.06] p-3 sm:p-4">
        {loading && !messages.length && (
          <div className="space-y-3" aria-busy="true" aria-live="polite" aria-label={t("Загружаем сообщения", "Loading messages")}>
            {[62, 44, 72, 38, 55].map((width, index) => (
              <div key={index} className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}>
                <div className="space-y-2 rounded-[20px] bg-surface/40 px-3.5 py-3" style={{ width: `${width}%` }}>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}
        {loading && !!messages.length && <div className="flex justify-center py-3 text-muted"><LoaderCircle size={16} className="animate-spin" /></div>}
        {!loading && !messages.length && <p className="py-10 text-center text-sm text-muted">{t("Сообщений нет")}</p>}
        {!!rows.length && (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={row.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${virtualRow.start}px)` }}
                >
                  {row.kind === "divider" ? (
                    <div className="flex justify-center py-1"><span className="rounded-full bg-surface/70 px-3 py-1 font-mono text-[9px] capitalize text-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)]">{row.label}</span></div>
                  ) : (
                    <div className="pb-3">{<motion.article onDoubleClick={() => setReactionTarget(row.message.id)} initial={row.message.id === lastSentId ? { opacity: 0, scale: 0.96, y: 6 } : false} animate={row.message.id === lastSentId ? { opacity: 1, scale: [0.96, 1.02, 1], y: 0 } : undefined} transition={row.message.id === lastSentId ? { duration: 0.34, ease: [0.2, 0.85, 0.3, 1] } : undefined} onAnimationComplete={() => { if (row.message.id === lastSentId) setLastSentId(null); }} className={`flex ${row.message.out ? "justify-end" : "justify-start"}`}>
  <div className={`glass-hover glass-message max-w-[88%] min-w-[min(16rem,88%)] rounded-[20px] px-3.5 py-2.5 sm:max-w-[76%] ${row.message.out ? "glass-message-out rounded-br-[8px]" : "glass-message-in rounded-bl-[8px]"}`}>
    {!row.message.out && row.message.sender_name && <p className="mb-1 text-[10px] font-semibold text-accent">{row.message.sender_name}</p>}
    {row.message.text && <p className="whitespace-pre-wrap break-words text-sm leading-5 text-ink">{row.message.text}</p>}
    {row.message.media_type === "video_note" && <VideoNotePlayer chatId={chatId} messageId={row.message.id} />}
    {row.message.media_type === "voice" && <VoicePlayer chatId={chatId} messageId={row.message.id} durationHint={row.message.duration} waveform={row.message.waveform_data} />}
    {row.message.media_type && row.message.media_type !== "voice" && row.message.media_type !== "video_note" && (
      <button type="button" onClick={() => void saveMedia(chatId, row.message.id).catch((cause: unknown) => setError(t(cause instanceof Error ? cause.message : "Не удалось скачать медиа")))} className="mt-2 inline-flex h-8 items-center gap-2 rounded-full bg-surface/60 px-3 text-xs text-muted hover:text-ink">
        <ArrowDownToLine size={13} />{t("Скачать")} {t(row.message.media_type)}
      </button>
    )}
    {!!row.message.reactions?.length && <div className="mt-2 flex flex-wrap gap-1">{row.message.reactions.map((reaction) => <span key={reaction.emoji} className={`rounded-full px-2 py-0.5 text-xs ${reaction.chosen ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_25%,transparent)]" : "bg-surface/60 text-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)]"}`}>{reaction.emoji} {reaction.count}</span>)}</div>}
    {reactionTarget === row.message.id && <div className="mt-2 flex gap-1 rounded-full bg-surface/90 p-1 shadow-[0_10px_28px_rgb(0_0_0_/_18%),inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)]" aria-label={t("Выберите реакцию")}>{(["👍", "❤️", "🔥", "😂"] as const).map((emoji) => <motion.button key={emoji} type="button" whileTap={springPress} aria-label={emoji} onClick={() => void chooseReaction(row.message.id, emoji)} className="grid size-8 place-items-center rounded-full text-lg transition hover:bg-accent/15">{emoji}</motion.button>)}</div>}
    <div className="mt-1.5 flex items-center justify-end gap-2">
      {allowSend && <motion.button type="button" whileTap={springPress} onClick={() => void togglePinned(row.message)} aria-label={t(row.message.pinned ? "Открепить сообщение" : "Закрепить сообщение")} title={t(row.message.pinned ? "Открепить сообщение" : "Закрепить сообщение")} className={`grid size-6 place-items-center rounded-full transition ${row.message.pinned ? "text-accent" : "text-muted hover:text-accent"}`}>{row.message.pinned ? <PinOff size={12} /> : <Pin size={12} />}</motion.button>}
      {row.message.pinned && <span className="font-mono text-[9px] text-accent">{t("Закреплено")}</span>}
      <p className="font-mono text-[9px] tabular-nums text-muted">{displayDate(row.message.date, locale)}</p>
    </div>
  </div>
</motion.article>}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {retryLeft > 0 && (
        <div role="status" className="mx-3 mb-3 rounded-[16px] bg-warning/10 px-3 py-2 text-xs text-warning">
          {t("Подождите")} {formatRetry(retryLeft)} — {t("Telegram ограничил загрузку")}
        </div>
      )}
      {authExpired && (
        <div role="alert" className="mx-3 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[16px] bg-danger/10 px-3 py-2 text-xs text-danger">
          <span>{t("Сессия истекла, войдите заново")}</span>
          <button
            type="button"
            onClick={async () => {
              try { await api.auth.logout(); } catch { /* ignore */ }
              window.location.reload();
            }}
            className="rounded-full bg-danger px-3 py-1 text-[11px] font-semibold text-white"
          >
            {t("Войти заново")}
          </button>
        </div>
      )}

      {error && <p role="alert" className="bg-danger/10 px-3 py-2 text-xs text-danger shadow-[inset_0_1px_0_color-mix(in_srgb,var(--ink)_4%,transparent)]">{error}</p>}
      {allowSend && <form onSubmit={send} className="flex items-center gap-2 bg-surface/30 p-2.5 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--ink)_4%,transparent)] sm:p-3">
        {recordingStream && <video ref={videoPreviewRef} autoPlay muted playsInline className="size-10 shrink-0 rounded-full object-cover shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_50%,transparent)]" />}
        <input value={text} onChange={(event) => setText(event.target.value)} maxLength={4096} placeholder={t("Сообщение…")} className="h-11 min-w-0 flex-1 rounded-[22px] bg-surface/60 px-4 text-sm text-ink outline-none placeholder:text-muted focus:bg-surface/80 focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]" />
        <motion.button type="button" whileTap={springPress} disabled={sendingVideo} onClick={recording ? stopVideoNote : () => void startVideoNote()} aria-label={t(recording ? "Остановить запись" : "Записать видеосообщение")} className={`grid size-11 shrink-0 place-items-center rounded-full bg-surface/60 text-ink transition hover:text-accent disabled:opacity-50 ${recording ? "animate-pulse text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_45%,transparent)]" : ""}`}>
          {recording ? <StopCircle size={17} /> : sendingVideo ? <LoaderCircle size={17} className="animate-spin" /> : <Video size={17} />}
        </motion.button>
        <motion.button type="submit" whileTap={springPress} disabled={sending || !text.trim()} aria-label={t("Отправить сообщение")} className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-white shadow-[0_8px_20px_color-mix(in_srgb,var(--accent)_35%,transparent)] transition hover:bg-accent-strong disabled:opacity-50"><Send size={15} /></motion.button>
      </form>}
    </section>
  );
}

export default memo(MessageList);
