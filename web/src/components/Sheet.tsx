import type { ReactNode } from "react";
import { X } from "lucide-react";

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ open, title, onClose, children }: SheetProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-xl border border-line bg-surface p-3 sm:rounded-xl sm:p-3">
        <header className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-ink">{title}</h2><button type="button" onClick={onClose} aria-label="Закрыть" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-raised"><X size={17} /></button></header>
        {children}
      </section>
    </div>
  );
}