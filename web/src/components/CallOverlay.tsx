import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Phone, PhoneCall, PhoneOff, Users, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { CallSession, type CallStatus } from "../lib/call";
import { readCache } from "../lib/offline";
import { springModal } from "../lib/motion";
import type { ChatRecord } from "../lib/api";
import { useI18n } from "../lib/i18n";

type CallPhase = "pick" | "connect" | "active" | "failed";

interface CallOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Комната звонка: обычно `chat:{id}`. Пусто — показываем выбор контакта. */
  room?: string | null;
  contact?: string | null;
}

interface CallPeer {
  id: number;
  title: string;
}

function formatDuration(total: number): string {
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * Звонок: сигналинг через /api/calls/ws/{room}, медиа — WebRTC (аудио).
 * Комната на двоих: первый вошёл — ждёт, второй вошёл — обмен offer/answer/ICE.
 */
export function CallOverlay({ open, onClose, room = null, contact = null }: CallOverlayProps) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<CallPhase>("pick");
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [peers, setPeers] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const sessionRef = useRef<CallSession | null>(null);
  const [busy, setBusy] = useState(false);
  // `t` из useI18n — новая функция на каждый рендер, поэтому эффект запуска
  // звонка не должен зависеть от неё напрямую (иначе переподключение в цикле).
  const tRef = useRef(t);
  tRef.current = t;

  const contacts = useMemo<CallPeer[]>(() => {
    if (!open) return [];
    const cached = readCache<ChatRecord[]>("chats:active") ?? [];
    const fromCache = cached
      .filter((chat) => chat.type === "user" || chat.type === "group")
      .slice(0, 6)
      .map((chat) => ({ id: chat.id, title: chat.title }));
    return fromCache.length ? fromCache : [{ id: 0, title: "Aurogram Support" }];
  }, [open]);

  async function startCall(nextRoom: string, title: string) {
    const translate = tRef.current;
    sessionRef.current?.close();
    setPeer({ id: 0, title });
    setPhase("connect");
    setStatusText(translate("Подключаемся…", "Connecting…"));
    setPeers(0);
    setErrorText(null);
    setSeconds(0);
    setMuted(false);

    const session = new CallSession({
      onStatus: (status: CallStatus, detail?: string) => {
        if (status === "connecting" || status === "waiting") {
          setPhase("connect");
          setStatusText(status === "waiting" ? translate("Ожидаем собеседника…", "Waiting for the other side…") : translate("Подключаемся…", "Connecting…"));
        } else if (status === "incoming") {
          setPhase("connect");
          setStatusText(translate("Входящее соединение…", "Incoming connection…"));
        } else if (status === "active") {
          setPhase("active");
          setStatusText("");
        } else if (status === "failed") {
          setPhase("failed");
          setErrorText(detail ?? translate("Не удалось установить соединение", "Could not connect"));
        } else if (status === "ended") {
          setPhase("pick");
        }
      },
      onPeers: (count) => setPeers(count),
    });
    sessionRef.current = session;
    await session.start(nextRoom);
  }

  useEffect(() => {
    if (!open) return;
    if (room) {
      void startCall(room, contact ?? tRef.current("Собеседник", "Contact"));
    } else {
      setPhase("pick");
      setPeer(null);
      setSeconds(0);
      setPeers(0);
      setErrorText(null);
    }
    // startCall намеренно не в зависимостях: он пересоздаётся из-за `t`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, room, contact]);

  useEffect(() => {
    if (phase !== "active") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") endCall();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => () => {
    sessionRef.current?.close();
    sessionRef.current = null;
  }, []);

  function toggleMute() {
    setMuted((value) => {
      sessionRef.current?.setMuted(!value);
      return !value;
    });
  }

  async function acceptCall() {
    setBusy(true);
    try {
      // Уже подключены (media стартует автоматически) — просто подтверждаем в UI.
      setPhase("active");
    } finally {
      setBusy(false);
    }
  }

  function endCall() {
    sessionRef.current?.hangUp();
    sessionRef.current?.close();
    sessionRef.current = null;
    setPhase("pick");
    setPeer(null);
    setPeers(0);
    setSeconds(0);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={endCall}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("Звонок", "Call")}
            className="glass-modal w-full max-w-sm overflow-hidden"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={springModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                {phase === "active" ? t("НА СВЯЗИ", "CONNECTED") : phase === "connect" ? t("ЗВОНОК", "CALL") : phase === "failed" ? t("ОШИБКА", "ERROR") : t("ЗВОНОК", "CALL")}
              </p>
              <button type="button" onClick={endCall} aria-label={t("Закрыть", "Close")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink">
                <X size={14} />
              </button>
            </div>

            {phase === "pick" ? (
              <div className="p-4">
                <h2 className="text-lg font-semibold text-ink">{t("Кому позвонить", "Call someone")}</h2>
                <p className="mt-1 text-xs text-muted">{t("Недавние контакты из кэша", "Recent contacts from cache")}</p>
                <ul className="mt-3 space-y-1">
                  {contacts.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => void startCall(`chat:${item.id}`, item.title)}
                        className="flex w-full items-center gap-3 rounded-[18px] px-2 py-2 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
                      >
                        <Avatar name={item.title} id={item.id} className="size-10" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{item.title}</span>
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white">
                          <PhoneCall size={15} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[10px] leading-4 text-muted">
                  {t("Комната звонка общая для чата: чтобы соединиться, откройте звонок в том же чате на втором устройстве.", "The call room is shared per chat: join the same chat call on the second device to connect.")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center px-4 pb-4 pt-2">
                <span className="relative grid place-items-center">
                  {phase === "connect" && (
                    <>
                      <span className="absolute size-24 animate-ping rounded-full bg-accent/20" aria-hidden="true" />
                      <span className="absolute size-32 animate-pulse rounded-full bg-accent/10" aria-hidden="true" />
                    </>
                  )}
                  <Avatar name={peer?.title ?? ""} id={peer?.id} className="relative size-24" />
                </span>
                <p className="mt-3 max-w-full truncate text-lg font-semibold text-ink">{peer?.title}</p>
                <p className="mt-1 font-mono text-xs tabular-nums text-muted">
                  {phase === "active" ? formatDuration(seconds) : statusText || t("Вызов…", "Ringing…")}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted">
                  <Users size={10} />{peers}/2 · WebRTC
                </p>
                {errorText && <p role="alert" className="mt-2 text-center text-[11px] text-danger">{errorText}</p>}

                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-pressed={muted}
                    aria-label={t(muted ? "Включить микрофон" : "Выключить микрофон", muted ? "Unmute microphone" : "Mute microphone")}
                    className={`grid size-12 place-items-center rounded-full transition ${muted ? "bg-danger/15 text-danger" : "bg-surface/60 text-ink hover:text-accent"}`}
                  >
                    {muted ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => void acceptCall()}
                    disabled={phase === "active" || busy}
                    aria-label={t("Принять звонок", "Accept call")}
                    className="grid size-14 place-items-center rounded-full bg-success text-white shadow-[0_10px_24px_color-mix(in_srgb,var(--success)_35%,transparent)] transition hover:brightness-110 disabled:opacity-40"
                  >
                    <Phone size={20} />
                  </button>

                  <button
                    type="button"
                    onClick={endCall}
                    aria-label={t("Отклонить звонок", "Decline call")}
                    className="grid size-12 place-items-center rounded-full bg-danger text-white shadow-[0_10px_24px_color-mix(in_srgb,var(--danger)_35%,transparent)] transition hover:brightness-110"
                  >
                    <PhoneOff size={18} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
