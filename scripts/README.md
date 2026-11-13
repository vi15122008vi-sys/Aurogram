# scripts/

Служебные скрипты и одноразовые утилиты проекта. Сюда же переехали временные
файлы, которые раньше лежали в корне репозитория (`get_keys.py`,
`media_files.zip`, `audio_backup.zip`) — если они появятся снова, кладите их
сюда, а не в корень.

## Правила

- В корне репозитория — только `README.md`, `.gitignore`, `Caddyfile`,
  `docker-compose.yml` и каталоги `backend/`, `web/`, `android/`, `scripts/`.
- Секреты (`*.env`, `*.session`, ключи) не хранятся здесь: см. `.gitignore`.
- Скрипты должны быть самодостаточными: без установки пакетов в систему.

## Полезное

| Задача | Где |
|---|---|
| Превью тем веба (HTML + PNG) | `web/scripts/theme-preview.mjs` (`npm run themes:preview`) |
| Пересборка CSS админки | `cd web && npx tailwindcss -i ../backend/app/admin/static/tailwind.input.css -o ../backend/app/admin/static/admin.css --content "../backend/app/admin/templates/**/*.html"` |
| Проверка типов веба | `cd web && npm run typecheck` |
| Сборка бэкенда | `docker compose up -d --build backend` |
