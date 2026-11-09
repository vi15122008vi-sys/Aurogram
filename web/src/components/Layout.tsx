import type { ReactNode } from "react";
import { BottomNav, type AppTab } from "./BottomNav";
import { TopBar } from "./TopBar";

interface LayoutProps {
  accountName: string;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function Layout({ accountName, activeTab, onTabChange, onLogout, children }: LayoutProps) {
  return (
    <div className="app-shell">
      <TopBar accountName={accountName} onLogout={onLogout} />
      <main className="mx-auto max-w-6xl px-3 pb-6 pt-5 sm:px-5 sm:pt-6">{children}</main>
      <BottomNav active={activeTab} onChange={onTabChange} />
    </div>
  );
}