import { useEffect, useMemo, useState } from "react";
import { Download, Film, Image as ImageIcon, LoaderCircle, RefreshCw } from "lucide-react";
import { api, messageMediaUrl, messageThumbUrl, type MessageRecord } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

type MediaFilter = "all" | "photo" | "video" | "other";

export function MediaLibrary({ channelId }: { channelId: number }) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<MessageRecord[] | null>(null);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.messages.list(channelId, 100)
      .then((items) => { if (active) setMessages(items.filter((item) => item.media_type && !item.deleted)); })
      .catch((cause: unknown) => { if (active) setError(t(cause instanceof Error ? cause.message : "Не удалось загрузить медиа", "Could not load media")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [channelId, reloadKey]);

  const visible = useMemo(() => {
    const all = messages ?? [];
    if (filter === "all") return all;
    if (filter === "photo") return all.filter((item) => item.media_type === "photo");
    if (filter === "video") return all.filter((item) => item.media_type === "video" || item.media_type === "video_note");
    return all.filter((item) => item.media_type !== "photo" && item.media_type !== "video" && item.media_type !== "video_note");
  }, [messages, filter]);

  const counts = useMemo(() => {
    const all = messages ?? [];
    return {
      all: all.length,
      photo: all.filter((item) => item.media_type === "photo").length,
      video: all.filter((item) => item.media_type === "video" || item.media_type === "video_note").length,
    };
  }, [messages]);

  const filters: { id: MediaFilter; label: string; labelEn: string; count: number }[] = [
    { id: "all", label: "Все", labelEn: "All", count: counts.all },
    { id: "photo", label: "Фото", labelEn: "Photos", count: counts.photo },
    { id: "video", label: "Видео", labelEn: "Videos", count: counts.video },
    { id: "other", label: "Файлы", labelEn: "Files", count: counts.all - counts.photo - counts.video },
  ];

  return (
    <div className="glass-panel rounded-[26px] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={t("Тип медиа", "Media type")}>
          {filters.map(({ id, label, labelEn, count }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${filter === id ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_16%,transparent)]" : "text-muted hover:text-ink"}`}
            >
              {t(label, labelEn)}<span className="ml-1.5 font-mono text-[10px] opacity-70">{count}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading} aria-label={t("Обновить медиа", "Reload media")} className="ml-auto grid size-9 place-items-center rounded-full bg-surface/60 text-muted transition hover:text-accent disabled:opacity-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-[18px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

      {loading && !messages ? (
        <div className="grid min-h-[200px] place-items-center text-muted"><LoaderCircle size={18} className="animate-spin" /></div>
      ) : visible.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => {
            const url = messageMediaUrl(channelId, item.id);
            const isPhoto = item.media_type === "photo";
            const isVideo = item.media_type === "video" || item.media_type === "video_note";
            return (
              <a
                key={item.id}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-square overflow-hidden rounded-[18px] bg-surface/50 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_5%,transparent)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_25%,transparent),0_12px_28px_color-mix(in_srgb,var(--accent)_16%,transparent)]"
              >
                {isPhoto || isVideo ? (
                  <MediaThumb chatId={channelId} messageId={item.id} video={isVideo} label={item.text ?? undefined} />
                ) : (
                  <span className="grid size-full place-items-center text-muted">
                    <ImageIcon size={22} strokeWidth={1.5} />
                  </span>
                )}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/65 to-transparent px-2 py-1.5 text-[10px] text-white/85">
                  <span className="truncate">{item.media_type}</span>
                  <Download size={11} className="shrink-0 opacity-0 transition group-hover:opacity-100" />
                </span>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="grid min-h-[200px] place-items-center px-4 text-center">
          <div className="max-w-xs">
            <span className="mx-auto grid size-14 place-items-center rounded-[20px] bg-accent/10 text-accent"><ImageIcon size={22} strokeWidth={1.5} /></span>
            <p className="mt-3 text-sm font-semibold text-ink">{t("Медиа пока нет", "No media yet")}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{t("Здесь появятся фото и видео, которые публиковались в канале.", "Photos and videos published in the channel will appear here.")}</p>
          </div>
        </div>
      )}

      {!!visible.length && (
        <p className="mt-3 text-[11px] text-muted">{t("Показаны последние", "Showing the latest")} {visible.length} {t("вложений канала", "channel attachments")} · {locale.toUpperCase()}</p>
      )}
    </div>
  );
}

/** Плитка с превью: грузит лёгкий /thumb, при ошибке показывает иконку. */
function MediaThumb({ chatId, messageId, video, label }: { chatId: number; messageId: number; video: boolean; label?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="grid size-full place-items-center text-muted">
        {video ? <Film size={22} strokeWidth={1.5} /> : <ImageIcon size={22} strokeWidth={1.5} />}
      </span>
    );
  }
  return (
    <>
      <img
        src={messageThumbUrl(chatId, messageId)}
        alt={label ?? ""}
        loading="lazy"
        decoding="async"
        className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
        onError={() => setFailed(true)}
      />
      {video && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <Film size={15} />
          </span>
        </span>
      )}
    </>
  );
}
