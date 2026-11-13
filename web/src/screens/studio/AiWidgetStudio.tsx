import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Check, Copy, Loader2, Sparkles, X } from "lucide-react";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { GlassButton } from "../../components/Buttons";
import { springModal } from "../../lib/motion";

interface AiWidgetStudioProps {
  channelId: number;
}

/** «Создать с AI»: промпт → автономный HTML-виджет с превью и копированием. */
export function AiWidgetStudio({ channelId }: AiWidgetStudioProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [widgetButtons, setWidgetButtons] = useState<{ text: string; callback_data: string }[]>([]);
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    const value = prompt.trim();
    if (value.length < 5) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const result = await api.ai.widget(value, channelId);
      setHtml(result.html);
      setWidgetButtons(result.buttons ?? []);
      setWidgetUrl(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("AI не смог собрать виджет"));
    } finally {
      setBusy(false);
    }
  }

  async function copyHtml() {
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <section className="glass-panel flex flex-wrap items-center gap-3 rounded-[24px] p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-accent/10 text-accent"><Bot size={17} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{t("Создать с AI")}</p>
          <p className="mt-0.5 text-[11px] text-muted">{t("Опишите виджет словами — AI соберёт HTML с инлайн-стилями и логикой.", "Describe a widget — AI builds self-contained HTML.")}</p>
        </div>
        <GlassButton tone="accent" onClick={() => setOpen(true)} className="h-9 px-3.5 text-[11px] font-semibold">
          <Sparkles size={13} />{t("Создать с AI")}
        </GlassButton>
      </section>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t("Создать виджет с AI")}
              className="glass-modal flex max-h-[88vh] w-full max-w-2xl flex-col p-4"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={springModal}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">{t("Создать виджет с AI")}</h2>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">DeepSeek · HTML</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label={t("Закрыть")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink">
                  <X size={14} />
                </button>
              </div>

              <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void generate(); }}>
                <input
                  autoFocus
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  maxLength={500}
                  placeholder={t("Опрос про фильмы")}
                  className="h-10 min-w-0 flex-1 rounded-[14px] bg-surface/60 px-3 text-sm text-ink outline-none placeholder:text-muted"
                />
                <button type="submit" disabled={busy || prompt.trim().length < 5} className="inline-flex h-10 items-center gap-1.5 rounded-[14px] bg-accent px-4 text-xs font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {t("Собрать")}
                </button>
              </form>

              {error && <p role="alert" className="mt-3 rounded-[14px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

              {html && (
                <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2">
                  <div className="rounded-[18px] bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] p-2">
                    <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{t("Так это увидят в Telegram", "This is how it looks in Telegram")}</p>
                    <div className="overflow-hidden rounded-[14px] bg-surface/70 p-2">
                      <iframe
                        title={t("Превью виджета")}
                        srcDoc={html}
                        sandbox="allow-scripts"
                        className="min-h-[220px] w-full rounded-[10px] bg-black/20"
                      />
                    </div>
                    {widgetButtons.length > 0 && (
                      <div className="mt-1.5 grid gap-1">
                        {widgetButtons.map((button) => (
                          <span key={button.callback_data} className="rounded-[10px] bg-accent/10 px-2 py-1.5 text-center text-[11px] font-medium text-accent">
                            {button.text}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted">
                      {widgetUrl ? <a href={widgetUrl} target="_blank" rel="noreferrer" className="text-accent underline">{widgetUrl}</a> : `${html.length} ${t("символов", "chars")}`}
                    </span>
                    <div className="flex gap-2">
                      <GlassButton tone="glass" onClick={() => void copyHtml()} className="h-9 px-3.5 text-[11px] font-medium">
                        {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                        {copied ? t("Скопировано") : t("Скопировать HTML")}
                      </GlassButton>
                    </div>
                  </div>
                  <p className="text-[10px] leading-4 text-muted">
                    {t("Виджет автономный: сохраните HTML или вставьте его в свой хостинг виджетов, затем опубликуйте ссылку в канале.", "The widget is self-contained: save the HTML or upload it to your widget host, then post the link in the channel.")}
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
