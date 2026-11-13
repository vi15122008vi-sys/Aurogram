import { LogOut } from "lucide-react";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";

/** Глобальный баннер «сессия истекла» с кнопкой повторного входа. */
export function AuthErrorBanner() {
  const { t } = useI18n();

  async function reauth() {
    try {
      await api.auth.logout();
    } catch {
      /* даже если запрос упал — уводим на вход */
    }
    window.location.href = "/login";
  }

  return (
    <div role="alert" className="mx-3 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[18px] bg-danger/10 px-3.5 py-2.5 text-xs text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_18%,transparent)]">
      <span className="inline-flex items-center gap-1.5"><LogOut size={13} />{t("Сессия истекла")}</span>
      <button
        type="button"
        onClick={() => void reauth()}
        className="rounded-full bg-danger px-3 py-1 text-[11px] font-semibold text-white transition hover:opacity-90"
      >
        {t("Войти заново")}
      </button>
    </div>
  );
}
