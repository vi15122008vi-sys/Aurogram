import { useState } from "react";
import { Plug, ShieldCheck, Wrench, X } from "lucide-react";
import { ChannelStudio } from "../screens/ChannelStudio";
import { IntegrationsPanel } from "../screens/IntegrationsPanel";
import { AntispamScreen } from "../screens/AntispamScreen";
import { useI18n } from "../lib/i18n";

export type StudioSection = "widgets" | "stickers" | "welcome" | "media" | "scheduled";
type StudioMode = "studio" | "integrations" | "antispam";

interface StudioModalProps {
  open: boolean;
  onClose: () => void;
  channelId: number;
  channelTitle: string;
  initialSection?: StudioSection;
}

const modes: { id: StudioMode; label: string; labelEn: string; icon: typeof Wrench }[] = [
  { id: "studio", label: "Инструменты", labelEn: "Tools", icon: Wrench },
  { id: "integrations", label: "Кросс-постинг", labelEn: "Cross-posting", icon: Plug },
  { id: "antispam", label: "Антиспам", labelEn: "Antispam", icon: ShieldCheck },
];

/**
 * Полноэкранная «Студия» канала: виджеты, стикеры, медиа, календарь,
 * кросс-постинг и антиспам — вынесены из основного списка, но ничего не теряют.
 */
export function StudioModal({ open, onClose, channelId, channelTitle, initialSection = "widgets" }: StudioModalProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<StudioMode>("studio");

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Студия канала", "Channel studio")}
      className="fixed inset-0 z-50 overflow-y-auto bg-[color-mix(in_srgb,var(--canvas)_92%,transparent)] backdrop-blur-[24px]"
      onClick={onClose}
    >
      <div className="mx-auto min-h-full w-full max-w-5xl px-3 pb-10 pt-3 sm:px-5" onClick={(event) => event.stopPropagation()}>
        <div className="glass-panel sticky top-2 z-10 flex items-center gap-2 rounded-[24px] px-3 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-accent/15 text-accent"><Wrench size={16} /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{t("Студия", "Studio")}</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{channelTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Закрыть студию", "Close studio")}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div role="tablist" aria-label={t("Раздел студии")} className="glass-panel mt-3 inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
          {modes.map(({ id, label, labelEn, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${mode === id ? "bg-accent/10 text-accent" : "text-muted hover:text-ink"}`}
            >
              <Icon size={14} />{t(label, labelEn)}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {mode === "studio" && <ChannelStudio channelId={channelId} channelTitle={channelTitle} initialSection={initialSection} />}
          {mode === "integrations" && <IntegrationsPanel channelId={channelId} />}
          {mode === "antispam" && <AntispamScreen channelId={channelId} />}
        </div>
      </div>
    </div>
  );
}
