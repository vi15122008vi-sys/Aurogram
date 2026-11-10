import type { ReactNode } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "../lib/i18n";

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ open, title, onClose, children }: SheetProps) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {open && <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 backdrop-blur-[2px] sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section role="dialog" aria-modal="true" aria-label={title} className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-xl border border-line bg-surface p-3 shadow-2xl sm:rounded-xl sm:p-3" initial={{ opacity: 0, y: 32, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.99 }} transition={{ type: "spring", damping: 28, stiffness: 320 }}>
        <header className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-ink">{title}</h2><button type="button" onClick={onClose} aria-label={t("Закрыть")} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-raised"><X size={17} /></button></header>
        {children}
      </motion.section>
      </motion.div>}
    </AnimatePresence>
  );
}
