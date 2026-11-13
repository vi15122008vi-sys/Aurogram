import { useEffect, useState } from "react";
import { Loader2, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

interface AdminRow {
  user_id: number;
  name: string;
  username: string | null;
  role: string;
  is_self: boolean;
}

interface AdminsPanelProps {
  channelId: number;
}

/** Управление администраторами канала: список, приглашение, удаление. */
export function AdminsPanel({ channelId }: AdminsPanelProps) {
  const { t } = useI18n();
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await api.channels.admins(channelId));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось загрузить админов"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [channelId]);

  async function invite() {
    const value = username.trim().replace(/^@/, "");
    if (value.length < 2) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.channels.inviteAdmin(channelId, value);
      setInviteOpen(false);
      setUsername("");
      setNotice(t("Приглашение отправлено", "Invite sent"));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось пригласить"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: number) {
    if (!window.confirm(t("Удалить администратора из канала?", "Remove this admin from the channel?"))) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.channels.removeAdmin(channelId, userId);
      setNotice(t("Администратор удалён", "Admin removed"));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось удалить"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass-panel rounded-[26px] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-[12px] bg-accent/10 text-accent"><ShieldCheck size={16} /></span>
          <div>
            <h2 className="text-sm font-semibold text-ink">{t("Права админов")}</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{rows.length} {t("человек", "people")}</p>
          </div>
        </div>
        <button type="button" onClick={() => setInviteOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[11px] font-semibold text-white transition hover:bg-accent-strong">
          <Plus size={13} />{t("Пригласить")}
        </button>
      </div>

      {loading && <p className="mt-3 flex items-center gap-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" />{t("Загружаем…")}</p>}
      {error && <p role="alert" className="mt-3 rounded-[14px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-[14px] bg-success/10 px-3 py-2 text-xs text-success">{notice}</p>}

      <div className="mt-3 grid gap-1.5">
        {rows.map((row) => (
          <div key={row.user_id} className="flex items-center gap-2.5 rounded-[16px] bg-surface/50 p-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2AABEE] to-[#6366F1] text-xs font-semibold text-white">
              {row.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{row.name}{row.is_self ? ` · ${t("вы", "you")}` : ""}</p>
              <p className="truncate font-mono text-[10px] text-muted">{row.username ? `@${row.username}` : row.user_id} · {row.role}</p>
            </div>
            {row.role !== "Владелец" && !row.is_self && (
              <button type="button" onClick={() => void remove(row.user_id)} disabled={busy} aria-label={t("Удалить админа")} className="grid size-8 place-items-center rounded-full bg-danger/10 text-danger transition hover:bg-danger/20 disabled:opacity-40">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
        {!loading && rows.length === 0 && <p className="text-xs text-muted">{t("Админов не найдено", "No admins found")}</p>}
      </div>

      {inviteOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-md" onClick={() => setInviteOpen(false)}>
          <div className="glass-modal w-full max-w-sm p-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">{t("Пригласить админа")}</h2>
              <button type="button" onClick={() => setInviteOpen(false)} aria-label={t("Закрыть")} className="grid size-8 place-items-center rounded-full bg-surface/60 text-muted"><X size={14} /></button>
            </div>
            <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void invite(); }}>
              <input
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="@username"
                className="h-10 min-w-0 flex-1 rounded-[14px] bg-surface/60 px-3 font-mono text-sm text-ink outline-none placeholder:text-muted"
              />
              <button type="submit" disabled={busy || username.trim().length < 2} className="inline-flex h-10 items-center rounded-[14px] bg-accent px-4 text-xs font-semibold text-white disabled:opacity-50">
                {busy ? <Loader2 size={14} className="animate-spin" /> : t("Добавить")}
              </button>
            </form>
            <p className="mt-2 text-[10px] leading-4 text-muted">{t("Пользователь должен быть доступен по username. Права выдаются после вступления в канал.", "The user must be reachable by username.")}</p>
          </div>
        </div>
      )}
    </section>
  );
}
