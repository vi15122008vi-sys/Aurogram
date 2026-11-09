# Aurogram

Aurogram is a web and Android workspace for Telegram channel owners and administrators. The repository contains a FastAPI/Telethon backend, a React PWA, and an Android Compose application.

## Requirements

- Docker Engine with Docker Compose v2 for the containerized stack
- Python 3.11 for local backend development
- Node.js 20+ and npm for web development
- JDK 17 and Android Studio for Android development

## Telegram API credentials

1. Sign in at [my.telegram.org](https://my.telegram.org).
2. Open **API development tools** and create an application.
3. Copy the numeric `api_id` and the 32-character `api_hash` into `backend/.env` as `API_ID` and `API_HASH`.
4. Generate a Fernet key and set it as `SECRET_KEY`:

   ```sh
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

5. Set a unique `ADMIN_PASSWORD`; do not use the example value in a deployed environment.

The API credentials and encryption key are secrets. Do not commit `backend/.env` or paste these values into issue trackers.

## Docker deployment

Create the local environment file, edit its values, then start the stack:

```sh
cp backend/.env.example backend/.env
docker compose up --build -d
```

The local default is `http://localhost` on port 80. For a public deployment, set `DOMAIN` in the shell or a root `.env` file to the public hostname served by Caddy; Caddy then provisions HTTPS automatically. The backend image starts `supervisord`; supervisord runs Uvicorn, and FastAPI's lifespan starts the Telegram listener and cache cleanup tasks.

Compose mounts persistent named volumes as follows:

| Volume | Container path | Contents |
| --- | --- | --- |
| `sessions` | `/app/sessions` | Telethon session files |
| `cache_data` | `/app/cache_data` | SQLite metadata, account caches, and listener heartbeat |
| `media_data` | `/app/media_data` | Backend media storage |

Caddy routes `/api` and `/admin` to the backend and serves the web container for other paths. Check the service with `http://localhost/api/health` locally or `https://$DOMAIN/api/health` after setting a public domain; the admin UI is at `/admin`.

For a frontend hosted on a different domain, set `VITE_API_BASE_URL` to the backend API URL and set backend `CORS_ORIGINS` to the exact frontend origin. For cookie-based authentication, prefer frontend and API hostnames under the same site (for example `app.example.com` and `api.example.com`) and serve both over HTTPS.

## Web development and Cloudflare Pages

Local development:

```sh
npm --prefix web ci
npm --prefix web run dev
```

The Vite development server proxies `/api` to `http://127.0.0.1:8000`.

Cloudflare Pages settings:

- Root directory: `web`
- Build command: `npm ci && npm run build`
- Build output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://api.example.com/api`

Add the Pages custom domain to backend `CORS_ORIGINS`. The web manifest and service worker are `web/public/manifest.json` and `web/public/sw.js`; API and admin responses are deliberately not cached by the service worker.

PWA icon binaries are not included. Before store-like installation/distribution, add PNG icons at 192x192 and 512x512 under `web/public/icons/` and reference them in `manifest.json`.

## Android build and fonts

Open `android/` in Android Studio, use JDK 17, and sync the Gradle project. With Gradle 8.9+ installed locally, build the debug APK with:

```sh
gradle -p android :app:assembleDebug
```

Font binaries are intentionally not included. To use the design fonts:

1. Download Inter Tight and JetBrains Mono TTF files from their official releases.
2. Place the files in `android/app/src/main/res/font/` using lowercase resource names such as `inter_tight.ttf` and `jetbrains_mono.ttf`.
3. Replace the `FontFamily.SansSerif` and `FontFamily.Monospace` values in `ui/theme/Type.kt` with Compose `FontFamily(Font(R.font.inter_tight, ...))` definitions.

The current theme uses system sans-serif and monospace fallbacks until those assets are supplied.

## Local backend development

```sh
cd backend
python -m venv .venv
# Activate .venv for your shell, then:
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In Windows PowerShell, copy the example with `Copy-Item .env.example .env`.

API documentation is available at `/api/docs` while the backend is running.

## Project status

The web foundation, channel/anti-spam workflows, backend API, Docker routing, and Android screen foundation are present. Android assembly and live Telegram flows require a configured Android toolchain, backend credentials, and Telegram connectivity; binary fonts and PWA icons are documented above rather than checked into this text-only scaffold.

## Platform notice

Aurogram is an unofficial third-party client. Users are responsible for complying with applicable Telegram terms, platform rules, and local laws when operating accounts, bots, channels, and automation.
