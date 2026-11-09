import { MessageCircle } from "lucide-react";

export interface ChatListItem {
  id: number;
  title: string;
  preview?: string | null;
  unread?: number;
  time?: string | null;
}

interface ChatListProps {
  chats: ChatListItem[];
  onOpen?: (chat: ChatListItem) => void;
}

export function ChatList({ chats, onOpen }: ChatListProps) {
  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">INBOX</p>
      <h1 className="mt-2 text-[28px] font-semibold text-ink">Чаты</h1>
      <div className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {chats.map((chat) => (
          <button key={chat.id} type="button" onClick={() => onOpen?.(chat)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-raised">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-raised text-muted"><MessageCircle size={17} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{chat.title}</span><span className="mt-1 block truncate text-xs text-muted">{chat.preview || "Нет сообщений"}</span></span>
            {chat.unread ? <span className="rounded-lg bg-accent/10 px-2 py-1 font-mono text-[10px] text-accent">{chat.unread}</span> : null}
            <time className="font-mono text-[10px] text-muted">{chat.time}</time>
          </button>
        ))}
        {!chats.length && <p className="p-3 text-center text-sm text-muted">Чатов пока нет</p>}
      </div>
    </section>
  );
}