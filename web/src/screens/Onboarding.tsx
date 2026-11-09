import { ArrowRight, AudioLines, KeyRound } from "lucide-react";

interface OnboardingProps {
  onConnect: () => void;
  onConfigureApi: () => void;
}

export function Onboarding({ onConnect, onConfigureApi }: OnboardingProps) {
  return (
    <main className="auth-backdrop grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-[420px] rounded-xl border border-line bg-surface p-3">
        <span className="grid size-11 place-items-center rounded-lg bg-ink text-canvas"><AudioLines size={20} /></span>
        <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">AUROGRAM / WORKSPACE</p>
        <h1 className="mt-3 text-[28px] font-semibold text-ink">Рабочее пространство каналов</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Подключите аккаунт, чтобы открыть каналы, чаты и инструменты модерации.</p>
        <div className="mt-7 grid gap-2">
          <button type="button" onClick={onConnect} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong">Подключить аккаунт <ArrowRight size={15} /></button>
          <button type="button" onClick={onConfigureApi} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-raised"><KeyRound size={15} />Настроить API credentials</button>
        </div>
      </section>
    </main>
  );
}