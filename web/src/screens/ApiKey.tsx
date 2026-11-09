import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, KeyRound } from "lucide-react";
import { AuthShell } from "../components/AuthShell";

interface ApiKeyProps {
  busy: boolean;
  error: string | null;
  onSubmit: (apiId: number, apiHash: string) => Promise<void>;
  onBack: () => void;
}

export function ApiKey({ busy, error, onSubmit, onBack }: ApiKeyProps) {
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = Number.parseInt(apiId, 10);
    if (Number.isInteger(id) && apiHash.trim().length === 32) {
      await onSubmit(id, apiHash.trim());
    }
  }

  return (
    <AuthShell
      eyebrow="CONNECTION / API"
      title="API credentials"
      description="Введите API ID и API Hash для подключения аккаунта."
    >
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium" htmlFor="api-id">
          API ID
          <input
            id="api-id"
            inputMode="numeric"
            autoComplete="off"
            value={apiId}
            onChange={(event) => setApiId(event.target.value.replace(/\D/g, ""))}
            className="mt-2 h-12 w-full rounded-lg border border-line bg-surface px-3 font-mono text-sm outline-none transition focus:border-accent focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-accent/50"
            required
          />
        </label>
        <label className="block text-sm font-medium" htmlFor="api-hash">
          API Hash
          <input
            id="api-hash"
            type="password"
            autoComplete="new-password"
            maxLength={32}
            value={apiHash}
            onChange={(event) => setApiHash(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-line bg-surface px-3 font-mono text-sm outline-none transition focus:border-accent focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-accent/50"
            required
          />
        </label>
        {error && <p role="alert" className="rounded-lg border border-line bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60" disabled={busy || apiHash.length !== 32 || !apiId}>
          {busy ? "Сохраняем…" : "Сохранить и продолжить"}
          {!busy && <ArrowRight size={16} />}
        </button>
        <button type="button" onClick={onBack} className="mx-auto flex items-center gap-2 py-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> Назад
        </button>
        <div className="flex items-start gap-2 rounded-lg bg-raised p-3 text-xs leading-5 text-muted">
          <KeyRound size={14} className="mt-0.5 shrink-0" />
          <span>Ключи не сохраняются в браузере после завершения настройки.</span>
        </div>
      </form>
    </AuthShell>
  );
}