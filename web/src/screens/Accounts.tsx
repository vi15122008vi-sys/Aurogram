import { Check, Smartphone } from "lucide-react";

export interface AccountSummary {
  id: string;
  name: string;
  phone: string;
  username?: string | null;
  active?: boolean;
}

interface AccountsProps {
  accounts: AccountSummary[];
  onSelect?: (account: AccountSummary) => void;
}

export function Accounts({ accounts, onSelect }: AccountsProps) {
  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">IDENTITIES</p>
      <h1 className="mt-2 text-[28px] font-semibold text-ink">Аккаунты</h1>
      <div className="mt-6 grid gap-2">
        {accounts.map((account) => (
          <button key={account.id} type="button" onClick={() => onSelect?.(account)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:bg-raised">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-raised text-muted"><Smartphone size={17} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{account.name}</span><span className="mt-1 block truncate font-mono text-xs text-muted">{account.username ? `@${account.username}` : account.phone}</span></span>
            {account.active && <Check size={17} className="text-accent" />}
          </button>
        ))}
        {!accounts.length && <div className="rounded-xl border border-dashed border-line bg-surface p-3 text-center text-sm text-muted">Нет подключённых аккаунтов</div>}
      </div>
    </section>
  );
}