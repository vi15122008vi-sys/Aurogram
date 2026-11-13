import { Check } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { Avatar } from "../components/Avatar";

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
  const { t } = useI18n();
  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t("IDENTITIES")}</p>
      <h1 className="mt-2 text-[28px] font-semibold text-ink">{t("Аккаунты")}</h1>
      <div className="mt-6 grid gap-2">
        {accounts.map((account) => (
          <button key={account.id} type="button" onClick={() => onSelect?.(account)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:bg-raised">
            <Avatar name={account.name} id={account.id} className="size-10 shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_8%,transparent)]" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{account.name}</span><span className="mt-1 block truncate font-mono text-xs text-muted">{account.username ? `@${account.username}` : account.phone}</span></span>
            {account.active && <Check size={17} className="text-accent" />}
          </button>
        ))}
        {!accounts.length && <div className="rounded-xl border border-dashed border-line bg-surface p-3 text-center text-sm text-muted">{t("Нет подключённых аккаунтов")}</div>}
      </div>
    </section>
  );
}

