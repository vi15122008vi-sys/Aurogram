import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, Scissors, Send, Sparkles, X } from "lucide-react";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { springModal } from "../../lib/motion";

interface StickerWizardProps {
  channelId?: number;
}

interface CreatedPack {
  name: string;
  link: string;
  removedBackground: boolean;
}

/** Трёхшаговый мастер стикерпака: фото → превью/rembg → публикация через бота. */
export function StickerWizard({ channelId }: StickerWizardProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [title, setTitle] = useState("Aurogram stickers");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintSent, setHintSent] = useState(false);
  const [created, setCreated] = useState<CreatedPack | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function reset() {
    setStep(1);
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setRemoveBg(true);
    setTitle("Aurogram stickers");
    setError(null);
    setCreated(null);
    setHintSent(false);
  }

  async function openWizard() {
    reset();
    setOpen(true);
    // Бот присылает в личку подсказку «скинь картинку».
    try {
      const result = await api.stickers.hint();
      setHintSent(result.sent);
    } catch {
      setHintSent(false);
    }
  }

  function acceptFile(next: File | null | undefined) {
    if (!next || !next.type.startsWith("image/")) {
      setError(t("Нужно изображение: JPEG или PNG", "An image is required: JPEG or PNG"));
      return;
    }
    setError(null);
    setFile(next);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(next));
    setStep(2);
  }

  async function publish() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.stickers.create(file, { title: title.trim() || "Aurogram stickers", removeBg });
      setCreated({ name: result.name, link: result.link, removedBackground: result.removed_background });
      setStep(3);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось создать стикерпак"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="glass-panel flex flex-wrap items-center gap-3 rounded-[26px] p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-accent/10 text-accent"><Sparkles size={18} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">{t("Создать стикерпак")}</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-muted">
            {t("Загрузите фото — бот уберёт фон, соберёт стикер 512×512 и пришлёт ссылку в личку.", "Upload a photo — the bot removes the background, builds a 512×512 sticker and DMs you the link.")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openWizard()}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-semibold text-white transition hover:bg-accent-strong"
        >
          <ImagePlus size={14} />{t("Создать стикерпак")}
        </button>
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
              aria-label={t("Создать стикерпак")}
              className="glass-modal w-full max-w-lg p-4"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={springModal}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">{t("Создать стикерпак")}</h2>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {t("Шаг", "Step")} {step}/3{channelId ? ` · #${channelId}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label={t("Закрыть")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink">
                  <X size={14} />
                </button>
              </div>

              <div className="mt-3 flex gap-1" aria-hidden="true">
                {[1, 2, 3].map((value) => (
                  <span key={value} className={`h-1 flex-1 rounded-full transition ${value <= step ? "bg-accent" : "bg-[color-mix(in_srgb,var(--ink)_12%,transparent)]"}`} />
                ))}
              </div>

              {step === 1 && (
                <div className="mt-4">
                  <div
                    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      acceptFile(event.dataTransfer.files?.[0]);
                    }}
                    className={`grid place-items-center gap-2 rounded-[20px] border border-dashed p-8 text-center transition ${dragging ? "border-accent bg-accent/10" : "border-[color-mix(in_srgb,var(--ink)_14%,transparent)] bg-surface/40"}`}
                  >
                    <ImagePlus size={26} className="text-accent" />
                    <p className="text-sm font-medium text-ink">{t("Перетащите фото сюда")}</p>
                    <p className="text-[11px] text-muted">{t("JPEG или PNG, до 8 МБ", "JPEG or PNG, up to 8 MB")}</p>
                    <button type="button" onClick={() => inputRef.current?.click()} className="mt-1 inline-flex h-9 items-center rounded-full bg-surface/70 px-3.5 text-[11px] font-medium text-ink transition hover:text-accent">
                      {t("Выбрать файл")}
                    </button>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => acceptFile(event.target.files?.[0])}
                    />
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-muted">
                    {hintSent
                      ? t("Бот уже прислал подсказку в личку — можно отправить фото и туда.", "The bot already sent a hint to your DM — you can send the photo there too.")
                      : t("Подсказка: бот может принять фото и в личке.", "Hint: the bot can also accept the photo in DM.")}
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="mt-4 grid gap-3">
                  <div className="grid place-items-center rounded-[20px] bg-[repeating-conic-gradient(from_0deg,rgba(255,255,255,0.06)_0deg_90deg,rgba(0,0,0,0.12)_90deg_180deg)] bg-[length:18px_18px] p-3">
                    {preview && <img src={preview} alt="" className="max-h-56 rounded-[14px] object-contain" />}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink"><Scissors size={13} className="text-accent" />{t("Удалить фон (rembg)")}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={removeBg}
                      onClick={() => setRemoveBg((value) => !value)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${removeBg ? "bg-accent" : "bg-[color-mix(in_srgb,var(--ink)_18%,transparent)]"}`}
                    >
                      <span className={`absolute top-0.5 size-5 rounded-full bg-white transition ${removeBg ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  </div>
                  <label className="grid gap-1.5 text-[11px] text-muted">
                    {t("Название пака")}
                    <input value={title} maxLength={64} onChange={(event) => setTitle(event.target.value)} className="h-10 rounded-[14px] bg-surface/60 px-3 text-sm text-ink outline-none" />
                  </label>
                </div>
              )}

              {step === 3 && created && (
                <div className="mt-4 grid gap-3">
                  <div className="flex items-center gap-2 rounded-[18px] bg-success/10 px-3 py-2.5 text-sm font-medium text-success">
                    <Check size={16} />{t("Стикерпак создан!")}
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {created.name} · {created.removedBackground ? t("фон удалён", "background removed") : t("фон без изменений", "background untouched")}
                  </p>
                  <a
                    href={created.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[14px] bg-accent text-xs font-semibold text-white transition hover:bg-accent-strong"
                  >
                    <Send size={14} />{t("Открыть в Telegram")}
                  </a>
                  <p className="text-[10px] leading-4 text-muted">{t("Ссылку также прислал бот в личку.", "The bot also sent this link to your DM.")}</p>
                </div>
              )}

              {error && <p role="alert" className="mt-3 rounded-[14px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => (step === 1 ? setOpen(false) : setStep((value) => (value - 1) as 1 | 2 | 3))}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface/60 px-3.5 text-[11px] font-medium text-muted transition hover:text-ink"
                >
                  <ArrowLeft size={13} />{step === 1 ? t("Отмена") : t("Назад")}
                </button>
                {step === 2 && (
                  <button
                    type="button"
                    onClick={() => void publish()}
                    disabled={busy || !file}
                    className="inline-flex h-10 items-center gap-1.5 rounded-[14px] bg-accent px-4 text-xs font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    {t("Опубликовать")}
                  </button>
                )}
                {step === 3 && (
                  <button type="button" onClick={() => { reset(); setOpen(false); }} className="inline-flex h-10 items-center rounded-[14px] bg-surface/60 px-4 text-xs font-medium text-ink">
                    {t("Готово")}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
