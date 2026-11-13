import { ApiError } from "./api";

/**
 * Офлайн-кэш для веба: последние успешные ответы API складываем в localStorage,
 * чтобы при потере сети показать данные и баннер «Нет подключения. Показан кэш».
 */
const PREFIX = "aurogram.cache.v1:";
const INDEX_KEY = `${PREFIX}__keys`;
const MAX_ENTRIES = 32;

/** Сетевая ошибка (fetch не дошёл до сервера), а не ответ 4xx/5xx. */
export function isOfflineError(cause: unknown): boolean {
  return cause instanceof ApiError && cause.status === 0;
}

export function readCache<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  try {
    const storage = window.localStorage;
    storage.setItem(PREFIX + key, JSON.stringify(value));
    const keys = readCache<string[]>("__keys") ?? [];
    const next = [key, ...keys.filter((item) => item !== key)];
    // Кэш ограничен: самые старые записи вытесняются первыми.
    next.slice(MAX_ENTRIES).forEach((stale) => storage.removeItem(PREFIX + stale));
    storage.setItem(INDEX_KEY, JSON.stringify(next.slice(0, MAX_ENTRIES)));
  } catch {
    // Приватный режим или переполнение квоты — офлайн-кэш не критичен.
  }
}

export function clearCache(): void {
  try {
    const storage = window.localStorage;
    const keys = readCache<string[]>("__keys") ?? [];
    keys.forEach((key) => storage.removeItem(PREFIX + key));
    storage.removeItem(INDEX_KEY);
  } catch {
    // игнорируем
  }
}
