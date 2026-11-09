import { Check } from "lucide-react";
import { useState } from "react";
import { applyTheme, themeList, type ThemeId } from "../lib/themes";

interface ThemePickerProps {
  selectedId?: ThemeId;
  onSelect?: (themeId: ThemeId) => void;
}

export function ThemePicker({ selectedId, onSelect }: ThemePickerProps) {
  const [internalSelection, setInternalSelection] = useState<ThemeId>("aurogram");
  const selected = selectedId ?? internalSelection;

  function choose(themeId: ThemeId) {
    if (selectedId === undefined) setInternalSelection(themeId);
    applyTheme(themeId);
    onSelect?.(themeId);
  }

  return (
    <section aria-label="Выбор темы">
      <div className="grid grid-cols-2 gap-3">
        {themeList.map((theme) => {
          const active = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={active}
              onClick={() => choose(theme.id)}
              className={`overflow-hidden rounded-xl border text-left transition ${active ? "border-accent" : "border-line hover:border-muted"}`}
            >
              <span className="block p-3" style={{ backgroundColor: theme.colors.canvas }}>
                <span className="flex h-16 items-end gap-1.5 rounded-lg border p-2" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.line }}>
                  <span className="h-7 w-2/3 rounded-lg" style={{ backgroundColor: theme.colors.raised }} />
                  <span className="ml-auto h-5 w-1/4 rounded-lg" style={{ backgroundColor: theme.colors.accent }} />
                </span>
                <span className="mt-2 flex gap-1.5">
                  {[theme.colors.accent, theme.colors.success, theme.colors.warning, theme.colors.ghost].map((color) => <span key={color} className="size-3 rounded-full" style={{ backgroundColor: color }} />)}
                </span>
              </span>
              <span className="flex min-h-10 items-center justify-between gap-2 bg-surface px-3 py-2">
                <span className="truncate text-xs font-medium text-ink">{theme.name}</span>
                {active && <Check size={14} className="shrink-0 text-accent" />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}