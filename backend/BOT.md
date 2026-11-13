# Aurogram Studio bot

Бот работает **только** для приложения: всё, что не проходит проверку доступа,
молча игнорируется (без ответа и без логов с содержимым).

## Переменные окружения (`backend/.env`)

| Переменная | Назначение |
|---|---|
| `BOT_TOKEN` | токен от @BotFather. Файл `backend/.env` в `.gitignore` |
| `BOT_ALLOWED_USER_IDS` | белый список Telegram user id через запятую. Пусто = бот не отвечает никому |
| `BOT_INTERNAL_SECRET` | общий секрет вебхука (Telegram присылает его в `X-Telegram-Bot-Api-Secret-Token`) |
| `BOT_WIDGET_BASE_URL` | база для кнопки «Играть» в HTML-виджетах (необязательно) |

`docker-compose.yml` уже читает файл целиком (`env_file: ./backend/.env`),
поэтому отдельные `environment:`-строки не нужны.

## Как узнать свой user_id

1. Открыть бота в Telegram и отправить `/start` (или любое сообщение).
2. Выполнить `GET /api/bot/updates` под своей сессией — в `senders[]` будет
   `user_id`, `username` и текст.
3. Вписать id в `BOT_ALLOWED_USER_IDS=123456789` и перезапустить бэкенд.
4. В Telegram отправить `/id` — бот подтвердит, что доступ выдан.

Пока список пуст, `sendStickerSet`/виджеты из приложения работают (они
авторизуются сессией Aurogram), а личные команды бота — нет.

## Эндпоинты

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/api/bot/status` | `getMe` + вебхук + белый список (без токена) |
| `GET` | `/api/bot/updates` | кто писал боту: помогает найти свой `user_id` |
| `POST` | `/api/bot/webhook/register` | `setWebhook` c `secret_token` |
| `POST` | `/api/bot/webhook` | входящие апдейты; чужие — игнор |
| `POST` | `/api/bot/widgets/send` | HTML-виджет в канал от имени бота |
| `POST` | `/api/bot/stickers/set` | стикерпак через `stickers.CreateStickerSet` |

## Ограничения Bot API

- Пак создаётся только для пользователя, который **запускал** бота (`owner_id`).
- PNG: 512×512, ≤ 512 КБ, имя пака вида `name_by_<bot_username>` (бэкенд
  добавляет суффикс сам).
- Бот должен быть администратором канала, чтобы публиковать в него.
