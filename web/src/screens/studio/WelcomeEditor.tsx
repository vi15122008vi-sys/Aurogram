import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Save, Sparkles, Users } from "lucide-react";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

interface WelcomeEditorProps {
  channelId: number;
}

/** Приветствие новичкам: текст + фото, отправляется при вступлении в чат. */
export function WelcomeEditor({ channelId }: WelcomeEditorProps) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    api.channels.welcome
      .get(channelId)
      .then((current) => {
        if (!active) return;
        setText(current.text);
        setEnabled(current.enabled);
        setHasPhoto(current.has_photo);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [channelId]);

  function pickPhoto(file: File | null | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 3 * 1024 * 1024) {
      setError(t("Фото до 3 МБ", "Photo up to 3 MB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoData(String(reader.result));
      setPhotoName(file.name);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.channels.welcome.save(channelId, {
        text: text.trim(),
        enabled,
        photo_data_url: photoData,
      });
      setHasPhoto(result.has_photo);
      setPhotoData(null);
      setPhotoName(null);
      setNotice(t("Приветствие сохранено", "Welcome saved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось сохранить"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass-panel grid gap-3 rounded-[26px] p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-accent/10 text-accent"><Users size={17} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">{t("Приветствие для новичков")}</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-muted">
            {t("Отправляется при вступлении в чат. Поддерживается {name} — подставится имя. Работает для групп и чатов обсуждений.", "Sent when someone joins. {name} is replaced with the first name. Works for groups and discussion chats.")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((value) => !value)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-accent" : "bg-[color-mix(in_srgb,var(--ink)_18%,transparent)]"}`}
          aria-label={t("Включить приветствие")}
        >
          <span className={`absolute top-0.5 size-5 rounded-full bg-white transition ${enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        maxLength={1024}
        placeholder={t("Привет, {name}! Добро пожаловать в канал. Здесь…", "Hi {name}! Welcome to the channel. Here…")}
        className="resize-none rounded-[16px] bg-surface/60 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface/60 px-3.5 text-[11px] font-medium text-ink transition hover:text-accent">
          <ImagePlus size={13} />{photoName ? photoName : hasPhoto ? t("Заменить фото") : t("Добавить фото")}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => pickPhoto(event.target.files?.[0])} />
        {photoData && <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 font-mono text-[10px] text-success"><Sparkles size={10} />{t("готово к загрузке")}</span>}
        <button type="button" onClick={() => void save()} disabled={busy} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[11px] font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}{t("Сохранить")}
        </button>
      </div>

      {error && <p role="alert" className="rounded-[14px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
      {notice && <p role="status" className="rounded-[14px] bg-success/10 px-3 py-2 text-xs text-success">{notice}</p>}
    </section>
  );
}
