import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Layout } from "./components/Layout";
import { SplashScreen } from "./components/SplashScreen";
import type { AppTab } from "./components/BottomNav";
import { ApiKey } from "./screens/ApiKey";
import { Code } from "./screens/Code";
import { PhoneInput } from "./screens/PhoneInput";
import { TwoFactor } from "./screens/TwoFactor";
import { Workspace } from "./screens/Workspace";
import { ApiError, api, setBearerToken, type AuthAccount, type SendCodeResult } from "./lib/api";
import { applyTheme, themeList, type ThemeId } from "./lib/themes";
import { useI18n } from "./lib/i18n";
import { springModal } from "./lib/motion";

type AuthScreen = "phone" | "code" | "twoFactor" | "apiKey";

export default function App() {
  const { locale, t } = useI18n();
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("phone");
  const [activeTab, setActiveTab] = useState<AppTab>("channels");
  const [pending, setPending] = useState<SendCodeResult | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Плотность/стиль карточек/энергосбережение применяем до открытия настроек.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("aurogram.ui");
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      const root = document.documentElement;
      if (typeof saved.density === "string") root.dataset.density = saved.density;
      if (typeof saved.card_style === "string") root.dataset.cardStyle = saved.card_style;
      root.dataset.energy = saved.energy_save ? "on" : "off";
    } catch {
      /* повреждённое значение — игнорируем */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const storedTheme = localStorage.getItem("aurogram.theme") as ThemeId | null;
    if (storedTheme && themeList.some((theme) => theme.id === storedTheme)) {
      applyTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.auth.me()
      .then((result) => {
        if (active) setAccount(result);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setAccount(null);
        if (!(cause instanceof ApiError && cause.status === 401)) {
          setError(cause instanceof Error ? t(cause.message) : t("Не удалось проверить сессию"));
        }
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function sendCode(phone: string, inviteCode: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.auth.sendCode(phone, inviteCode);
      setPending(result);
      setAuthScreen("code");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setError(t("Неверный код приглашения. Обратитесь к администратору"));
      } else {
        setError(cause instanceof Error ? t(cause.message) : t("Не удалось отправить код"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(value: string) {
    if (!pending) return;
    setBusy(true);
    setError(null);
    setCode(value);
    try {
      const result = await api.auth.signIn({ phone: pending.phone, phone_code_hash: pending.phone_code_hash, code: value });
      if (result.need_password) {
        setAuthScreen("twoFactor");
      } else {
        const signedIn = await api.auth.me();
        setAccount(signedIn);
      }
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : t("Не удалось проверить код"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyPassword(password: string) {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.auth.signIn({
        phone: pending.phone,
        phone_code_hash: pending.phone_code_hash,
        code,
        password,
      });
      if (result.need_password) throw new Error("Проверьте пароль и попробуйте ещё раз");
      setAccount(await api.auth.me());
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : t("Не удалось войти"));
    } finally {
      setBusy(false);
    }
  }

  async function saveApiKey(apiId: number, apiHash: string) {
    setBusy(true);
    setError(null);
    try {
      await api.auth.registerKey(apiId, apiHash);
      setAuthScreen("phone");
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : t("Не удалось сохранить API credentials"));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setError(null);
    try {
      await api.auth.logout();
    } catch (cause) {
      // Даже если сеть отвалилась, локальный токен всё равно сбрасываем.
      setBearerToken(null);
      setError(cause instanceof Error ? t(cause.message) : t("Не удалось выйти из аккаунта"));
      return;
    }
    setBearerToken(null);
    setAccount(null);
    setPending(null);
    setCode("");
    setAuthScreen("phone");
    setActiveTab("channels");
  }

  if (checkingSession) {
    return <SplashScreen />;
  }

  if (account) {
    return (
      <Layout accountName={account.name || account.phone} activeTab={activeTab} onTabChange={setActiveTab} onLogout={logout} error={error}>
        <Workspace tab={activeTab} account={account} onLogout={logout} />
      </Layout>
    );
  }

  const authView = authScreen === "apiKey"
    ? <ApiKey busy={busy} error={error} onSubmit={saveApiKey} onBack={() => { setError(null); setAuthScreen("phone"); }} />
    : authScreen === "code" && pending
      ? <Code phone={pending.phone} busy={busy} error={error} onSubmit={verifyCode} onBack={() => { setError(null); setAuthScreen("phone"); }} />
      : authScreen === "twoFactor"
        ? <TwoFactor busy={busy} error={error} onSubmit={verifyPassword} onBack={() => { setError(null); setAuthScreen("code"); }} />
        : <PhoneInput busy={busy} error={error} onSubmit={sendCode} onApiKey={() => { setError(null); setAuthScreen("apiKey"); }} />;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={authScreen} initial={{ opacity: 0, y: 14, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.995 }} transition={{ ...springModal, stiffness: 250, damping: 26 }}>
        {authView}
      </motion.div>
    </AnimatePresence>
  );
}
