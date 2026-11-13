import { useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, Phone, Ticket } from "lucide-react";
import { AuthShell } from "../components/AuthShell";
import { useI18n } from "../lib/i18n";

interface PhoneInputProps {
  busy: boolean;
  error: string | null;
  onSubmit: (phone: string, inviteCode: string) => Promise<void>;
  onApiKey: () => void;
}

const prefixes = [
  { code: "+7", country: "RU" },
  { code: "+1", country: "US" },
  { code: "+44", country: "UK" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
  { code: "+91", country: "IN" },
];

export function PhoneInput({ busy, error, onSubmit, onApiKey }: PhoneInputProps) {
  const { t } = useI18n();
  const [prefix, setPrefix] = useState("+7");
  const [number, setNumber] = useState("");
  const [invite, setInvite] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = `${prefix}${number.replace(/\D/g, "")}`;
    if (normalized.length < 8) return;
    await onSubmit(normalized, invite.trim());
  }

  return (
    <AuthShell
      eyebrow="ACCOUNT / 01"
      title={t("Подключить аккаунт")}
      description={t("Укажите номер телефона, чтобы получить код подтверждения.")}
    >
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-medium" htmlFor="invite-code">
          {t("Код приглашения")}
          <span className="mt-2 flex h-12 items-center gap-2 overflow-hidden rounded-lg border border-line bg-surface transition focus-within:border-accent focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent/50">
            <input
              id="invite-code"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              value={invite}
              onChange={(event) => setInvite(event.target.value.toUpperCase())}
              maxLength={64}
              placeholder="AUROXXXXXXXX"
              className="min-w-0 flex-1 bg-transparent px-3 font-mono text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted"
              required
            />
            <span className="grid w-10 place-items-center text-muted"><Ticket size={16} /></span>
          </span>
        </label>
        <label className="block text-sm font-medium" htmlFor="phone-number">
          {t("Номер телефона")}
          <span className="mt-2 flex h-12 overflow-hidden rounded-lg border border-line bg-surface transition focus-within:border-accent focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent/50">
            <select
              aria-label={t("Код страны")}
              className="w-[92px] border-r border-line bg-raised px-3 text-sm outline-none"
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
            >
              {prefixes.map((item) => (
                <option key={item.country} value={item.code}>
                  {item.country} {item.code}
                </option>
              ))}
            </select>
            <input
              id="phone-number"
              autoComplete="tel-national"
              inputMode="tel"
              type="tel"
              placeholder="900 000 00 00"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted"
              required
            />
            <span className="grid w-10 place-items-center text-muted"><Phone size={16} /></span>
          </span>
        </label>
        {error && <p role="alert" className="rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-60"
          type="submit"
          disabled={busy || number.replace(/\D/g, "").length < 7}
        >
          {busy ? t("Отправляем код…") : t("Продолжить")}
          {!busy && <ArrowRight size={16} />}
        </button>
      </form>
      <div className="my-5 flex items-center gap-3 text-[10px] font-mono uppercase text-muted">
        <span className="h-px flex-1 bg-line" />
        {t("дополнительная настройка")}
        <span className="h-px flex-1 bg-line" />
      </div>
      <button
        type="button"
        onClick={onApiKey}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface text-sm font-medium text-ink transition hover:bg-raised"
      >
        <KeyRound size={15} className="text-muted" />
        {t("Настроить API ID и Hash")}
      </button>
    </AuthShell>
  );
}
