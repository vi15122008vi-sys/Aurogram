import { useEffect, useState } from "react";
import { AudioLines } from "lucide-react";
import { Layout } from "./components/Layout";
import type { AppTab } from "./components/BottomNav";
import { ApiKey } from "./screens/ApiKey";
import { Code } from "./screens/Code";
import { PhoneInput } from "./screens/PhoneInput";
import { TwoFactor } from "./screens/TwoFactor";
import { Workspace } from "./screens/Workspace";
import { api, type AuthAccount, type SendCodeResult } from "./lib/api";
import { applyTheme, themeList, type ThemeId } from "./lib/themes";

type AuthScreen = "phone" | "code" | "twoFactor" | "apiKey";

export default function App() {
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("phone");
  const [activeTab, setActiveTab] = useState<AppTab>("channels");
  const [pending, setPending] = useState<SendCodeResult | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      .catch(() => {
        if (active) setAccount(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function sendCode(phone: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.auth.sendCode(phone);
      setPending(result);
      setAuthScreen("code");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отправить код");
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
      setError(cause instanceof Error ? cause.message : "Не удалось проверить код");
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
      setError(cause instanceof Error ? cause.message : "Не удалось войти");
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
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить API credentials");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await api.auth.logout();
    } finally {
      setAccount(null);
      setPending(null);
      setCode("");
      setAuthScreen("phone");
      setActiveTab("channels");
      setError(null);
    }
  }

  if (checkingSession) {
    return <main className="grid min-h-screen place-items-center"><div className="flex items-center gap-3 text-sm font-medium text-muted"><AudioLines className="animate-pulse text-accent" size={20} />Aurogram</div></main>;
  }

  if (account) {
    return (
      <Layout accountName={account.name || account.phone} activeTab={activeTab} onTabChange={setActiveTab} onLogout={logout}>
        <Workspace tab={activeTab} account={account} onLogout={logout} />
      </Layout>
    );
  }

  if (authScreen === "apiKey") {
    return <ApiKey busy={busy} error={error} onSubmit={saveApiKey} onBack={() => { setError(null); setAuthScreen("phone"); }} />;
  }
  if (authScreen === "code" && pending) {
    return <Code phone={pending.phone} busy={busy} error={error} onSubmit={verifyCode} onBack={() => { setError(null); setAuthScreen("phone"); }} />;
  }
  if (authScreen === "twoFactor") {
    return <TwoFactor busy={busy} error={error} onSubmit={verifyPassword} onBack={() => { setError(null); setAuthScreen("code"); }} />;
  }
  return <PhoneInput busy={busy} error={error} onSubmit={sendCode} onApiKey={() => { setError(null); setAuthScreen("apiKey"); }} />;
}