import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { storyAvatarUrl, storyMediaUrl, type StoryPeer } from "../lib/api";
import { useI18n } from "../lib/i18n";

interface StoryViewerProps {
  stories: StoryPeer[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** Полноэкранный просмотр истории: медиа с /chats/stories/{id}/media или заглушка. */
export function StoryViewer({ stories, index, onIndexChange, onClose }: StoryViewerProps) {
  const { t } = useI18n();
  const story = stories[index];
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [story?.peer_id, story?.latest_story_id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (event.key === "ArrowRight" && index < stories.length - 1) onIndexChange(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, stories.length, onClose, onIndexChange]);

  if (!story) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("История", "Story")}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-3 backdrop-blur-[20px]"
      onClick={onClose}
    >
      <div
        className="glass-modal relative flex h-[min(78vh,640px)] w-full max-w-sm flex-col overflow-hidden p-0"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex-1 bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]">
          {story.count > 0 && !failed ? (
            <img
              src={storyMediaUrl(story.peer_id, story.latest_story_id)}
              alt={story.title}
              onError={() => setFailed(true)}
              className="size-full object-contain"
            />
          ) : (
            <div className="grid size-full place-items-center bg-gradient-to-br from-fuchsia-500/30 via-accent/30 to-amber-400/30">
              <div className="flex flex-col items-center gap-2 text-ink/80">
                <ImageOff size={28} />
                <span className="text-sm font-semibold">{story.title}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{t("нет медиа", "no media")}</span>
              </div>
            </div>
          )}

          <div className="absolute inset-x-2 top-2 flex items-center gap-2">
            <span className="size-9 shrink-0 overflow-hidden rounded-full bg-surface/70">
              <img
                src={storyAvatarUrl(story.peer_id)}
                alt=""
                onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = "none"; }}
                className="size-full object-cover"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white drop-shadow">{story.title}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/70">
                {index + 1}/{stories.length} · {story.count} {t("историй", "stories")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("Закрыть историю", "Close story")}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-black/40 text-white/90 transition hover:bg-black/60"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 bg-surface/60 px-2 py-2">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onIndexChange(index - 1)}
            aria-label={t("Предыдущая история")}
            className="grid size-9 place-items-center rounded-full bg-surface/70 text-ink transition disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex flex-1 justify-center gap-1">
            {stories.map((item, position) => (
              <span
                key={item.peer_id}
                aria-hidden="true"
                className={`h-1 w-6 rounded-full transition ${position === index ? "bg-accent" : "bg-[color-mix(in_srgb,var(--ink)_15%,transparent)]"}`}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={index === stories.length - 1}
            onClick={() => onIndexChange(index + 1)}
            aria-label={t("Следующая история")}
            className="grid size-9 place-items-center rounded-full bg-surface/70 text-ink transition disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
