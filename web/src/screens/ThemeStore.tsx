import { Check, Palette } from "lucide-react";
import { useI18n } from "../lib/i18n";

export interface ThemeStoreItem {
  id: string;
  name: string;
  surface: string;
  accent: string;
}

interface ThemeStoreProps {
  themes: ThemeStoreItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ThemeStore({ themes, selectedId, onSelect }: ThemeStoreProps) {
  const { t } = useI18n();
  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t("APPEARANCE")}</p>
      <h1 className="mt-2 text-[28px] font-semibold text-ink">{t("Темы")}</h1>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {themes.map((theme) => {
          const selected = theme.id === selectedId;
          return <button key={theme.id} type="button" onClick={() => onSelect(theme.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selected ? "border-accent bg-accent/5" : "border-line bg-surface"}`}><span className="grid size-10 place-items-center rounded-lg" style={{ backgroundColor: theme.surface, color: theme.accent }}><Palette size={17} /></span><span className="flex-1 text-sm font-medium text-ink">{t(theme.name)}</span>{selected && <Check size={16} className="text-accent" />}</button>;
        })}
        {!themes.length && <p className="text-sm text-muted">{t("Темы недоступны")}</p>}
      </div>
    </section>
  );
}
