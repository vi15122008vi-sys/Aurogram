import { ArrowDownToLine } from "lucide-react";
import type { MessageRecord } from "../lib/api";
import { VoicePlayer } from "./VoicePlayer";

interface MessageBubbleProps {
  message: MessageRecord;
  onDownloadMedia?: (message: MessageRecord) => void;
}

export function MessageBubble({ message, onDownloadMedia }: MessageBubbleProps) {
  return (
    <article className={`max-w-[88%] rounded-xl border px-3 py-2.5 ${message.out ? "border-indigo-100 bg-accent/15" : "border-line bg-raised"}`}>
      {!message.out && message.sender_name && <p className="mb-1 text-[10px] font-semibold text-accent">{message.sender_name}</p>}
      {message.text && <p className="whitespace-pre-wrap break-words text-sm leading-5 text-ink">{message.text}</p>}
      {message.media_type === "voice" && <VoicePlayer chatId={message.chat_id} messageId={message.id} durationHint={message.duration} waveform={message.waveform_data} />}
      {message.media_type && message.media_type !== "voice" && <button type="button" onClick={() => onDownloadMedia?.(message)} className="mt-2 inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-xs text-muted"><ArrowDownToLine size={13} />{message.media_type}</button>}
      <p className="mt-1.5 text-right font-mono text-[9px] tabular-nums text-muted">{new Date(message.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</p>
    </article>
  );
}