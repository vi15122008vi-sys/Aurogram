import { useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, Phone } from "lucide-react";
import { AuthShell } from "../components/AuthShell";

interface PhoneInputProps {
  busy: boolean;
  error: string | null;
  onSubmit: (phone: string) => Promise<void>;
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
  const [prefix, setPrefix] = useState("+7");
  const [number, setNumber] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = `${prefix}${number.replace(/\D/g, "")}`;
    if (normalized.length < 8) return;
    await onSubmit(normalized);
  }

  return (
    <AuthShell
      eyebrow="ACCOUNT / 01"
      title="Подключить аккаунт"
      description="Укажите номер телефона, чтобы получить код подтверждения."
    >
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-medium" htmlFor="phone-number">
          Номер телефона
          <span className="mt-2 flex h-12 overflow-hidden rounded-lg border border-line bg-surface transition focus-within:border-accent focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent/50">
            <select
              aria-label="Код страны"
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
          {busy ? "Отправляем код…" : "Продолжить"}
          {!busy && <ArrowRight size={16} />}
        </button>
      </form>
      <div className="my-5 flex items-center gap-3 text-[10px] font-mono uppercase text-muted">
        <span className="h-px flex-1 bg-line" />
        дополнительная настройка
        <span className="h-px flex-1 bg-line" />
      </div>
      <button
        type="button"
        onClick={onApiKey}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface text-sm font-medium text-ink transition hover:bg-raised"
      >
        <KeyRound size={15} className="text-muted" />
        Настроить API ID и Hash
      </button>
    </AuthShell>
  );
}