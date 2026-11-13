import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Download, Loader2, LogOut, MessageSquare, Radio, Send, Settings2, Sparkles, UserRound, Users, X } from "lucide-react";
import { ApiError, api, setBearerToken, type AiAnswer, type AuthAccount, type ProfileStats } from "../lib/api";
import { springModal } from "../lib/motion";
import { useI18n } from "../lib/i18n";

interface ProfileScreenProps {
  account: AuthAccount;
  onLogout: () => void;
  onOpenSettings: () => void;
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

/** Профиль аккаунта: активность, экспорт данных и AI-ассистент по переписке. */
export function ProfileScreen({ account, onLogout, onOpenSettings }: ProfileScreenProps) {
  const { t } = useI18n();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<AiAnswer | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.profile
      .stats()
      .then((result) => {
        if (active) {
          setStats(result);
          setError(null);
        }
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

  async function exportData() {
    setExporting(true);
    setError(null);
    try {
      const blob = await api.profile.exportData();
      saveBlob(blob, "aurogram-profile.json");
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
      if (cause instanceof ApiError && cause.status === 401) setBearerToken(null);
      setAiError(cause instanceof Error ? cause.message : t("AI не ответил"));
    } finally {
      setAiBusy(false);
    }
  }

  const name = stats?.account.name || account.name || account.phone;
  const username = stats?.account.username ?? account.username;
  const phone = stats?.account.phone || account.phone;
  const initials = name.trim().slice(0, 1).toUpperCase() || "A";

  const metrics = [
    { label: t("Сообщений", "Messages"), value: stats?.messages, icon: MessageSquare },
    { label: t("Чатов", "Chats"), value: stats?.chats, icon: Users },
    { label: t("Каналов", "Channels"), value: stats?.channels, icon: Radio },
  ];

  return (
    <section className="animate-[rise-in_240ms_ease-out]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t("ACCOUNT / PROFILE", "ACCOUNT / PROFILE")}</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink">{t("Профиль")}</h1>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t("Настройки", "Settings")}
          title={t("Настройки", "Settings")}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-accent"
        >
          <Settings2 size={17} />
        </button>
      </div>

      <div className="glass-panel mt-5 flex items-center gap-4 rounded-[28px] p-4">
        <span className="grid size-[76px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2AABEE] to-[#6366F1] text-2xl font-semibold text-white shadow-[0_12px_30px_rgb(99_102_241_/_28%)]">
          <span aria-hidden="true">{initials}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-ink">{name}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{username ? `@${username}` : t("Без username", "No username")}</p>
          <p className="mt-1 truncate font-mono text-[11px] text-muted">{phone}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-surface/60 px-4 text-xs font-medium text-ink transition hover:bg-accent/10 hover:text-accent"
        >
          <UserRound size={15} />{t("Изменить профиль")}
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-danger/10 px-4 text-xs font-medium text-danger transition hover:bg-danger/15"
        >
          <LogOut size={15} />{t("Выйти")}
        </button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-[18px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

      <div className="glass-panel mt-4 rounded-[26px] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{t("Активность")}</h2>
          {loading && <Loader2 size={14} className="animate-spin text-muted" />}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {metrics.map(({ label, value, icon: Icon }) => (
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
            {t("Экспорт данных", "Export data")}
          </button>
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[11px] font-semibold text-white transition hover:bg-accent-strong"
          >
            <Bot size={13} />{t("Спросить AI")}
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-muted">
          {t("Экспорт содержит только настройки и статистику — без текста переписки.", "The export holds settings and stats only — no message text.")}
        </p>
      </div>

      <div className="glass-panel mt-3 rounded-[26px] p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-accent/10 text-accent"><Sparkles size={16} /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{t("AI-ассистент по переписке")}</h2>
            <p className="mt-1 text-[11px] leading-4 text-muted">
              {t("Спросите, что обсуждали вчера, о чём договорились или что пропустили. AI смотрит последние 50 сообщений из кэша.", "Ask what you discussed yesterday or what you missed. AI reads the last 50 cached messages.")}
            </p>
          </div>
        </div>
      </div>

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
              aria-label={t("Спросить AI", "Ask AI")}
              className="glass-modal w-full max-w-lg p-4"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={springModal}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-[12px] bg-accent/10 text-accent"><Bot size={16} /></span>
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{t("Спросить AI", "Ask AI")}</h2>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t("по последним 50 сообщениям", "last 50 messages")}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setAiOpen(false)} aria-label={t("Закрыть")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink">
                  <X size={14} />
                </button>
              </div>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void askAi();
                }}
              >
                <input
                  autoFocus
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  maxLength={500}
                  placeholder={t("Что я обсуждал вчера?", "What did I discuss yesterday?")}
                  className="h-11 min-w-0 flex-1 rounded-[16px] bg-surface/60 px-3.5 text-sm text-ink outline-none placeholder:text-muted focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]"
                />
                <button
                  type="submit"
                  disabled={aiBusy || question.trim().length < 3}
                  className="inline-flex h-11 items-center gap-1.5 rounded-[16px] bg-accent px-4 text-xs font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
                >
                  {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </form>

              {aiError && <p role="alert" className="mt-3 rounded-[14px] bg-danger/10 px-3 py-2 text-xs text-danger">{aiError}</p>}

              {aiAnswer && (
                <div className="mt-3 rounded-[18px] bg-surface/60 p-3">
                  <p className="whitespace-pre-line text-sm leading-6 text-ink">{aiAnswer.answer}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {aiAnswer.model} · {aiAnswer.context_messages} {t("сообщений", "messages")} · {aiAnswer.context_chars} {t("символов", "chars")}
                  </p>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  t("Что я обсуждал вчера?"),
                  t("О чём договорились?"),
                  t("Что я пропустил важного?"),
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuestion(preset)}
                    className="rounded-full bg-surface/60 px-3 py-1.5 text-[11px] text-muted transition hover:text-accent"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
