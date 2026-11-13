import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bold, Bot, Code2, Eye, Italic, Link2, List, Send, Sparkles, Timer, Underline } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api, type AiSummary, type ChannelRecord, type EditorPreview } from "../lib/api";
import { useI18n } from "../lib/i18n";

interface PostEditorProps {
  channelId: number;
  onPublished?: () => void;
  /** Режим «Отложить»: сразу фокусируем выбор времени публикации. */
  focusSchedule?: boolean;
}

export function PostEditor({ channelId, onPublished, focusSchedule = false }: PostEditorProps) {
  const { t, locale } = useI18n();
  const [text, setText] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<number[]>([channelId]);
  const [postButtons, setPostButtons] = useState<{ text: string; url: string; kind: "url" | "callback"; callbackData: string }[]>([]);
  const [preview, setPreview] = useState<EditorPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [premiumNotice, setPremiumNotice] = useState<string | null>(null);
  const [premium, setPremium] = useState(false);
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scheduleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusSchedule) return;
    scheduleRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    scheduleRef.current?.focus();
  }, [focusSchedule]);

  useEffect(() => {
    let mounted = true;
    api.editor.capabilities()
      .then((capabilities) => { if (mounted) setPremium(capabilities.headings); })
      .catch(() => { if (mounted) setPremium(false); });
    return () => { mounted = false; };
  }, []);

  function wrapSelection(before: string, after = before) {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = text.slice(start, end) || t("текст");
    const next = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
    setText(next);
    setPreview(null);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function insertBlockPrefix(prefix: string) {
    const input = inputRef.current;
    if (!input) return;
    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
    const nextLineBreak = text.indexOf("\n", selectionEnd);
    const lineEnd = nextLineBreak < 0 ? text.length : nextLineBreak;
    const content = text.slice(lineStart, lineEnd);
    const next = `${text.slice(0, lineStart)}${prefix}${content}${text.slice(lineEnd)}`;
    setText(next);
    setPreview(null);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(selectionStart + prefix.length, selectionEnd + prefix.length);
    });
  }

  function insertHeading(level: 1 | 2 | 3) {
    if (!premium) {
      setPremiumNotice(t("Для отправки заголовков нужен Telegram Premium"));
      return;
    }
    setPremiumNotice(null);
    insertBlockPrefix(`${"#".repeat(level)} `);
  }

  function insertLink() {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = text.slice(start, end) || t("ссылка");
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
      setError(t(cause instanceof Error ? cause.message : "Не удалось создать предпросмотр"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    api.channels
      .list()
      .then((list) => {
        if (!active) return;
        setChannels(list);
        setSelectedChannels((current) =>
          current.includes(channelId) ? current : [channelId, ...current],
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [channelId]);

  function toggleChannel(id: number) {
    setSelectedChannels((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function publish(schedule: boolean) {
    if (!text.trim() || text.length > 32768) return;
    if (schedule && !scheduleAt) {
      setError(t("Выберите дату и время публикации"));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setPremiumNotice(null);
    try {
      const targets = selectedChannels.length ? selectedChannels : [channelId];
      const failures: string[] = [];
      for (const target of targets) {
        try {
          await api.editor.publish(target, {
            text,
            parse_mode: "md",
            schedule_at: schedule ? new Date(scheduleAt).toISOString() : null,
            buttons: postButtons
              .filter((item) => item.text.trim() && (item.kind === "callback" ? item.callbackData.trim() : /^https?:\/\//.test(item.url.trim())))
              .map((item) =>
                item.kind === "callback"
                  ? { text: item.text.trim(), callback_data: item.callbackData.trim() }
                  : { text: item.text.trim(), url: item.url.trim() },
              ),
          });
        } catch (cause) {
          failures.push(`${target}: ${cause instanceof Error ? cause.message : "error"}`);
        }
      }
      if (failures.length === targets.length) {
        throw new Error(failures.join("; "));
      }
      setText("");
      setScheduleAt("");
      setPreview(null);
      setNotice(
        targets.length > 1
          ? `${schedule ? t("Запланировано", "Scheduled") : t("Опубликовано", "Published")}: ${targets.length - failures.length}/${targets.length}`
          : schedule ? t("Пост добавлен в расписание") : t("Пост опубликован"),
      );
      if (failures.length) setError(failures.join("; "));
      onPublished?.();
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : "Не удалось отправить пост"));
    } finally {
      setBusy(false);
    }
  }

  async function summarize() {
    if (!text.trim()) return;
    setSummaryBusy(true);
    setSummaryError(null);
    try {
      setSummary(await api.ai.summarize({ text, sentences: 4 }));
    } catch (cause) {
      setSummaryError(cause instanceof Error ? cause.message : t("Не удалось сделать пересказ", "Could not summarize"));
    } finally {
      setSummaryBusy(false);
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
          <h2 className="text-sm font-semibold">{t("Новый пост")}</h2>
          <p className="mt-0.5 text-xs text-muted">{t("Markdown")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void summarize()}
            disabled={!text.trim() || summaryBusy}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-accent/10 px-3 text-xs font-medium text-accent transition hover:bg-accent/15 disabled:opacity-50"
            title={t("Краткий пересказ (AI)", "AI summary")}
          >
            <Bot size={14} /> {summaryBusy ? t("Сокращаем…", "Summarizing…") : t("Кратко", "Summary")}
          </button>
          <button type="button" onClick={showPreview} disabled={!text.trim() || busy} className="inline-flex h-9 items-center gap-2 rounded-full border border-line px-3 text-xs font-medium text-muted transition hover:bg-raised hover:text-ink disabled:opacity-50">
            <Eye size={14} /> {t("Предпросмотр")}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
        <button type="button" title={t("Жирный")} aria-label={t("Жирный")} onClick={() => wrapSelection("**")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"><Bold size={16} /></button>
        <button type="button" title={t("Курсив")} aria-label={t("Курсив")} onClick={() => wrapSelection("_")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"><Italic size={16} /></button>
        <button type="button" title={t("Подчёркивание")} aria-label={t("Подчёркивание")} onClick={() => wrapSelection("<u>", "</u>")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"><Underline size={16} /></button>
        <button type="button" title={t("Код")} aria-label={t("Код")} onClick={() => wrapSelection("`")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"><Code2 size={16} /></button>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        {([1, 2, 3] as const).map((level) => (
          <button key={level} type="button" title={t(`Заголовок H${level}`)} aria-label={t(`Заголовок H${level}`)} onClick={() => insertHeading(level)} className={`grid size-8 place-items-center rounded-lg font-mono text-[10px] font-semibold transition ${premium ? "text-muted hover:bg-raised hover:text-ink" : "text-muted/70 hover:bg-accent/10 hover:text-accent"}`}>H{level}</button>
        ))}
        <button type="button" title={t("Маркированный список")} aria-label={t("Маркированный список")} onClick={() => insertBlockPrefix("- ")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"><List size={16} /></button>
        <button type="button" title={t("Ссылка")} aria-label={t("Ссылка")} onClick={insertLink} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"><Link2 size={16} /></button>
        <span className={`ml-auto font-mono text-[10px] tabular-nums ${text.length > 32768 ? "text-danger" : "text-muted"}`}>{text.length.toLocaleString(locale === "ru" ? "ru-RU" : "en-US")} / 32,768</span>
      </div>
      <form onSubmit={submit}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(event) => { setText(event.target.value); setPreview(null); setNotice(null); setPremiumNotice(null); }}
          maxLength={32768}
          rows={7}
          placeholder={t("Текст публикации…")}
          className="block min-h-40 w-full resize-y bg-transparent px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted"
        />
        {preview?.ok && <div className="post-markdown mx-3 mb-3 rounded-lg border border-line bg-raised p-3 text-sm leading-6"><ReactMarkdown>{text}</ReactMarkdown></div>}
        {preview?.error && <p role="alert" className="mx-3 mb-3 rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{t(preview.error)}</p>}
        {preview?.warnings?.map((warning) => <p key={warning} className="mx-4 mb-2 text-xs text-warning">{t(warning)}</p>)}
        {summary && (
          <div className="mx-3 mb-3 rounded-[18px] bg-accent/10 p-3 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_18%,transparent)]">
            <div className="flex items-center gap-2 text-[11px] font-medium text-accent">
              <Bot size={13} />
              {t("Краткий пересказ", "AI summary")}
              <span className="font-mono text-[10px] text-muted">· {summary.model} · {summary.source_chars} {t("симв.", "chars")}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{summary.summary}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setText(summary.summary); setPreview(null); setSummary(null); }}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[11px] font-semibold text-white transition hover:bg-accent-strong"
              >
                {t("Заменить текст", "Replace text")}
              </button>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(summary.summary)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface/60 px-3 text-[11px] font-medium text-ink transition hover:text-accent"
              >
                {t("Копировать", "Copy")}
              </button>
              <button
                type="button"
                onClick={() => setSummary(null)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium text-muted transition hover:text-ink"
              >
                {t("Скрыть", "Hide")}
              </button>
            </div>
          </div>
        )}
        {summaryError && <p role="alert" className="mx-3 mb-3 rounded-[18px] bg-danger/10 px-3 py-2 text-sm text-danger">{summaryError}</p>}
        {error && <p role="alert" className="mx-3 mb-3 rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        {premiumNotice && <div role="status" className="mx-3 mb-3 flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/10 px-3 py-2.5 text-sm text-ink"><Sparkles size={16} className="mt-0.5 shrink-0 text-accent" /><span>{premiumNotice}</span></div>}
        {notice && <p role="status" className="mx-3 mb-3 rounded-lg border border-line bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}
        <div className="border-t border-line px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Добавить кнопку</p>
            <button
              type="button"
              onClick={() => setPostButtons((current) => [...current, { text: "", url: "", kind: "url" as "url" | "callback", callbackData: "" }].slice(0, 10))}
              className="inline-flex h-7 items-center rounded-full bg-accent/10 px-2.5 text-[11px] font-medium text-accent transition hover:bg-accent/15"
            >
              + Кнопка
            </button>
          </div>
          {postButtons.length === 0 ? (
            <p className="mt-1 text-[10px] text-muted">Inline-кнопки под постом: текст + ссылка (до 10).</p>
          ) : (
            <div className="mt-2 grid gap-1.5">
              {postButtons.map((button, index) => (
                <div key={index} className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={button.kind}
                    onChange={(event) => setPostButtons((current) => current.map((item, i) => i === index ? { ...item, kind: event.target.value as "url" | "callback" } : item))}
                    className="h-8 rounded-[10px] bg-surface/60 px-2 text-[11px] text-ink outline-none"
                    aria-label="Тип кнопки"
                  >
                    <option value="url">URL</option>
                    <option value="callback">Callback</option>
                  </select>
                  <input
                    value={button.text}
                    onChange={(event) => setPostButtons((current) => current.map((item, i) => i === index ? { ...item, text: event.target.value } : item))}
                    placeholder="Сайт"
                    maxLength={64}
                    className="h-8 w-28 rounded-[10px] bg-surface/60 px-2 text-[11px] text-ink outline-none"
                  />
                  <input
                    value={button.kind === "callback" ? button.callbackData : button.url}
                    onChange={(event) => setPostButtons((current) => current.map((item, i) => i === index ? item.kind === "callback" ? { ...item, callbackData: event.target.value } : { ...item, url: event.target.value } : item))}
                    placeholder={button.kind === "callback" ? "action:start" : "https://example.com"}
                    className="h-8 min-w-0 flex-1 rounded-[10px] bg-surface/60 px-2 font-mono text-[11px] text-ink outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setPostButtons((current) => current.filter((_, i) => i !== index))}
                    aria-label="Удалить кнопку"
                    className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-danger/10 text-danger"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-line px-3 py-2.5">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Каналы для публикации</p>
          <div className="flex flex-wrap gap-1.5">
            {(channels.length ? channels : [{ id: channelId, title: `#${channelId}` } as ChannelRecord]).map((channel) => {
              const active = selectedChannels.includes(channel.id);
              return (
                <button
                  key={channel.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleChannel(channel.id)}
                  className={`inline-flex max-w-[220px] items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition ${active ? "bg-accent/10 text-accent" : "bg-surface/50 text-muted hover:text-ink"}`}
                >
                  <span className={`grid size-3.5 place-items-center rounded-[4px] border text-[9px] ${active ? "border-accent bg-accent text-white" : "border-[color-mix(in_srgb,var(--ink)_25%,transparent)]"}`}>
                    {active ? "✓" : ""}
                  </span>
                  <span className="truncate">{channel.title}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-line p-3 sm:flex-row sm:items-center">
          <label className={`flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface/60 px-3.5 text-xs transition ${focusSchedule && !scheduleAt ? "text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_40%,transparent)]" : "text-muted"}`}>
            <Timer size={15} />
            <input ref={scheduleRef} type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} className="min-w-0 flex-1 bg-transparent font-mono text-xs text-ink outline-none" aria-label={t("Время отложенной публикации")} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => void publish(true)} disabled={busy || !text.trim() || !scheduleAt || text.length > 32768} className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold transition disabled:opacity-50 sm:flex-none ${focusSchedule && !scheduleAt ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_22%,transparent)]" : "bg-surface/60 text-ink hover:bg-accent/10 hover:text-accent"}`}>
              <Timer size={14} /> {t("Отложить")}
            </button>
            <button type="submit" disabled={busy || !text.trim() || text.length > 32768} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 text-xs font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50 sm:flex-none">
              <Send size={14} /> {t("Опубликовать")}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
