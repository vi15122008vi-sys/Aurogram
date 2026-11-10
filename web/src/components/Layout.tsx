import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BottomNav, type AppTab } from "./BottomNav";
import { TopBar } from "./TopBar";

interface LayoutProps {
  accountName: string;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onLogout: () => void;
  error?: string | null;
  children: ReactNode;
}

export function Layout({ accountName, activeTab, onTabChange, onLogout, error, children }: LayoutProps) {
  return (
    <div className="app-shell">
      <TopBar accountName={accountName} onLogout={onLogout} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.2, ease: "easeOut" }} className="mx-auto max-w-6xl px-3 pb-6 pt-5 sm:px-5 sm:pt-6">
          {error && <p role="alert" className="mb-4 rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          {children}
        </motion.main>
      </AnimatePresence>
      <BottomNav active={activeTab} onChange={onTabChange} />
    </div>
  );
}
