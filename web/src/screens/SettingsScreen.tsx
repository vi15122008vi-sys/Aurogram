import { useEffect, useState, type ReactNode } from "react";
import {
  Bell, Database, Gauge, Languages, LogOut, Palette, ShieldCheck, Sparkles, UserRound, Zap,
} from "lucide-react";
import { api, type AiReplyStyle, type CardStyle, type Density, type PrivacyPreferences, type UiSettings } from "../lib/api";
import { GlassButton } from "../components/Buttons";
import { ThemePicker } from "../components/ThemePicker";
import { Toggle } from "../components/Toggle";
import { applyTheme, themeList, type ThemeId } from "../lib/themes";
import { useI18n } from "../lib/i18n";

interface SettingsProps {
  accountName: string;
  phone?: string;
  onLogout?: () => void;
}

const DEFAULT_UI: UiSettings = {
  density: "comfortable",
  card_style: "glass",
  ai_translate: false,
  ai_reply_style: "brief",
  energy_save: false,
};

const UI_STORAGE_KEY = "aurogram.ui";

function readLocalUi(): UiSettings {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return DEFAULT_UI;
    return { ...DEFAULT_UI, ...(JSON.parse(raw) as Partial<UiSettings>) };
  } catch {
    return DEFAULT_UI;
  }
}

/** Применяет режимы к <html>: плотность, стиль карточек, энергосбережение. */
export function applyUiSettings(settings: UiSettings): void {
  const root = document.documentElement;
  root.dataset.density = settings.density;
  root.dataset.cardStyle = settings.card_style;
  root.dataset.energy = settings.energy_save ? "on" : "off";
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* приватный режим */
  }
}

function BentoCard({
  title, description, icon, className = "", children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`glass-panel bento-card flex flex-col gap-3 rounded-[26px] ${className}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-accent/10 text-accent">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-muted">{description}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({
  value, options, onChange, disabled,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" className="flex flex-wrap gap-1 rounded-full bg-surface/60 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${value === option.id ? "bg-accent/10 text-accent" : "text-muted hover:text-ink"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsScreen({ accountName, phone, onLogout }: SettingsProps) {
  const { locale, setLocale, t } = useI18n();
  const [privacy, setPrivacy] = useState<PrivacyPreferences>({ hide_online: false, no_read_receipts: true, hide_device_type: false });
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [quietHours, setQuietHours] = useState(false);
  const [cacheLimit, setCacheLimit] = useState(20);
  const [cacheReset, setCacheReset] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("aurogram");
  const [ui, setUi] = useState<UiSettings>(() => readLocalUi());
  const [uiBusy, setUiBusy] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("aurogram.theme") as ThemeId | null;
    if (stored && themeList.some((item) => item.id === stored)) {
      setTheme(stored);
      applyTheme(stored);
    }
    applyUiSettings(readLocalUi());
  }, []);

  useEffect(() => {
    let active = true;
    api.privacy.get()
      .then((current) => { if (active) setPrivacy(current); })
      .catch((cause: unknown) => {
        if (active) setPrivacyError(cause instanceof Error ? cause.message : t("Не удалось загрузить настройки приватности"));
      });
    api.settings.get()
      .then((current) => {
        if (!active) return;
        setUi(current);
        applyUiSettings(current);
      })
      .catch(() => {
        /* офлайн: остаёмся на локальных настройках */
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

  async function updateUi(patch: Partial<UiSettings>) {
    const next = { ...ui, ...patch };
    setUi(next);
    applyUiSettings(next);
    setUiBusy(true);
    try {
      const saved = await api.settings.patch(patch);
      setUi(saved);
      applyUiSettings(saved);
    } catch {
      /* локальное значение уже применено; сервер догонит при следующем изменении */
    } finally {
      setUiBusy(false);
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
      <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink">{t("Настройки")}</h1>

      <div className="bento mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <BentoCard
          className="sm:col-span-2 lg:col-span-3"
          title={t("Аккаунт")}
          description={`${accountName}${phone ? ` · ${phone}` : ""}`}
          icon={<UserRound size={17} />}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-success/10 px-2.5 py-1 font-mono text-[10px] uppercase text-success">{t("Активен")}</span>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-danger/10 px-3.5 text-[11px] font-medium text-danger transition hover:bg-danger/15"
              >
                <LogOut size={13} />{t("Выйти")}
              </button>
            )}
          </div>
        </BentoCard>

        <BentoCard
          className="sm:col-span-2"
          title={t("Внешний вид")}
          description={t("Плотность интерфейса и стиль карточек — применяется сразу и сохраняется на сервере.", "Interface density and card style — applied instantly and saved on the server.")}
          icon={<Palette size={17} />}
        >
          <div className="grid gap-3">
            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{t("Плотность")}</p>
              <Segmented<Density>
                value={ui.density}
                disabled={uiBusy}
                onChange={(density) => void updateUi({ density })}
                options={[
                  { id: "compact", label: t("Compact") },
                  { id: "comfortable", label: t("Comfortable") },
                  { id: "spacious", label: t("Spacious") },
                ]}
              />
            </div>
            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{t("Стиль карточек")}</p>
              <Segmented<CardStyle>
                value={ui.card_style}
                disabled={uiBusy}
                onChange={(card_style) => void updateUi({ card_style })}
                options={[
                  { id: "glass", label: t("Glass") },
                  { id: "flat", label: t("Flat") },
                  { id: "neo", label: t("Neo") },
                ]}
              />
            </div>
          </div>
        </BentoCard>

        <BentoCard
          title={t("Энергосбережение")}
          description={t("Отключает анимации и размытие, чтобы экономить батарею.", "Turns off animations and blur to save battery.")}
          icon={<Zap size={17} />}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink">{t("Режим экономии")}</span>
            <Toggle checked={ui.energy_save} onChange={(energy_save) => void updateUi({ energy_save })} label={t("Режим экономии")} />
          </div>
        </BentoCard>

        <BentoCard
          className="sm:col-span-2"
          title={t("AI и автоматизация")}
          description={t("Перевод входящих и стиль ответов ассистента.", "Incoming translation and assistant reply style.")}
          icon={<Sparkles size={17} />}
        >
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-ink">{t("AI-перевод в чатах")}</span>
              <Toggle checked={ui.ai_translate} onChange={(ai_translate) => void updateUi({ ai_translate })} label={t("AI-перевод в чатах")} />
            </div>
            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{t("Стиль AI-ответов")}</p>
              <Segmented<AiReplyStyle>
                value={ui.ai_reply_style}
                disabled={uiBusy}
                onChange={(ai_reply_style) => void updateUi({ ai_reply_style })}
                options={[
                  { id: "strict", label: t("Strict") },
                  { id: "friendly", label: t("Friendly") },
                  { id: "brief", label: t("Brief") },
                ]}
              />
            </div>
          </div>
        </BentoCard>

        <BentoCard
          className="sm:col-span-2 lg:col-span-2"
          title={t("Приватность")}
          description={t("Кто видит ваш онлайн, прочтение и тип устройства.", "Who sees your online status, read receipts and device type.")}
          icon={<ShieldCheck size={17} />}
        >
          <div className="grid gap-2">
            {([
              ["hide_online", t("Скрывать онлайн")],
              ["no_read_receipts", t("Не отправлять прочитано")],
              ["hide_device_type", t("Скрывать тип устройства")],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-xs text-ink">{label}</span>
                <Toggle checked={privacy[key]} disabled={privacyBusy} onChange={(value) => void updatePrivacy(key, value)} label={label} />
              </div>
            ))}
          </div>
          {privacyError && <p role="alert" className="mt-2 text-[11px] text-danger">{privacyError}</p>}
        </BentoCard>

        <BentoCard
          title={t("Уведомления")}
          description={t("Push и тихий режим.", "Push and quiet hours.")}
          icon={<Bell size={17} />}
        >
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-ink">{t("Push-уведомления")}</span>
              <Toggle checked={pushEnabled} onChange={setPushEnabled} label={t("Push-уведомления")} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-ink">{t("Тихий режим")}</span>
              <Toggle checked={quietHours} onChange={setQuietHours} label={t("Тихий режим")} />
            </div>
          </div>
        </BentoCard>

        <BentoCard
          className="sm:col-span-2"
          title={t("Тема")}
          description={t("Оформление приложения и Liquid Glass.", "App appearance and Liquid Glass.")}
          icon={<Gauge size={17} />}
        >
          <ThemePicker selectedId={theme} onSelect={changeTheme} />
        </BentoCard>

        <BentoCard
          title={t("Кэш")}
          description={t("Сколько медиа хранить локально.", "How much media to keep locally.")}
          icon={<Database size={17} />}
        >
          <p className="font-mono text-lg tabular-nums text-ink">{cacheReset ? t("по умолчанию") : `${cacheLimit} ${t("ГБ")}`}</p>
          <GlassButton
            tone="glass"
            onClick={() => { setCacheLimit(20); setCacheReset(true); }}
            className="mt-2 h-8 px-3 text-[11px] font-medium"
          >
            {t("Сбросить кэш")}
          </GlassButton>
        </BentoCard>

        <BentoCard
          title={t("Язык")}
          description={t("Язык интерфейса.", "Interface language.")}
          icon={<Languages size={17} />}
        >
          <label htmlFor="interface-language" className="sr-only">{t("Язык интерфейса")}</label>
          <select
            id="interface-language"
            value={locale}
            onChange={(event) => setLocale(event.target.value as "ru" | "en")}
            className="h-9 w-full rounded-[14px] bg-surface/60 px-3 text-xs text-ink outline-none"
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </BentoCard>
      </div>
    </section>
  );
}

