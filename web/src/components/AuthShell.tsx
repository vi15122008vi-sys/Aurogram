import type { ReactNode } from "react";
import { useI18n } from "../lib/i18n";
import { AudioLines } from "lucide-react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  const { t } = useI18n();
  return (
    <main className="auth-backdrop flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-[420px] animate-[rise-in_360ms_ease-out]">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-ink text-canvas">
            <AudioLines aria-hidden="true" size={19} strokeWidth={1.7} />
          </span>
          <span className="text-[17px] font-semibold tracking-normal">Aurogram</span>
        </div>
        <div className="rounded-xl border border-line bg-surface/95 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t(eyebrow)}</p>
          <h1 className="mt-3 text-[26px] font-semibold leading-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          <div className="mt-7">{children}</div>
        </div>
        <p className="mt-5 text-center font-mono text-[10px] text-muted">{t("SECURE ACCOUNT ACCESS")}</p>
      </section>
      <style>{`@keyframes rise-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </main>
  );
}
