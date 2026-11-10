import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Bell, Database, EyeOff, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { ThemePicker } from "../components/ThemePicker";
import { Toggle } from "../components/Toggle";
import { applyTheme, themeList, type ThemeId } from "../lib/themes";

interface SettingsProps {
  accountName: string;
  phone?: string;
  onLogout?: () => void;
}

export function Settings({ accountName, phone, onLogout }: SettingsProps) {
  const [ghostMode, setGhostMode] = useState(false);
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

  function changeTheme(id: ThemeId) {
    setTheme(id);
    localStorage.setItem("aurogram.theme", id);
    applyTheme(id);
  }

  return (
    <section className="animate-[rise-in_240ms_ease-out]">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">PREFERENCES</p>
      <h1 className="mt-2 text-[28px] font-semibold text-ink">Настройки</h1>
      <div className="mt-5 grid max-w-3xl gap-5">
        <section>
          <SectionHeading>АККАУНТ</SectionHeading>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/90 p-3.5 transition hover:border-accent/20">
            <span className="grid size-10 place-items-center rounded-lg bg-raised text-muted"><UserRound size={17} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{accountName}</span><span className="mt-1 block truncate font-mono text-xs text-muted">{phone}</span></span>
            <span className="rounded-lg bg-success/10 px-2 py-1 font-mono text-[10px] uppercase text-success">Активен</span>
          </div>
        </section>

        <section>
          <SectionHeading>GHOST</SectionHeading>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface/90">
            <SettingRow icon={<EyeOff size={16} />} title="Ghost-режим" description="Не отправлять отметку о прочтении" control={<Toggle label="Ghost-режим" checked={ghostMode} onChange={setGhostMode} />} />
          </div>
        </section>

        <section>
          <SectionHeading>УВЕДОМЛЕНИЯ</SectionHeading>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface/90">
            <SettingRow icon={<Bell size={16} />} title="Push-уведомления" description="Новые сообщения и события" control={<Toggle label="Push-уведомления" checked={pushEnabled} onChange={setPushEnabled} />} />
            <SettingRow icon={<Bell size={16} />} title="Тихий режим" description="Приостановить уведомления" control={<Toggle label="Тихий режим" checked={quietHours} onChange={setQuietHours} />} />
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between"><SectionHeading>КЭШ</SectionHeading><span className="font-mono text-xs tabular-nums text-muted">{cacheLimit} GB</span></div>
          <div className="rounded-xl border border-border bg-surface/90 p-3.5">
            <label htmlFor="cache-limit" className="text-xs text-muted">Максимальный размер</label>
              <input id="cache-limit" type="range" min={1} max={100} step={1} value={cacheLimit} onChange={(event) => { setCacheLimit(Number(event.target.value)); setCacheReset(false); }} className="mt-3 block h-5 w-full accent-accent" />
            <div className="mt-2 flex items-center gap-2 text-xs text-muted"><Database size={14} />Лимит хранения медиа и сообщений</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span role="status" className="text-xs text-muted">{cacheReset ? "Значение по умолчанию" : "Лимит кэша"}</span>
              <button type="button" onClick={() => { setCacheLimit(20); setCacheReset(true); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-medium text-muted hover:bg-raised"><Database size={14} />Сбросить лимит</button>
            </div>
          </div>
        </section>

        <section>
          <SectionHeading>БЕЗОПАСНОСТЬ</SectionHeading>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface/90">
            <SettingRow icon={<ShieldCheck size={16} />} title="Сессия аккаунта" description="Авторизация хранится в HttpOnly cookie" control={<span className="font-mono text-[10px] text-success">ЗАЩИЩЕНА</span>} />
            <div className="flex justify-end p-3"><button type="button" onClick={onLogout} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-raised"><LogOut size={14} />Выйти из аккаунта</button></div>
          </div>
        </section>

        <section>
          <SectionHeading>ТЕМА</SectionHeading>
          <div className="rounded-xl border border-border bg-surface/90 p-3.5"><ThemePicker selectedId={theme} onSelect={changeTheme} /></div>
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
