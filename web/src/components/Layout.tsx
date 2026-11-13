import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BottomNav, type AppTab } from "./BottomNav";
import { CallOverlay } from "./CallOverlay";
import { ThemeEffects } from "./ThemeEffects";
import { TopBar } from "./TopBar";
import { subscribeCallRequests } from "../lib/callbus";
import { springModal } from "../lib/motion";

interface LayoutProps {
  accountName: string;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onLogout: () => void;
  error?: string | null;
  children: ReactNode;
}

export function Layout({ accountName, activeTab, onTabChange, onLogout, error, children }: LayoutProps) {
  const [callOpen, setCallOpen] = useState(false);
  const [callRoom, setCallRoom] = useState<string | null>(null);
  const [callContact, setCallContact] = useState<string | null>(null);

  useEffect(() => subscribeCallRequests((request) => {
    setCallRoom(request.room);
    setCallContact(request.title);
    setCallOpen(true);
  }), []);

  function openDialer() {
    setCallRoom(null);
    setCallContact(null);
    setCallOpen(true);
  }

  function closeCall() {
    setCallOpen(false);
    setCallRoom(null);
    setCallContact(null);
  }

  return (
    <div className="app-shell">
      <ThemeEffects />
      <TopBar accountName={accountName} onLogout={onLogout} onCall={openDialer} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main key={activeTab} initial={{ opacity: 0, y: 12, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.995 }} transition={{ ...springModal, stiffness: 260, damping: 25 }} className="mx-auto max-w-6xl px-3 pb-6 pt-5 sm:px-5 sm:pt-6">
          {error && <p role="alert" className="mb-4 rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          {children}
        </motion.main>
      </AnimatePresence>
      <BottomNav active={activeTab} onChange={onTabChange} />
      <CallOverlay open={callOpen} onClose={closeCall} room={callRoom} contact={callContact} />
    </div>
  );
}
