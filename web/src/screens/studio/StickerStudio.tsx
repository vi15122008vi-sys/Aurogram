import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, LoaderCircle, Send, Trash2, Upload } from "lucide-react";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

const MAX_SIDE = 512;
const checkerboard = {
  backgroundImage:
    "linear-gradient(45deg, rgba(255,255,255,0.07) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.07) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.07) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.07) 75%)",
  backgroundSize: "18px 18px",
  backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0",
};

/** Вырезает однотонный фон: flood fill от краёв по цветам углов. */
async function cutout(dataUrl: string, tolerance: number): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D недоступен");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const { width, height } = canvas;
  const frame = context.getImageData(0, 0, width, height);
  const data = frame.data;
  const corners: [number, number, number][] = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ].map(([x, y]) => {
    const index = (y * width + x) * 4;
    return [data[index], data[index + 1], data[index + 2]];
  });

  const limit = tolerance * tolerance;
  const matches = (index: number) => corners.some(([r, g, b]) => {
    const dr = data[index] - r;
    const dg = data[index + 1] - g;
    const db = data[index + 2] - b;
    return dr * dr + dg * dg + db * db <= limit;
  });

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    const pixel = y * width + x;
    if (visited[pixel]) return;
    visited[pixel] = 1;
    if (!matches(pixel * 4)) return;
    data[pixel * 4 + 3] = 0;
    queue.push(x, y);
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (queue.length) {
    const y = queue.pop() as number;
    const x = queue.pop() as number;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }

  context.putImageData(frame, 0, 0);
  return canvas.toDataURL("image/png");
}

export function StickerStudio({ channelId }: { channelId: number }) {
  const { t } = useI18n();
  const [source, setSource] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(36);
  const [sticker, setSticker] = useState<string | null>(null);
  const [pack, setPack] = useState<string[]>([]);
  const [busy, setBusy] = useState<"processing" | "sending" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!source) {
      setSticker(null);
      return;
    }
    let active = true;
    setBusy("processing");
    cutout(source, tolerance)
      .then((url) => {
        if (!active) return;
        setSticker(url);
        setError(null);
      })
      .catch(() => {
        if (active) setError(t("Не удалось обработать изображение", "Could not process the image"));
      })
      .finally(() => {
        if (active) setBusy(null);
      });
    return () => {
      active = false;
    };
  }, [source, tolerance, t]);

  function pickFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    const reader = new FileReader();
    reader.onload = () => setSource(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setError(t("Не удалось прочитать файл", "Could not read the file"));
    reader.readAsDataURL(file);
  }

  async function sendSticker() {
    if (!sticker) return;
    setBusy("sending");
    setError(null);
    setNotice(null);
    try {
      const blob = await (await fetch(sticker)).blob();
      await api.editor.publishPhoto(channelId, blob, t("Стикер из Aurogram Studio", "Sticker from Aurogram Studio"));
      setNotice(t("Стикер отправлен в канал", "Sticker sent to the channel"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось отправить стикер", "Could not send the sticker"));
    } finally {
      setBusy(null);
    }
  }

  async function sendPack() {
    if (!pack.length) return;
    setBusy("sending");
    setError(null);
    setNotice(null);
    let sent = 0;
    try {
      for (const item of pack) {
        const blob = await (await fetch(item)).blob();
        await api.editor.publishPhoto(channelId, blob, t("Стикерпад Aurogram Studio", "Aurogram Studio sticker pack"));
        sent += 1;
      }
      setNotice(`${t("Отправлено стикеров", "Stickers sent")}: ${sent}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось отправить стикерпак", "Could not send the pack"));
    } finally {
      setBusy(null);
    }
  }

  function addToPack() {
    if (!sticker) return;
    setPack((current) => [...current, sticker].slice(0, 24));
  }

  function download() {
    if (!sticker) return;
    const link = document.createElement("a");
    link.href = sticker;
    link.download = `aurogram-sticker-${Date.now()}.png`;
    link.click();
  }

  return (
    <div className="glass-panel rounded-[26px] p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Превью стикера на шахматке — видно прозрачность. */}
        <div className="grid min-h-[240px] place-items-center rounded-[20px] p-3" style={checkerboard}>
          {sticker ? (
            <img src={sticker} alt={t("Стикер", "Sticker")} className="max-h-[220px] max-w-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.28)]" />
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid place-items-center gap-2 rounded-[18px] bg-surface/60 px-6 py-8 text-center transition hover:bg-accent/10"
            >
              <ImagePlus size={26} className="text-accent" strokeWidth={1.6} />
              <span className="text-sm font-semibold text-ink">{t("Загрузить картинку", "Upload an image")}</span>
              <span className="text-[11px] text-muted">{t("PNG или JPG, до 10 МБ", "PNG or JPG, up to 10 MB")}</span>
            </button>
          )}
          {busy === "processing" && <LoaderCircle size={18} className="absolute animate-spin text-accent" />}
        </div>

        <div className="space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(event) => pickFile(event.target.files?.[0])} aria-label={t("Файл изображения", "Image file")} />

          <label className="block">
            <span className="flex items-center justify-between text-[11px] font-medium text-muted">
              <span>{t("Обрезка фона", "Background cutout")}</span>
              <span className="font-mono text-[10px] text-accent">{tolerance}</span>
            </span>
            <input
              type="range"
              min={8}
              max={96}
              step={2}
              value={tolerance}
              onChange={(event) => setTolerance(Number(event.target.value))}
              className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface/70 accent-[var(--accent)]"
              aria-label={t("Допуск обрезки фона", "Background cutout tolerance")}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface/60 px-3 text-xs font-medium text-ink transition hover:text-accent">
              <Upload size={13} />{t("Другая картинка", "Another image")}
            </button>
            <button type="button" disabled={!sticker} onClick={download} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface/60 px-3 text-xs font-medium text-ink transition hover:text-accent disabled:opacity-50">
              <Download size={13} />{t("PNG", "PNG")}
            </button>
            <button type="button" disabled={!sticker} onClick={addToPack} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface/60 px-3 text-xs font-medium text-ink transition hover:text-accent disabled:opacity-50">
              <ImagePlus size={13} />{t("В стикерпак", "Add to pack")}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!sticker || busy === "sending"}
              onClick={() => void sendSticker()}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
            >
              <Send size={13} />{busy === "sending" ? t("Отправляем…", "Sending…") : t("Отправить в канал", "Send to channel")}
            </button>
            <button
              type="button"
              disabled={!pack.length || busy === "sending"}
              onClick={() => void sendPack()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface/60 px-3 text-xs font-medium text-ink transition hover:text-accent disabled:opacity-50"
            >
              <Send size={13} />{t("Весь пак", "Whole pack")}
            </button>
          </div>

          {error && <p role="alert" className="rounded-[16px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
          {notice && <p role="status" className="rounded-[16px] bg-success/10 px-3 py-2 text-xs text-success">{notice}</p>}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink">{t("Стикерпак", "Sticker pack")} <span className="ml-1 font-mono text-[10px] text-muted">{pack.length} / 24</span></p>
          {!!pack.length && (
            <button type="button" onClick={() => setPack([])} className="inline-flex items-center gap-1 rounded-full bg-surface/60 px-2.5 py-1 text-[10px] text-muted transition hover:text-danger">
              <Trash2 size={11} />{t("Очистить", "Clear")}
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {pack.map((item, index) => (
            <span key={`${index}-${item.slice(-12)}`} className="group relative grid size-14 place-items-center rounded-[14px] bg-surface/50 p-1" style={checkerboard}>
              <img src={item} alt={`${index + 1}`} className="max-h-full max-w-full object-contain" />
              <button
                type="button"
                onClick={() => setPack((current) => current.filter((_, position) => position !== index))}
                aria-label={t("Убрать из пака", "Remove from pack")}
                className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-danger text-white opacity-0 transition group-hover:opacity-100"
              >
                <Trash2 size={9} />
              </button>
            </span>
          ))}
          {!pack.length && <p className="py-2 text-[11px] text-muted">{t("Добавьте стикеры, чтобы собрать пак", "Add stickers to build a pack")}</p>}
        </div>
      </div>
    </div>
  );
}
