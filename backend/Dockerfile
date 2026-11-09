# ---- Stage: build admin.css with Tailwind CLI ----
FROM node:20-alpine AS tailwind
WORKDIR /build
COPY app/admin/static/tailwind.input.css ./input.css
COPY app/admin/templates ./templates
RUN npm install -g tailwindcss@3.4.15 \
 && printf '%s\n' \
    'module.exports={content:["./templates/**/*.html"],theme:{extend:{colors:{accent:"var(--accent)"},fontFamily:{sans:["Inter Tight","sans-serif"],mono:["JetBrains Mono","monospace"]}}},plugins:[]}' \
    > tailwind.config.js \
 && npx tailwindcss -i ./input.css -o ./admin.css --minify

# ---- Stage: runtime ----
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc libssl-dev libffi-dev libmagic1 ffmpeg \
      supervisor curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app ./app
COPY supervisord.conf /app/supervisord.conf
COPY --from=tailwind /build/admin.css /app/app/admin/static/admin.css

RUN mkdir -p /app/sessions /app/cache_data /app/media_data \
 && chmod 700 /app/sessions

EXPOSE 8000

CMD ["supervisord", "-c", "/app/supervisord.conf"]
