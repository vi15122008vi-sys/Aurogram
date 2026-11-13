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
  /** Просмотры последнего поста (бэкенд отдаёт, когда данные доступны). */
  views?: number | null;
}

export interface BotRecord {
  id: number;
  username: string;
  name: string;
  webhook_set: boolean;
}

export interface BotStatus {
  configured: boolean;
  id?: number;
  username?: string;
  name?: string;
  allowed_user_ids: number[];
  internal_secret_set: boolean;
  widget_base_url: string | null;
  webhook_url?: string | null;
  pending_updates?: number;
  error?: string;
}

export interface ChatRecord {
  id: number;
  title: string;
  username?: string | null;
  type: "user" | "group" | "channel" | "bot";
  archived?: boolean;
  unread: number;
  last_message: string | null;
  last_message_date?: string | null;
}

export interface ChatFolder {
  id: number;
  name: string;
  chat_ids: number[];
}

export interface GlobalSearchResult {
  chats: (Pick<ChatRecord, "id" | "type" | "title" | "username" | "unread" | "last_message_date"> & { last_message_id: number | null })[];
  messages: { chat_id: number; chat_title: string | null; chat_type: ChatRecord["type"] | null; message_id: number; text: string | null; date: string | null; out: number }[];
}

export interface PrivacyPreferences {
  hide_online: boolean;
  no_read_receipts: boolean;
  hide_device_type: boolean;
}

export interface StoryPeer {
  peer_id: number;
  title: string;
  username: string | null;
  count: number;
  unread: boolean;
  latest_story_id: number;
  has_media?: boolean;
  media_kind?: "photo" | "video" | null;
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
  reactions: { emoji: string; count: number; chosen: boolean }[];
  pinned: boolean;
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

export interface AiSummary {
  summary: string;
  model: string;
  sentences: number;
  source_chars: number;
}

export interface ChannelIntegrations {
  discord_webhook_set: boolean;
  discord_webhook_hint: string | null;
  vk_token_set: boolean;
  vk_token_hint: string | null;
  vk_group_id: string | null;
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

/**
 * Токен сессии храним сами: cookie с домена API для страницы на pages.dev —
 * сторонняя, и браузеры (Safari, Chrome, Brave) её блокируют. Bearer-токен
 * работает на любом origin.
 */
const AUTH_TOKEN_KEY = "aurogram.auth_token";

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

let bearerToken: string | null = readStoredToken();

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  if (apiBase === "/api" || apiBase.endsWith("/api")) {
    return `${apiBase}${normalizedPath.slice(4)}`;
  }
  return `${apiBase}${normalizedPath}`;
}

export function setBearerToken(token: string | null): void {
  bearerToken = token;
  try {
    if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    else window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Приватный режим: токен живёт только в памяти вкладки.
  }
}

export function storyAvatarUrl(peerId: number): string {
  return apiUrl(`/chats/stories/${peerId}/avatar`);
}

/** Медиа самой истории (не аватар): конкретный story_id или последняя история. */
export function storyMediaUrl(peerId: number, storyId: number = 0): string {
  return apiUrl(`/chats/stories/${peerId}/media?story_id=${storyId}`);
}

export function chatAvatarUrl(chatId: number): string {
  return apiUrl(`/chats/${chatId}/avatar`);
}

/** Прямая ссылка на вложение сообщения (используется в медиа-библиотеке). */
export function messageMediaUrl(chatId: number, messageId: number): string {
  return apiUrl(`/messages/${chatId}/${messageId}/media`);
}

/** Превью вложения: 640px JPEG, которое бэкенд готовит и кэширует. */
export function messageThumbUrl(chatId: number, messageId: number): string {
  return apiUrl(`/messages/${chatId}/${messageId}/thumb`);
}

/** WebSocket-адрес сигналинга звонков (http → ws) на тот же бэкенд. */
export function apiWsUrl(path: string): string {
  return apiUrl(path).replace(/^http/, "ws");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let deviceId = localStorage.getItem("aurogram.device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("aurogram.device_id", deviceId);
  }
  headers.set("X-Device-Id", deviceId);
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
    throw new ApiError(
      "Не удалось связаться с сервером. Проверьте подключение, VPN или блокировку запросов браузером (CORS).",
      0,
    );
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
    // Просроченный или отозванный токен не должен залипать в localStorage.
    if (response.status === 401) setBearerToken(null);
    throw new ApiError(translateApiMessage(readableApiError(body?.detail, response.status)), response.status);
  }

  // Сервер отдаёт токен в теле — запоминаем его для Authorization: Bearer.
  const issuedToken = body && typeof body.token === "string" ? body.token : null;
  if (issuedToken) setBearerToken(issuedToken);

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
    admined: () => request<ChannelRecord[]>("/channels/admined"),
    get: (channelId: number) => request<ChannelDetails>(`/channels/${channelId}`),
    integrations: {
      get: (channelId: number) => request<ChannelIntegrations>(`/channels/${channelId}/integrations`),
      save: (channelId: number, payload: { discord_webhook?: string; vk_token?: string; vk_group_id?: string }) =>
        request<ChannelIntegrations>(`/channels/${channelId}/integrations`, { method: "PUT", body: json(payload) }),
    },
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
  bot: {
    status: () => request<BotStatus>("/bot/status"),
    sendWidget: (payload: { channel: string; title: string; text: string; widget?: string }) =>
      request<{ message_id: number; channel: string; widget: string | null }>("/bot/widgets/send", { method: "POST", body: json(payload) }),
    createStickerSet: (payload: { name: string; title: string; emoji: string; ownerId?: number; files: Blob[] }) => {
      const form = new FormData();
      form.append("name", payload.name);
      form.append("title", payload.title);
      form.append("emoji", payload.emoji);
      if (payload.ownerId) form.append("owner_id", String(payload.ownerId));
      payload.files.forEach((file, index) => form.append("files", file, `sticker${index}.png`));
      return request<{ name: string; title: string; count: number; owner_id: number }>("/bot/stickers/set", { method: "POST", body: form });
    },
  },
  chats: {
    list: (archived = false) => request<ChatRecord[]>(`/chats?archived=${archived}`),
    stories: () => request<StoryPeer[]>("/chats/stories"),
    readStories: (peerId: number, storyIds: number[]) =>
      request<{ status: string; read_until: number }>(`/chats/stories/${peerId}/read`, {
        method: "POST",
        body: json({ story_ids: storyIds }),
      }),
    folders: () => request<ChatFolder[]>("/chats/folders"),
    createFolder: (name: string) => request<ChatFolder>("/chats/folders", { method: "POST", body: json({ name }) }),
    assignFolder: (chatId: number, folderId: number | null) => request<{ chat_id: number; folder_id: number | null }>(`/chats/${chatId}/folder`, { method: "PUT", body: json({ folder_id: folderId }) }),
    search: (query: string) => request<GlobalSearchResult>(`/chats/search/global?q=${encodeURIComponent(query)}`),
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
    scheduled: (channelId: number) => request<MessageRecord[]>(`/editor/channels/${channelId}/scheduled`),
    publishPhoto: (channelId: number, photo: Blob, caption = "") => {
      const form = new FormData();
      form.append("photo", photo, "sticker.png");
      form.append("caption", caption);
      return request<MessageRecord>(`/editor/channels/${channelId}/photos`, { method: "POST", body: form });
    },
  },
  ai: {
    summarize: (payload: { text?: string; chat_id?: number; message_id?: number; sentences?: number }) =>
      request<AiSummary>("/ai/summarize", { method: "POST", body: json(payload) }),
  },
  messages: {
    list: (chatId: number, limit = 50, offsetId = 0) =>
      request<MessageRecord[]>(`/messages?chat_id=${chatId}&limit=${limit}&offset_id=${offsetId}&ghost=true`),
    send: (chatId: number, text: string) =>
      request<MessageRecord>("/messages", { method: "POST", body: json({ chat_id: chatId, text }) }),
    react: (chatId: number, messageId: number, emoji: "👍" | "❤️" | "🔥" | "😂") =>
      request<MessageRecord>(`/messages/${chatId}/${messageId}/reaction`, { method: "PUT", body: json({ emoji }) }),
    pin: (chatId: number, messageId: number, pinned: boolean) =>
      request<MessageRecord>(`/messages/${chatId}/${messageId}/pin`, { method: "PUT", body: json({ pinned }) }),
    sendVideoNote: (chatId: number, video: Blob) => {
      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append("video", video, "video-note.webm");
      return request<MessageRecord>("/messages/video-note", { method: "POST", body: form });
    },
    media: (chatId: number, messageId: number) =>
      download(`/messages/${chatId}/${messageId}/media`),
  },
  privacy: {
    get: () => request<PrivacyPreferences>("/privacy"),
    update: (preferences: Partial<PrivacyPreferences>) => request<PrivacyPreferences>("/privacy", { method: "PUT", body: json(preferences) }),
  },
};

