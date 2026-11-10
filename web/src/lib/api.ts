import { translateApiMessage } from "./i18n";

export interface AuthAccount {
  id: string;
  name: string;
  phone: string;
  username: string | null;
  auth_state: "ok" | "pending" | "dead";
}

export interface SendCodeResult {
  account_id: string;
  phone: string;
  phone_code_hash: string;
  timeout: number;
}

export interface SignInResult {
  need_password: boolean;
  account_id: string;
  name?: string;
  username?: string | null;
}

export interface ChannelRecord {
  id: number;
  title: string;
  username: string | null;
  subscribers: number;
  posts_count: number;
  scheduled_count?: number;
}

export interface BotRecord {
  id: number;
  username: string;
  name: string;
  webhook_set: boolean;
}

export interface ChatRecord {
  id: number;
  title: string;
  type: "user" | "group" | "channel" | "bot";
  archived?: boolean;
  unread: number;
  last_message: string | null;
  last_message_date?: string | null;
}

export interface ChannelDetails {
  id: number;
  title: string;
  username: string | null;
  subscribers: number;
  about: string;
  linked_chat_id: number | null;
}

export interface AntispamSettings {
  enabled: boolean;
  level: "soft" | "medium" | "hard";
  stop_words_builtin_disabled: string[];
  stop_words_custom: string[];
  stem: boolean;
  case_sensitive: boolean;
  exact_match: boolean;
  links_policy: "block_all" | "allowlist_only" | "blacklist_only";
  allowlist_custom: string[];
  allowlist_global_disabled: string[];
  allow_subdomains: boolean;
  allow_raw_ip: boolean;
  allow_shortlinks: boolean;
  flood_enabled: boolean;
  flood_threshold: number;
  flood_window_sec: number;
  caps_enabled: boolean;
  caps_ratio: number;
  caps_min_len: number;
  emoji_enabled: boolean;
  emoji_max: number;
  new_user_probation_hours: number;
  duplicate_window_min: number;
  notify_author_dm: boolean;
  mute_on_repeat: boolean;
  mute_minutes: number;
  ban_on_third: boolean;
  check_in_media_captions: boolean;
}

export type StopWordCategory = "ads" | "profanity" | "crypto" | "casino" | "bets" | "politics" | "custom";

export interface StopWord {
  id: number | null;
  word: string;
  category: StopWordCategory;
  enabled: boolean;
  is_regex: boolean;
  is_builtin: boolean;
  created_at: string | null;
  created_by: string | null;
}

export interface MessageRecord {
  id: number;
  chat_id: number;
  sender_id: number | null;
  sender_name: string | null;
  text: string | null;
  date: string;
  out: boolean;
  status: string;
  edited: boolean;
  deleted: boolean;
  media_type: string | null;
  media_url: string | null;
  duration: number | null;
  waveform_data: number[] | null;
}

export interface EditorPreview {
  ok: boolean;
  html?: string;
  error?: string;
  warnings?: string[];
  plain_length?: number;
  max_length?: number;
}

export interface EditorCapabilities {
  headings: boolean;
  premium_required_for: string[];
  notice: string | null;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Production API is hosted on the custom domain. Local development can override
// this with VITE_API_BASE_URL=/api to use the Vite dev-server proxy.
const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBase = (configuredApiBase || "https://aurogram.dpdns.org").replace(/\/+$/, "");
let bearerToken: string | null = null;

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  if (apiBase === "/api" || apiBase.endsWith("/api")) {
    return `${apiBase}${normalizedPath.slice(4)}`;
  }
  return `${apiBase}${normalizedPath}`;
}

export function setBearerToken(token: string | null): void {
  bearerToken = token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (bearerToken) {
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError("Не удалось связаться с сервером. Проверьте подключение и настройки API.", 0);
  }
  let body: any;
  if (response.status !== 204) {
    try {
      body = await response.json();
    } catch {
      if (response.ok) {
        throw new ApiError(translateApiMessage("Сервер вернул некорректный ответ. Попробуйте позже."), response.status);
      }
    }
  }

  if (!response.ok) {
    throw new ApiError(translateApiMessage(readableApiError(body?.detail, response.status)), response.status);
  }
  return body as T;
}

function readableApiError(detail: unknown, status: number): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => typeof item?.msg === "string" ? item.msg : null)
      .filter((message): message is string => Boolean(message));
    if (messages.length) return `Проверьте данные: ${messages.join("; ")}`;
  }
  if (status === 401) return "Сессия истекла. Войдите в аккаунт ещё раз.";
  if (status === 429) return "Слишком много попыток. Подождите немного и попробуйте снова.";
  if (status >= 500) return "На сервере произошла ошибка. Попробуйте позже.";
  return "Не удалось выполнить запрос. Проверьте введённые данные.";
}

async function download(path: string): Promise<Blob> {
  const headers = new Headers();
  if (bearerToken) headers.set("Authorization", `Bearer ${bearerToken}`);
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { credentials: "include", headers });
  } catch {
    throw new ApiError(translateApiMessage("Не удалось связаться с сервером. Проверьте подключение и настройки API."), 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new ApiError(translateApiMessage(readableApiError(body?.detail, response.status)), response.status);
  }
  try {
    return await response.blob();
  } catch {
    throw new ApiError(translateApiMessage("Не удалось загрузить файл. Попробуйте ещё раз."), 0);
  }
}

const json = (value: unknown): string => JSON.stringify(value);

export const api = {
  auth: {
    me: () => request<AuthAccount>("/auth/me"),
    sendCode: (phone: string) =>
      request<SendCodeResult>("/auth/send_code", {
        method: "POST",
        body: json({ phone }),
      }),
    signIn: (payload: {
      phone: string;
      phone_code_hash: string;
      code: string;
      password?: string;
    }) =>
      request<SignInResult>("/auth/sign_in", {
        method: "POST",
        body: json(payload),
      }),
    registerKey: (apiId: number, apiHash: string) =>
      request<{ account_id: string }>("/auth/register-key", {
        method: "POST",
        body: json({ api_id: apiId, api_hash: apiHash, remember: true }),
      }),
    logout: () => request<void>("/auth/logout", { method: "POST", body: json({}) }),
  },
  channels: {
    list: () => request<ChannelRecord[]>("/channels"),
    get: (channelId: number) => request<ChannelDetails>(`/channels/${channelId}`),
    antispam: {
      get: (channelId: number) => request<AntispamSettings>(`/channels/${channelId}/antispam`),
      save: (channelId: number, settings: AntispamSettings) =>
        request<AntispamSettings>(`/channels/${channelId}/antispam`, {
          method: "PUT",
          body: json(settings),
        }),
      test: (channelId: number, text: string) =>
        request<{ action: string; reason: string | null; matched: string[] }>(`/channels/${channelId}/antispam/test`, {
          method: "POST",
          body: json({ text }),
        }),
      metrics: (channelId: number) =>
        request<{ deleted: number; mutes: number; bans: number }>(`/channels/${channelId}/antispam/metrics`),
    },
    stopwords: {
      list: (channelId: number) => request<StopWord[]>(`/channels/${channelId}/stopwords`),
      create: (channelId: number, payload: { word: string; category: StopWordCategory; is_regex: boolean }) =>
        request<StopWord>(`/channels/${channelId}/stopwords`, { method: "POST", body: json(payload) }),
      update: (channelId: number, wordId: number, payload: Partial<Pick<StopWord, "word" | "category" | "enabled">>) =>
        request<StopWord>(`/channels/${channelId}/stopwords/${wordId}`, { method: "PATCH", body: json(payload) }),
      remove: (channelId: number, wordId: number) =>
        request<void>(`/channels/${channelId}/stopwords/${wordId}`, { method: "DELETE" }),
      import: (channelId: number, format: "json" | "txt", data: string, category: StopWordCategory) =>
        request<{ imported: number; skipped: number }>(`/channels/${channelId}/stopwords/import`, {
          method: "POST",
          body: json({ format, data, category }),
        }),
      export: (channelId: number, format: "json" | "txt") =>
        download(`/channels/${channelId}/stopwords/export?format=${format}`),
    },
  },
  bots: {
    list: () => request<BotRecord[]>("/bots"),
  },
  chats: {
    list: (archived = false) => request<ChatRecord[]>(`/chats?archived=${archived}`),
    archive: (chatId: number, archived: boolean) =>
      request<{ chat_id: number; archived: boolean }>(`/chats/${chatId}/archive`, {
        method: "PUT",
        body: json({ archived }),
      }),
  },
  editor: {
    capabilities: () => request<EditorCapabilities>("/editor/capabilities"),
    preview: (markdown: string) =>
      request<EditorPreview>("/editor/preview", { method: "POST", body: json({ markdown }) }),
    publish: (channelId: number, payload: { text: string; parse_mode: "md" | "html"; schedule_at: string | null }) =>
      request<MessageRecord>(`/editor/channels/${channelId}/posts`, { method: "POST", body: json(payload) }),
  },
  messages: {
    list: (chatId: number, limit = 50, offsetId = 0) =>
      request<MessageRecord[]>(`/messages?chat_id=${chatId}&limit=${limit}&offset_id=${offsetId}&ghost=true`),
    send: (chatId: number, text: string) =>
      request<MessageRecord>("/messages", { method: "POST", body: json({ chat_id: chatId, text }) }),
    media: (chatId: number, messageId: number) =>
      download(`/messages/${chatId}/${messageId}/media`),
  },
};

