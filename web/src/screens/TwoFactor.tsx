import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { AuthShell } from "../components/AuthShell";
import { useI18n } from "../lib/i18n";

interface TwoFactorProps {
  busy: boolean;
  error: string | null;
  onSubmit: (password: string) => Promise<void>;
  onBack: () => void;
}

export function TwoFactor({ busy, error, onSubmit, onBack }: TwoFactorProps) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(password);
  }

  return (
    <AuthShell
      eyebrow="ACCOUNT / 03"
      title={t("Пароль двухэтапной проверки")}
      description={t("Для этого аккаунта включена дополнительная защита.")}
    >
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-medium" htmlFor="two-factor-password">
          {t("Пароль")}
          <span className="mt-2 flex h-12 items-center rounded-lg border border-line bg-surface px-3 transition focus-within:border-accent focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent/50">
            <LockKeyhole size={17} className="shrink-0 text-muted" />
            <input
              id="two-factor-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="ml-3 min-w-0 flex-1 bg-transparent text-sm outline-none"
              required
            />
          </span>
        </label>
        {error && <p role="alert" className="rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60" disabled={busy || !password}>
          {busy ? t("Проверяем…") : t("Войти")}
          {!busy && <ArrowRight size={16} />}
        </button>
        <button type="button" onClick={onBack} className="mx-auto flex items-center gap-2 py-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> {t("Назад к коду")}
        </button>
      </form>
    </AuthShell>
  );
}
