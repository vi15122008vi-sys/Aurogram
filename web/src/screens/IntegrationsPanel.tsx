import { useEffect, useState } from "react";
import { Check, Plug, Save, Trash2 } from "lucide-react";
import { api, type ChannelIntegrations } from "../lib/api";
import { useI18n } from "../lib/i18n";

interface IntegrationsPanelProps {
  channelId: number;
}

/** Кросс-постинг: копия поста уходит в Discord и/или VK после публикации. */
export function IntegrationsPanel({ channelId }: IntegrationsPanelProps) {
  const { t } = useI18n();
  const [current, setCurrent] = useState<ChannelIntegrations | null>(null);
  const [discord, setDiscord] = useState("");
  const [vkToken, setVkToken] = useState("");
  const [vkGroup, setVkGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.channels.integrations.get(channelId)
      .then((result) => {
        if (!active) return;
        setCurrent(result);
        setVkGroup(result.vk_group_id ?? "");
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : t("Не удалось загрузить интеграции", "Could not load integrations"));
      });
    return () => { active = false; };
  }, [channelId]);

  async function save(payload: { discord_webhook?: string; vk_token?: string; vk_group_id?: string }) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.channels.integrations.save(channelId, payload);
      setCurrent(result);
      setDiscord("");
      setVkToken("");
      setVkGroup(result.vk_group_id ?? "");
      setNotice(t("Интеграции сохранены", "Integrations saved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось сохранить", "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = "h-11 w-full rounded-[16px] bg-surface/60 px-3.5 font-mono text-xs text-ink outline-none placeholder:text-muted focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]";

  return (
    <div className="grid gap-3">
      <section className="glass-panel rounded-[26px] p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-accent/10 text-accent"><Plug size={17} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">{t("Кросс-постинг", "Cross-posting")}</h2>
            <p className="mt-0.5 text-[11px] leading-5 text-muted">
              {t("Копия каждого поста уходит в подключённые сервисы сразу после публикации в Telegram. Отложенные посты не копируются.", "A copy of every post is sent to connected services right after publishing to Telegram. Scheduled posts are not copied.")}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted">
              <span>Discord webhook</span>
              {current?.discord_webhook_set
                ? <span className="inline-flex items-center gap-1 text-success"><Check size={11} />{current.discord_webhook_hint}</span>
                : <span>{t("не подключён", "not connected")}</span>}
            </span>
            <input
              type="password"
              value={discord}
              onChange={(event) => setDiscord(event.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              className={fieldClass}
            />
            <span className="mt-1.5 flex gap-2">
              <button type="button" disabled={busy || !discord.trim()} onClick={() => void save({ discord_webhook: discord.trim() })} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[11px] font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50">
                <Save size={12} />{t("Сохранить", "Save")}
              </button>
              {current?.discord_webhook_set && (
                <button type="button" disabled={busy} onClick={() => void save({ discord_webhook: "" })} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface/60 px-3 text-[11px] font-medium text-muted transition hover:text-danger disabled:opacity-50">
                  <Trash2 size={12} />{t("Убрать", "Remove")}
                </button>
              )}
            </span>
          </label>

          <div className="block">
            <span className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted">
              <span>VK API</span>
              {current?.vk_token_set
                ? <span className="inline-flex items-center gap-1 text-success"><Check size={11} />{current.vk_token_hint}</span>
                : <span>{t("не подключён", "not connected")}</span>}
            </span>
            <div className="grid gap-2">
              <input
                type="password"
                value={vkToken}
                onChange={(event) => setVkToken(event.target.value)}
                placeholder={t("access_token группы", "group access_token")}
                className={fieldClass}
              />
              <input
                value={vkGroup}
                onChange={(event) => setVkGroup(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder={t("ID группы (числа)", "Group ID (digits)")}
                className={fieldClass}
              />
            </div>
            <span className="mt-1.5 flex gap-2">
              <button
                type="button"
                disabled={busy || (!vkToken.trim() && !vkGroup.trim())}
                onClick={() => void save({ ...(vkToken.trim() ? { vk_token: vkToken.trim() } : {}), ...(vkGroup.trim() ? { vk_group_id: vkGroup.trim() } : {}) })}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[11px] font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
              >
                <Save size={12} />{t("Сохранить", "Save")}
              </button>
              {current?.vk_token_set && (
                <button type="button" disabled={busy} onClick={() => void save({ vk_token: "" })} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface/60 px-3 text-[11px] font-medium text-muted transition hover:text-danger disabled:opacity-50">
                  <Trash2 size={12} />{t("Убрать", "Remove")}
                </button>
              )}
            </span>
          </div>
        </div>

        {error && <p role="alert" className="mt-3 rounded-[16px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-[16px] bg-success/10 px-3 py-2 text-xs text-success">{notice}</p>}

        <p className="mt-3 text-[10px] leading-4 text-muted">
          {t("Токены шифруются на сервере (Fernet) и наружу отдаются только в виде хвоста. Для VK нужен токен группы с правом wall.post.", "Tokens are encrypted server-side (Fernet) and only their tail is exposed. For VK you need a group token with wall.post permission.")}
        </p>
      </section>
    </div>
  );
}
