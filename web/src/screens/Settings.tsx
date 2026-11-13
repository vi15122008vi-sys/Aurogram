import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Bell, Database, EyeOff, LogOut, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { api, type PrivacyPreferences } from "../lib/api";
import { ThemePicker } from "../components/ThemePicker";
import { Toggle } from "../components/Toggle";
import { applyTheme, themeList, type ThemeId } from "../lib/themes";
import { useI18n } from "../lib/i18n";

interface SettingsProps {
  accountName: string;
  phone?: string;
  onLogout?: () => void;
}

export function Settings({ accountName, phone, onLogout }: SettingsProps) {
  const { locale, setLocale, t } = useI18n();
  const [privacy, setPrivacy] = useState<PrivacyPreferences>({ hide_online: false, no_read_receipts: true, hide_device_type: false });
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [quietHours, setQuietHours] = useState(false);
  const [cacheLimit, setCacheLimit] = useState(20);
  const [theme, setTheme] = useState<ThemeId>("aurogram");
  const [cacheReset, setCacheReset] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("aurogram.theme") as ThemeId | null;
    if (stored && themeList.some((item) => item.id === stored)) {
      setTheme(stored);
      applyTheme(stored);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.privacy.get().then((current) => { if (active) setPrivacy(current); }).catch((cause: unknown) => {
      if (active) setPrivacyError(cause instanceof Error ? cause.message : t("Не удалось загрузить настройки приватности"));
    });
    return () => { active = false; };
  }, []);

  async function updatePrivacy(key: keyof PrivacyPreferences, value: boolean) {
    setPrivacyBusy(true);
    setPrivacyError(null);
    const previous = privacy;
    setPrivacy({ ...previous, [key]: value });
    try {
      setPrivacy(await api.privacy.update({ [key]: value }));
    } catch (cause) {
      setPrivacy(previous);
      setPrivacyError(cause instanceof Error ? cause.message : t("Не удалось сохранить настройки приватности"));
    } finally {
      setPrivacyBusy(false);
    }
  }

  function changeTheme(id: ThemeId) {
    setTheme(id);
    localStorage.setItem("aurogram.theme", id);
    applyTheme(id);
  }

  return (
    <section className="animate-[rise-in_240ms_ease-out]">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t("PREFERENCES")}</p>
      <h1 className="mt-2 text-[28px] font-semibold text-ink">{t("Настройки")}</h1>
      <div className="mt-5 grid max-w-3xl gap-5">
        <section>
          <SectionHeading>{t("АККАУНТ")}</SectionHeading>
          <div className="flex items-center gap-3 rounded-[20px] bg-surface/60 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)] p-3.5 transition hover:border-accent/20">
            <span className="grid size-10 place-items-center rounded-lg bg-raised text-muted"><UserRound size={17} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{accountName}</span><span className="mt-1 block truncate font-mono text-xs text-muted">{phone}</span></span>
            <span className="rounded-lg bg-success/10 px-2 py-1 font-mono text-[10px] uppercase text-success">{t("Активен")}</span>
          </div>
        </section>

        <section>
          <SectionHeading>{t("ПРИВАТНОСТЬ")}</SectionHeading>
          <h2 className="mb-2 text-lg font-semibold text-ink">{t("Приватность")}</h2>
          <div className="divide-y divide-[color-mix(in_srgb,var(--ink)_5%,transparent)] overflow-hidden rounded-[20px] bg-surface/60 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)]">
            <SettingRow icon={<EyeOff size={16} />} title={t("Скрывать онлайн")} description={t("Ограничить видимость времени активности в Telegram")} control={<Toggle label={t("Скрывать онлайн")} checked={privacy.hide_online} disabled={privacyBusy} onChange={(value) => void updatePrivacy("hide_online", value)} />} />
            <SettingRow icon={<EyeOff size={16} />} title={t("Не отправлять прочитано")} description={t("Не подтверждать просмотр входящих сообщений")} control={<Toggle label={t("Не отправлять прочитано")} checked={privacy.no_read_receipts} disabled={privacyBusy} onChange={(value) => void updatePrivacy("no_read_receipts", value)} />} />
            <SettingRow icon={<Smartphone size={16} />} title={t("Скрывать тип устройства")} description={t("Использовать нейтральные данные клиента при подключении")} control={<Toggle label={t("Скрывать тип устройства")} checked={privacy.hide_device_type} disabled={privacyBusy} onChange={(value) => void updatePrivacy("hide_device_type", value)} />} />
          </div>
          {privacyError && <p role="alert" className="mt-2 text-xs text-danger">{privacyError}</p>}
        </section>

        <section>
          <SectionHeading>{t("УВЕДОМЛЕНИЯ")}</SectionHeading>
          <div className="divide-y divide-[color-mix(in_srgb,var(--ink)_5%,transparent)] overflow-hidden rounded-[20px] bg-surface/60 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)]">
            <SettingRow icon={<Bell size={16} />} title={t("Push-уведомления")} description={t("Новые сообщения и события")} control={<Toggle label={t("Push-уведомления")} checked={pushEnabled} onChange={setPushEnabled} />} />
            <SettingRow icon={<Bell size={16} />} title={t("Тихий режим")} description={t("Приостановить уведомления")} control={<Toggle label={t("Тихий режим")} checked={quietHours} onChange={setQuietHours} />} />
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between"><SectionHeading>{t("КЭШ")}</SectionHeading><span className="font-mono text-xs tabular-nums text-muted">{cacheLimit} GB</span></div>
          <div className="rounded-[20px] bg-surface/60 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)] p-3.5">
            <label htmlFor="cache-limit" className="text-xs text-muted">{t("Максимальный размер")}</label>
              <input id="cache-limit" type="range" min={1} max={100} step={1} value={cacheLimit} onChange={(event) => { setCacheLimit(Number(event.target.value)); setCacheReset(false); }} className="mt-3 block h-5 w-full accent-accent" />
            <div className="mt-2 flex items-center gap-2 text-xs text-muted"><Database size={14} />{t("Лимит хранения медиа и сообщений")}</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span role="status" className="text-xs text-muted">{cacheReset ? t("Значение по умолчанию") : t("Лимит кэша")}</span>
              <button type="button" onClick={() => { setCacheLimit(20); setCacheReset(true); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-medium text-muted hover:bg-raised"><Database size={14} />{t("Сбросить лимит")}</button>
            </div>
          </div>
        </section>

        <section>
          <SectionHeading>{t("БЕЗОПАСНОСТЬ")}</SectionHeading>
          <div className="divide-y divide-[color-mix(in_srgb,var(--ink)_5%,transparent)] overflow-hidden rounded-[20px] bg-surface/60 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)]">
            <SettingRow icon={<ShieldCheck size={16} />} title={t("Сессия аккаунта")} description={t("Авторизация хранится в HttpOnly cookie")} control={<span className="font-mono text-[10px] text-success">{t("ЗАЩИЩЕНА")}</span>} />
            <div className="flex justify-end p-3"><button type="button" onClick={onLogout} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-raised"><LogOut size={14} />{t("Выйти из аккаунта")}</button></div>
          </div>
        </section>

        <section>
          <SectionHeading>{t("ТЕМА")}</SectionHeading>
          <div className="rounded-[20px] bg-surface/60 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)] p-3.5"><ThemePicker selectedId={theme} onSelect={changeTheme} /></div>
        </section>
        <section>
          <SectionHeading>{t("ЯЗЫК")}</SectionHeading>
          <div className="rounded-[20px] bg-surface/60 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_4%,transparent)] p-3.5">
            <label htmlFor="interface-language" className="mb-2 block text-xs text-muted">{t("Язык интерфейса")}</label>
            <select id="interface-language" value={locale} onChange={(event) => setLocale(event.target.value as "ru" | "en")} className="h-10 w-full rounded-lg border border-line bg-raised px-3 text-sm text-ink outline-none focus:border-accent">
              <option value="ru">{t("Русский")}</option>
              <option value="en">{t("Английский")}</option>
            </select>
            <p className="mt-2 text-xs text-muted">{t("Сохранено на этом устройстве")}</p>
          </div>
        </section>
      </div>
    </section>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <h2 className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted">{children}</h2>;
}

function SettingRow({ icon, title, description, control }: { icon: ReactNode; title: string; description: string; control: ReactNode }) {
  return <div className="flex items-center gap-3 p-3.5 transition-colors hover:bg-surfaceRaised/40"><span className="text-muted">{icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-ink">{title}</span><span className="mt-1 block text-xs text-muted">{description}</span></span>{control}</div>;
}

