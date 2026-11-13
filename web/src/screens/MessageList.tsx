import { useEffect, useRef, useState, type FormEvent } from "react";
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
  const [offline, setOffline] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [sendingVideo, setSendingVideo] = useState(false);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
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
  }, [chatId, pageSize]);

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
      <div className="max-h-[55vh] min-h-48 space-y-3 overflow-y-auto bg-black/[0.06] p-3 sm:p-4">
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
        {dateGroups.map((group) => (
          <div key={group.label}>
            <div className="sticky top-0 z-10 flex justify-center py-1"><span className="rounded-full bg-surface/70 px-3 py-1 font-mono text-[9px] capitalize text-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)]">{group.label}</span></div>
            <div className="space-y-3 pt-2">
              {group.messages.map((message) => (
                <motion.article key={`${message.chat_id}:${message.id}`} onDoubleClick={() => setReactionTarget(message.id)} initial={message.id === lastSentId ? { opacity: 0, scale: 0.96, y: 6 } : false} animate={message.id === lastSentId ? { opacity: 1, scale: [0.96, 1.02, 1], y: 0 } : undefined} transition={message.id === lastSentId ? { duration: 0.34, ease: [0.2, 0.85, 0.3, 1] } : undefined} onAnimationComplete={() => { if (message.id === lastSentId) setLastSentId(null); }} className={`flex ${message.out ? "justify-end" : "justify-start"}`}>
                  <div className={`glass-hover glass-message max-w-[88%] min-w-[min(16rem,88%)] rounded-[20px] px-3.5 py-2.5 sm:max-w-[76%] ${message.out ? "glass-message-out rounded-br-[8px]" : "glass-message-in rounded-bl-[8px]"}`}>
                    {!message.out && message.sender_name && <p className="mb-1 text-[10px] font-semibold text-accent">{message.sender_name}</p>}
                    {message.text && <p className="whitespace-pre-wrap break-words text-sm leading-5 text-ink">{message.text}</p>}
                    {message.media_type === "video_note" && <VideoNotePlayer chatId={chatId} messageId={message.id} />}
                    {message.media_type === "voice" && <VoicePlayer chatId={chatId} messageId={message.id} durationHint={message.duration} waveform={message.waveform_data} />}
                    {message.media_type && message.media_type !== "voice" && message.media_type !== "video_note" && (
                      <button type="button" onClick={() => void saveMedia(chatId, message.id).catch((cause: unknown) => setError(t(cause instanceof Error ? cause.message : "Не удалось скачать медиа")))} className="mt-2 inline-flex h-8 items-center gap-2 rounded-full bg-surface/60 px-3 text-xs text-muted hover:text-ink">
                        <ArrowDownToLine size={13} />{t("Скачать")} {t(message.media_type)}
                      </button>
                    )}
                    {!!message.reactions?.length && <div className="mt-2 flex flex-wrap gap-1">{message.reactions.map((reaction) => <span key={reaction.emoji} className={`rounded-full px-2 py-0.5 text-xs ${reaction.chosen ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_25%,transparent)]" : "bg-surface/60 text-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)]"}`}>{reaction.emoji} {reaction.count}</span>)}</div>}
                    {reactionTarget === message.id && <div className="mt-2 flex gap-1 rounded-full bg-surface/90 p-1 shadow-[0_10px_28px_rgb(0_0_0_/_18%),inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)]" aria-label={t("Выберите реакцию")}>{(["👍", "❤️", "🔥", "😂"] as const).map((emoji) => <motion.button key={emoji} type="button" whileTap={springPress} aria-label={emoji} onClick={() => void chooseReaction(message.id, emoji)} className="grid size-8 place-items-center rounded-full text-lg transition hover:bg-accent/15">{emoji}</motion.button>)}</div>}
                    <div className="mt-1.5 flex items-center justify-end gap-2">
                      {allowSend && <motion.button type="button" whileTap={springPress} onClick={() => void togglePinned(message)} aria-label={t(message.pinned ? "Открепить сообщение" : "Закрепить сообщение")} title={t(message.pinned ? "Открепить сообщение" : "Закрепить сообщение")} className={`grid size-6 place-items-center rounded-full transition ${message.pinned ? "text-accent" : "text-muted hover:text-accent"}`}>{message.pinned ? <PinOff size={12} /> : <Pin size={12} />}</motion.button>}
                      {message.pinned && <span className="font-mono text-[9px] text-accent">{t("Закреплено")}</span>}
                      <p className="font-mono text-[9px] tabular-nums text-muted">{displayDate(message.date, locale)}</p>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        ))}
      </div>
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

