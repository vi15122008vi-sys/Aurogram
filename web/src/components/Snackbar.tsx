import { CheckCircle2, X, XCircle } from "lucide-react";
import { useI18n } from "../lib/i18n";

interface SnackbarProps {
  message: string;
  tone?: "success" | "error";
  onDismiss?: () => void;
}

export function Snackbar({ message, tone = "success", onDismiss }: SnackbarProps) {
  const { t } = useI18n();
  const Icon = tone === "success" ? CheckCircle2 : XCircle;
  return (
    <div role={tone === "error" ? "alert" : "status"} className="fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink sm:bottom-5">
      <Icon size={16} className={tone === "success" ? "text-success" : "text-danger"} />
      <span className="min-w-0 flex-1">{message}</span>
      {onDismiss && <button type="button" onClick={onDismiss} aria-label={t("Закрыть уведомление")} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-raised"><X size={14} /></button>}
    </div>
  );
}
