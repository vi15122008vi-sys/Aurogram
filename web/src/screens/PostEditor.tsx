import { useRef, useState, type FormEvent } from "react";
import { Bold, Code2, Eye, Italic, Link2, Send, Timer } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api, type EditorPreview } from "../lib/api";

interface PostEditorProps {
  channelId: number;
  onPublished?: () => void;
}

export function PostEditor({ channelId, onPublished }: PostEditorProps) {
  const [text, setText] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [preview, setPreview] = useState<EditorPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(marker: string) {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = text.slice(start, end) || "текст";
    const next = `${text.slice(0, start)}${marker}${selected}${marker}${text.slice(end)}`;
    setText(next);
    setPreview(null);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + marker.length, start + marker.length + selected.length);
    });
  }

  function insertLink() {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = text.slice(start, end) || "ссылка";
    const insertion = `[${selected}](https://example.com)`;
    setText(`${text.slice(0, start)}${insertion}${text.slice(end)}`);
    setPreview(null);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + selected.length + 3, start + insertion.length - 1);
    });
  }

  async function showPreview() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await api.editor.preview(text));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать предпросмотр");
    } finally {
      setBusy(false);
    }
  }

  async function publish(schedule: boolean) {
    if (!text.trim() || text.length > 32768) return;
    if (schedule && !scheduleAt) {
      setError("Выберите дату и время публикации");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.editor.publish(channelId, {
        text,
        parse_mode: "md",
        schedule_at: schedule ? new Date(scheduleAt).toISOString() : null,
      });
      setText("");
      setScheduleAt("");
      setPreview(null);
      setNotice(schedule ? "Пост добавлен в расписание" : "Пост опубликован");
      onPublished?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отправить пост");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void publish(false);
  }

  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-3">
        <div>
          <h2 className="text-sm font-semibold">Новый пост</h2>
          <p className="mt-0.5 text-xs text-muted">Markdown</p>
        </div>
        <button type="button" onClick={showPreview} disabled={!text.trim() || busy} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-medium text-muted transition hover:bg-raised hover:text-ink disabled:opacity-50">
          <Eye size={14} /> Предпросмотр
        </button>
      </div>
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        <button type="button" title="Жирный" aria-label="Жирный" onClick={() => wrapSelection("**")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"><Bold size={16} /></button>
        <button type="button" title="Курсив" aria-label="Курсив" onClick={() => wrapSelection("_")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"><Italic size={16} /></button>
        <button type="button" title="Код" aria-label="Код" onClick={() => wrapSelection("`")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"><Code2 size={16} /></button>
        <button type="button" title="Ссылка" aria-label="Ссылка" onClick={insertLink} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"><Link2 size={16} /></button>
        <span className={`ml-auto font-mono text-[10px] tabular-nums ${text.length > 32768 ? "text-danger" : "text-muted"}`}>{text.length.toLocaleString("ru-RU")} / 32 768</span>
      </div>
      <form onSubmit={submit}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(event) => { setText(event.target.value); setPreview(null); setNotice(null); }}
          maxLength={32768}
          rows={7}
          placeholder="Текст публикации…"
          className="block min-h-40 w-full resize-y bg-transparent px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted"
        />
        {preview?.ok && <div className="post-markdown mx-3 mb-3 rounded-lg border border-line bg-raised p-3 text-sm leading-6"><ReactMarkdown>{text}</ReactMarkdown></div>}
        {preview?.error && <p role="alert" className="mx-3 mb-3 rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{preview.error}</p>}
        {preview?.warnings?.map((warning) => <p key={warning} className="mx-4 mb-2 text-xs text-warning">{warning}</p>)}
        {error && <p role="alert" className="mx-3 mb-3 rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        {notice && <p role="status" className="mx-3 mb-3 rounded-lg border border-line bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}
        <div className="flex flex-col gap-3 border-t border-line p-3 sm:flex-row sm:items-center">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line px-3 text-xs text-muted">
            <Timer size={15} />
            <input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} className="min-w-0 flex-1 bg-transparent font-mono text-xs text-ink outline-none" aria-label="Время отложенной публикации" />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => void publish(true)} disabled={busy || !text.trim() || !scheduleAt || text.length > 32768} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold text-ink transition hover:bg-raised disabled:opacity-50 sm:flex-none">
              <Timer size={14} /> Отложить
            </button>
            <button type="submit" disabled={busy || !text.trim() || text.length > 32768} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50 sm:flex-none">
              <Send size={14} /> Опубликовать
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}