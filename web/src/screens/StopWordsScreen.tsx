import { useEffect, useRef, useState } from "react";
import { Download, Plus, Search, Trash2, Upload } from "lucide-react";
import { api, type StopWord, type StopWordCategory } from "../lib/api";

interface StopWordsScreenProps {
  channelId: number;
}

const categories: { id: StopWordCategory; label: string }[] = [
  { id: "ads", label: "Реклама" },
  { id: "profanity", label: "Мат" },
  { id: "crypto", label: "Крипта" },
  { id: "casino", label: "Казино" },
  { id: "bets", label: "Ставки" },
  { id: "politics", label: "Политика" },
  { id: "custom", label: "Свои" },
];

export function StopWordsScreen({ channelId }: StopWordsScreenProps) {
  const [words, setWords] = useState<StopWord[]>([]);
  const [filter, setFilter] = useState<StopWordCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [newWord, setNewWord] = useState("");
  const [category, setCategory] = useState<StopWordCategory>("custom");
  const [isRegex, setIsRegex] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function loadWords() {
    setError(null);
    try {
      setWords(await api.channels.stopwords.list(channelId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить стоп-слова");
    }
  }

  useEffect(() => {
    void loadWords();
  }, [channelId]);

  async function addWord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const word = newWord.trim();
    if (!word) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.channels.stopwords.create(channelId, { word, category, is_regex: isRegex });
      setNewWord("");
      setIsRegex(false);
      setNotice("Стоп-слово добавлено");
      await loadWords();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось добавить слово");
    } finally {
      setBusy(false);
    }
  }

  async function toggleWord(word: StopWord) {
    if (word.id == null) return;
    setBusy(true);
    setError(null);
    try {
      await api.channels.stopwords.update(channelId, word.id, { enabled: !word.enabled });
      await loadWords();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось обновить слово");
    } finally {
      setBusy(false);
    }
  }

  async function removeWord(word: StopWord) {
    if (word.id == null || word.is_builtin) return;
    setBusy(true);
    setError(null);
    try {
      await api.channels.stopwords.remove(channelId, word.id);
      await loadWords();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить слово");
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    const format = file.name.toLowerCase().endsWith(".json") ? "json" : "txt";
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.channels.stopwords.import(channelId, format, await file.text(), category);
      setNotice(`Импортировано: ${result.imported}, пропущено: ${result.skipped}`);
      await loadWords();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось импортировать файл");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function exportFile(format: "json" | "txt") {
    setError(null);
    try {
      const blob = await api.channels.stopwords.export(channelId, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `stopwords-${channelId}.${format}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось экспортировать файл");
    }
  }

  const filtered = words.filter((word) => {
    const matchesCategory = filter === "all" || word.category === filter;
    const matchesSearch = word.word.toLocaleLowerCase().includes(search.toLocaleLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Стоп-слова</h2>
          <p className="mt-1 text-xs text-muted">{words.length} слов · встроенные и пользовательские</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void exportFile("json")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-medium hover:bg-raised"><Download size={14} />JSON</button>
          <button type="button" onClick={() => void exportFile("txt")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-medium hover:bg-raised"><Download size={14} />TXT</button>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-medium hover:bg-raised disabled:opacity-50"><Upload size={14} />Импорт</button>
          <input ref={fileInput} type="file" accept=".json,.txt,application/json,text/plain" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
        </div>
      </div>

      <form onSubmit={addWord} className="grid gap-2 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto_auto] sm:items-center">
        <input value={newWord} onChange={(event) => setNewWord(event.target.value)} maxLength={200} placeholder="Добавить слово или фразу" className="h-10 min-w-0 rounded-lg border border-line bg-raised px-3 text-sm text-ink outline-none focus:border-accent" />
        <select value={category} onChange={(event) => setCategory(event.target.value as StopWordCategory)} className="h-10 rounded-lg border border-line bg-raised px-3 text-sm text-ink outline-none focus:border-accent">
          {categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <label className="flex h-10 items-center gap-2 px-2 text-xs text-muted"><input type="checkbox" checked={isRegex} onChange={(event) => setIsRegex(event.target.checked)} className="accent-accent" />Regex</label>
        <button type="submit" disabled={busy || !newWord.trim()} aria-label="Добавить стоп-слово" className="grid size-10 place-items-center rounded-lg bg-accent text-white hover:bg-accent-strong disabled:opacity-50"><Plus size={17} /></button>
      </form>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search size={15} className="text-muted" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по словам" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <select aria-label="Категория для импорта" value={category} onChange={(event) => setCategory(event.target.value as StopWordCategory)} className="h-10 rounded-lg border border-line bg-raised px-3 text-sm text-ink outline-none sm:w-40">
          {categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setFilter("all")} className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${filter === "all" ? "border-accent bg-accent/5 text-accent" : "border-line bg-surface text-muted"}`}>Все <span className="ml-1 font-mono">{words.length}</span></button>
        {categories.map((item) => {
          const count = words.filter((word) => word.category === item.id).length;
          return <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${filter === item.id ? "border-accent bg-accent/5 text-accent" : "border-line bg-surface text-muted"}`}>{item.label} <span className="ml-1 font-mono">{count}</span></button>;
        })}
      </div>

      {error && <p role="alert" className="rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-line bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        {filtered.map((word) => (
          <span key={word.id ?? `${word.category}:${word.word}`} className={`inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${word.enabled ? "border-line bg-surface text-ink" : "border-line bg-raised text-muted"}`}>
            <input type="checkbox" checked={word.enabled} onChange={() => void toggleWord(word)} disabled={busy} aria-label={`${word.enabled ? "Отключить" : "Включить"}: ${word.word}`} className="accent-accent" />
            <span className="max-w-[220px] truncate">{word.word}</span>
            <span className="rounded-lg bg-raised px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted">{categories.find((item) => item.id === word.category)?.label ?? word.category}</span>
            {word.is_regex && <span className="font-mono text-[9px] text-accent">re</span>}
            {!word.is_builtin && <button type="button" onClick={() => void removeWord(word)} disabled={busy} aria-label={`Удалить ${word.word}`} className="grid size-5 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"><Trash2 size={12} /></button>}
          </span>
        ))}
        {!filtered.length && <p className="py-5 text-sm text-muted">Совпадений нет</p>}
      </div>
    </section>
  );
}