import { useEffect, useState } from "react";
import { Save, ShieldAlert } from "lucide-react";
import { api, type AntispamSettings } from "../lib/api";
import { StopWordsScreen } from "./StopWordsScreen";

interface AntispamScreenProps {
  channelId: number;
}

type ToggleKey = "enabled" | "stem" | "case_sensitive" | "exact_match" | "allow_subdomains" | "allow_raw_ip" | "allow_shortlinks" | "flood_enabled" | "caps_enabled" | "emoji_enabled" | "notify_author_dm" | "mute_on_repeat" | "ban_on_third" | "check_in_media_captions";

const toggleFields: { key: ToggleKey; label: string; note: string }[] = [
  { key: "stem", label: "Стемминг стоп-слов", note: "Сопоставлять словоформы" },
  { key: "case_sensitive", label: "Учитывать регистр", note: "Различать заглавные и строчные буквы" },
  { key: "exact_match", label: "Точное совпадение", note: "Не искать слово внутри другого слова" },
  { key: "allow_subdomains", label: "Разрешать поддомены", note: "Учитывать основной домен в allowlist" },
  { key: "allow_raw_ip", label: "Разрешать IP-адреса", note: "Иначе ссылки на IP блокируются" },
  { key: "allow_shortlinks", label: "Разрешать сокращатели ссылок", note: "При отключении shortlinks блокируются" },
  { key: "flood_enabled", label: "Антифлуд", note: "Ограничивать частые сообщения" },
  { key: "caps_enabled", label: "Капс", note: "Проверять долю заглавных букв" },
  { key: "emoji_enabled", label: "Эмодзи-спам", note: "Ограничивать количество эмодзи" },
  { key: "notify_author_dm", label: "Уведомлять автора", note: "Отправлять личное уведомление при модерации" },
  { key: "mute_on_repeat", label: "Мут при повторе", note: "Применять временное ограничение" },
  { key: "ban_on_third", label: "Бан при третьем нарушении", note: "Блокировать после повторных нарушений" },
  { key: "check_in_media_captions", label: "Проверять подписи к медиа", note: "Анализировать текст в caption" },
];

function NumberField({ label, value, min = 0, max, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return <label className="block text-xs text-muted">{label}<input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2.5 font-mono text-xs text-ink outline-none focus:border-accent" /></label>;
}

export function AntispamScreen({ channelId }: AntispamScreenProps) {
  const [settings, setSettings] = useState<AntispamSettings | null>(null);
  const [subtab, setSubtab] = useState<"rules" | "words">("rules");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.channels.antispam.get(channelId)
      .then((result) => { if (active) setSettings(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Не удалось загрузить настройки"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [channelId]);

  function update<K extends keyof AntispamSettings>(key: K, value: AntispamSettings[K]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setSettings(await api.channels.antispam.save(channelId, settings));
      setNotice("Настройки сохранены");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить настройки");
    } finally {
      setBusy(false);
    }
  }

  if (subtab === "words") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
            <button type="button" onClick={() => setSubtab("rules")} className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-raised">Правила</button>
            <button type="button" className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">Стоп-слова</button>
          </div>
        </div>
        <StopWordsScreen channelId={channelId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          <button type="button" className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">Правила</button>
          <button type="button" onClick={() => setSubtab("words")} className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-raised">Стоп-слова</button>
        </div>
        <button type="button" onClick={save} disabled={loading || busy || !settings} className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-strong disabled:opacity-50"><Save size={14} />{busy ? "Сохраняем…" : "Сохранить"}</button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-line bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}
      {loading || !settings ? <p className="py-8 text-center text-sm text-muted">Загружаем настройки…</p> : <>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-3">
          <span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-accent/10 text-accent"><ShieldAlert size={18} /></span><span><span className="block text-sm font-semibold">Антиспам</span><span className="mt-1 block text-xs text-muted">Модерация linked discussion чата</span></span></span>
          <input type="checkbox" checked={settings.enabled} onChange={(event) => update("enabled", event.target.checked)} className="size-4 accent-accent" />
        </label>

        <div className="grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2">
          <label className="block text-xs text-muted">Уровень защиты<select value={settings.level} onChange={(event) => update("level", event.target.value as AntispamSettings["level"])} className="mt-1 h-10 w-full rounded-lg border border-line bg-raised px-3 text-sm text-ink outline-none"><option value="soft">Мягкий</option><option value="medium">Средний</option><option value="hard">Строгий</option></select></label>
          <label className="block text-xs text-muted">Политика ссылок<select value={settings.links_policy} onChange={(event) => update("links_policy", event.target.value as AntispamSettings["links_policy"])} className="mt-1 h-10 w-full rounded-lg border border-line bg-raised px-3 text-sm text-ink outline-none"><option value="blacklist_only">Blocklist</option><option value="allowlist_only">Только allowlist</option><option value="block_all">Блокировать все</option></select></label>
          <NumberField label="Порог флуда, сообщений" value={settings.flood_threshold} min={1} max={100} onChange={(value) => update("flood_threshold", value)} />
          <NumberField label="Окно флуда, секунд" value={settings.flood_window_sec} min={1} max={3600} onChange={(value) => update("flood_window_sec", value)} />
          <NumberField label="Минимум для проверки капса" value={settings.caps_min_len} min={1} max={32768} onChange={(value) => update("caps_min_len", value)} />
          <NumberField label="Доля заглавных, 0–1" value={settings.caps_ratio} min={0} max={1} step={0.05} onChange={(value) => update("caps_ratio", value)} />
          <NumberField label="Максимум эмодзи" value={settings.emoji_max} min={0} max={1000} onChange={(value) => update("emoji_max", value)} />
          <NumberField label="Окно дубликатов, минут" value={settings.duplicate_window_min} min={0} max={1440} onChange={(value) => update("duplicate_window_min", value)} />
          <NumberField label="Испытательный срок, часов" value={settings.new_user_probation_hours} min={0} max={720} onChange={(value) => update("new_user_probation_hours", value)} />
          <NumberField label="Длительность мута, минут" value={settings.mute_minutes} min={1} max={10080} onChange={(value) => update("mute_minutes", value)} />
        </div>

        <div className="grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2">
          <label className="block text-xs text-muted">Пользовательская allowlist<textarea value={settings.allowlist_custom.join("\n")} onChange={(event) => update("allowlist_custom", event.target.value.split(/[\n,]+/).map((domain) => domain.trim()).filter(Boolean))} rows={3} placeholder="example.com" className="mt-1 w-full resize-y rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent" /></label>
          <label className="block text-xs text-muted">Исключить из глобальной allowlist<textarea value={settings.allowlist_global_disabled.join("\n")} onChange={(event) => update("allowlist_global_disabled", event.target.value.split(/[\n,]+/).map((domain) => domain.trim()).filter(Boolean))} rows={3} placeholder="domain.example" className="mt-1 w-full resize-y rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent" /></label>
        </div>

        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {toggleFields.filter((item) => item.key !== "enabled").map((field) => (
            <label key={field.key} className="flex items-center justify-between gap-4 px-3 py-3">
              <span><span className="block text-sm font-medium">{field.label}</span><span className="mt-0.5 block text-xs text-muted">{field.note}</span></span>
              <input type="checkbox" checked={settings[field.key] as boolean} onChange={(event) => update(field.key, event.target.checked)} className="size-4 shrink-0 accent-accent" />
            </label>
          ))}
        </div>
      </>}
    </div>
  );
}