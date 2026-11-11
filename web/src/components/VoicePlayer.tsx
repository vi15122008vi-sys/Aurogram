import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";

interface VoicePlayerProps {
  chatId: number;
  messageId: number;
  durationHint?: number | null;
  waveform?: number[] | null;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function VoicePlayer({ chatId, messageId, durationHint, waveform }: VoicePlayerProps) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationHint || 0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    api.messages.media(chatId, messageId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setError(false);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [chatId, messageId]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setError(true);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  const bars = waveform?.length ? waveform.slice(0, 40) : Array.from({ length: 28 }, (_, index) => 24 + ((index * 37) % 70));
  const progress = duration ? current / duration : 0;

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-full border border-accent/15 bg-gradient-to-r from-accent/15 via-surface/90 to-accent/10 px-3 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255_/_7%)]">
      <button type="button" onClick={togglePlayback} disabled={loading || error} aria-label={playing ? t("Приостановить голосовое сообщение") : t("Воспроизвести голосовое сообщение")} className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white shadow-[0_3px_12px_color-mix(in_srgb,var(--accent)_30%,transparent)] disabled:bg-raised">
        {loading ? <Volume2 size={16} /> : playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <audio
        ref={audioRef}
        src={src || undefined}
        preload="metadata"
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || durationHint || 0)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        className="hidden"
      />
      <div className="min-w-0 flex-1">
        <div className="flex h-8 items-center gap-[3px]" aria-label={t("Форма волны")}>
          {bars.map((height, index) => (
            <span key={index} className={`w-[3px] min-w-[2px] flex-1 ${index / bars.length <= progress ? "bg-accent" : "bg-muted/40"}`} style={{ height: `${Math.min(100, Math.max(12, height))}%` }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] tabular-nums text-muted">
          <span>{error ? t("Медиа недоступно") : loading ? t("Загрузка…") : formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
