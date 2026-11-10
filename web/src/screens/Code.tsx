import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, MessageSquareText } from "lucide-react";
import { AuthShell } from "../components/AuthShell";
import { useI18n } from "../lib/i18n";

interface CodeProps {
  phone: string;
  busy: boolean;
  error: string | null;
  onSubmit: (code: string) => Promise<void>;
  onBack: () => void;
}

export function Code({ phone, busy, error, onSubmit, onBack }: CodeProps) {
  const { t } = useI18n();
  const [code, setCode] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(code.replace(/\D/g, ""));
  }

  return (
    <AuthShell
      eyebrow="ACCOUNT / 02"
      title={t("Введите код")}
      description={t("Код подтверждения отправлен для номера") + " " + phone + "."}
    >
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-medium" htmlFor="login-code">
          {t("Код подтверждения")}
          <span className="mt-2 flex h-12 items-center rounded-lg border border-line bg-surface px-3 transition focus-within:border-accent focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent/50">
            <MessageSquareText size={17} className="shrink-0 text-muted" />
            <input
              id="login-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              type="text"
              maxLength={8}
              placeholder="12345"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className="ml-3 min-w-0 flex-1 bg-transparent font-mono text-[18px] tracking-[0.18em] outline-none placeholder:text-muted/60"
              required
            />
          </span>
        </label>
        {error && <p role="alert" className="rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60" disabled={busy || code.length < 4}>
          {busy ? t("Проверяем…") : t("Подтвердить")}
          {!busy && <ArrowRight size={16} />}
        </button>
        <button type="button" onClick={onBack} className="mx-auto flex items-center gap-2 py-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> {t("Изменить номер")}
        </button>
      </form>
    </AuthShell>
  );
}
