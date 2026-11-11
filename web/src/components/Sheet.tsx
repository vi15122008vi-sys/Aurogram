import type { ReactNode } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { springModal, springPress } from "../lib/motion";

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
      {open && <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section role="dialog" aria-modal="true" aria-label={title} className="glass-modal max-h-[88vh] w-full max-w-xl overflow-y-auto p-3 shadow-2xl" initial={{ opacity: 0, y: 44, scale: 0.94, rotateX: 2 }} animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }} exit={{ opacity: 0, y: 22, scale: 0.97 }} transition={springModal}>
        <header className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-ink">{title}</h2><motion.button type="button" whileTap={springPress} onClick={onClose} aria-label={t("Закрыть")} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-raised"><X size={17} /></motion.button></header>
        {children}
      </motion.section>
      </motion.div>}
    </AnimatePresence>
  );
}
