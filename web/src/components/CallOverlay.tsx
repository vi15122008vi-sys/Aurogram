import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Phone, PhoneCall, PhoneOff, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { readCache } from "../lib/offline";
import { springModal } from "../lib/motion";
import type { ChatRecord } from "../lib/api";
import { useI18n } from "../lib/i18n";

type CallPhase = "pick" | "ringing" | "active";

interface CallOverlayProps {
  open: boolean;
  onClose: () => void;
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
 * Оверлей звонка — пока только UI-каркас (без VoIP).
 * Сценарий: выбор контакта → «Вызов…» (Принять / Отклонить / Микрофон) → «На связи» с таймером.
 */
export function CallOverlay({ open, onClose }: CallOverlayProps) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<CallPhase>("pick");
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const contacts = useMemo<CallPeer[]>(() => {
    if (!open) return [];
    const cached = readCache<ChatRecord[]>("chats:active") ?? [];
    const fromCache = cached
      .filter((chat) => chat.type === "user" || chat.type === "group")
      .slice(0, 6)
      .map((chat) => ({ id: chat.id, title: chat.title }));
    return fromCache.length ? fromCache : [{ id: 0, title: t("Aurogram Support", "Aurogram Support") }];
  }, [open, t]);

  useEffect(() => {
    if (!open) return;
    setPhase("pick");
    setPeer(null);
    setMuted(false);
    setSeconds(0);
  }, [open]);

  useEffect(() => {
    if (phase !== "active") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function startCall(next: CallPeer) {
    setPeer(next);
    setSeconds(0);
    setMuted(false);
    setPhase("ringing");
  }

  function hangUp() {
    setPhase("pick");
    setPeer(null);
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
          onClick={onClose}
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
                {phase === "active" ? t("НА СВЯЗИ", "CONNECTED") : phase === "ringing" ? t("ВЫЗОВ", "CALLING") : t("ЗВОНОК", "CALL")}
              </p>
              <button type="button" onClick={onClose} aria-label={t("Закрыть", "Close")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink">
                <X size={14} />
              </button>
            </div>

            {phase === "pick" ? (
              <div className="p-4">
                <h2 className="text-lg font-semibold text-ink">{t("Кому позвонить", "Call someone")}</h2>
                <p className="mt-1 text-xs text-muted">{t("Недавние контакты из кэша", "Recent contacts from cache")}</p>
                <ul className="mt-3 space-y-1">
                  {contacts.map((contact) => (
                    <li key={contact.id}>
                      <button
                        type="button"
                        onClick={() => startCall(contact)}
                        className="flex w-full items-center gap-3 rounded-[18px] px-2 py-2 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
                      >
                        <Avatar name={contact.title} id={contact.id} className="size-10" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{contact.title}</span>
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white">
                          <PhoneCall size={15} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex flex-col items-center px-4 pb-4 pt-2">
                <span className="relative grid place-items-center">
                  {phase === "ringing" && (
                    <>
                      <span className="absolute size-24 animate-ping rounded-full bg-accent/20" aria-hidden="true" />
                      <span className="absolute size-32 animate-pulse rounded-full bg-accent/10" aria-hidden="true" />
                    </>
                  )}
                  <Avatar name={peer?.title ?? ""} id={peer?.id} className="relative size-24" />
                </span>
                <p className="mt-3 max-w-full truncate text-lg font-semibold text-ink">{peer?.title}</p>
                <p className="mt-1 font-mono text-xs tabular-nums text-muted">
                  {phase === "active" ? formatDuration(seconds) : t("Вызов…", "Ringing…")}
                </p>

                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMuted((value) => !value)}
                    aria-pressed={muted}
                    aria-label={t(muted ? "Включить микрофон" : "Выключить микрофон", muted ? "Unmute microphone" : "Mute microphone")}
                    className={`grid size-12 place-items-center rounded-full transition ${muted ? "bg-danger/15 text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_35%,transparent)]" : "bg-surface/60 text-ink hover:text-accent"}`}
                  >
                    {muted ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPhase("active")}
                    disabled={phase === "active"}
                    aria-label={t("Принять звонок", "Accept call")}
                    className="grid size-14 place-items-center rounded-full bg-success text-white shadow-[0_10px_24px_color-mix(in_srgb,var(--success)_35%,transparent)] transition hover:brightness-110 disabled:opacity-40"
                  >
                    <Phone size={20} />
                  </button>

                  <button
                    type="button"
                    onClick={hangUp}
                    aria-label={t("Отклонить звонок", "Decline call")}
                    className="grid size-12 place-items-center rounded-full bg-danger text-white shadow-[0_10px_24px_color-mix(in_srgb,var(--danger)_35%,transparent)] transition hover:brightness-110"
                  >
                    <PhoneOff size={18} />
                  </button>
                </div>

                <p className="mt-4 text-center text-[10px] leading-4 text-muted">
                  {t("Демонстрация интерфейса: без реального VoIP-соединения", "UI preview: no real VoIP connection yet")}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
