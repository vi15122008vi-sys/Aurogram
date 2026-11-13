import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { themeList } from "../src/lib/themes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, "../docs/theme-preview.html");

function themeCard(theme) {
  const { colors, glass } = theme;
  const swatch = (name, value, sample = value) =>
    `<li><span class="dot" style="background:${sample}"></span><span class="sw">${name}</span><code>${value}</code></li>`;

  return `
  <article class="card" style="--canvas:${colors.canvas};--surface:${colors.surface};--raised:${colors.raised};--ink:${colors.ink};--muted:${colors.muted};--accent:${colors.accent};--accent-strong:${colors.accentStrong};--glow:${glass.glow};--fill:${glass.fill};--border:${glass.border};--highlight:${glass.highlight};--on-accent:${glass.onAccent};--blur:${glass.blur}">
    <header>
      <h2>${theme.name}</h2>
      <span class="tag">${theme.id}${theme.dark ? "" : " · light"}</span>
    </header>
    <div class="glass">
      <p class="kicker">INBOX / CHANNEL</p>
      <p class="title">Стеклянная карточка</p>
      <p class="muted">blur ${glass.blur} · border ${glass.border}</p>
      <div class="row">
        <button class="accent-btn">Опубликовать</button>
        <button class="ghost-btn">Статистика</button>
      </div>
    </div>
    <ul class="swatches">
      ${swatch("canvas", colors.canvas)}
      ${swatch("surface", colors.surface)}
      ${swatch("raised", colors.raised)}
      ${swatch("accent", colors.accent)}
      ${swatch("accentStrong", colors.accentStrong)}
      ${swatch("onAccent", glass.onAccent)}
      ${swatch("ghost", colors.ghost)}
    </ul>
  </article>`;
}

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Aurogram · превью тем</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; background: #050506; color: #f4f4f5; font-family: "Inter Tight", "Segoe UI", system-ui, sans-serif; }
  h1 { font-size: 26px; margin: 0 0 6px; }
  .lead { color: #a1a1aa; margin: 0 0 28px; max-width: 70ch; font-size: 14px; line-height: 1.5; }
  .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  .card { border-radius: 26px; padding: 18px; color: var(--ink);
    background:
      radial-gradient(ellipse at 8% -10%, color-mix(in srgb, var(--accent) 15%, transparent), transparent 16rem),
      radial-gradient(ellipse at 95% 8%, var(--glow), transparent 15rem),
      linear-gradient(145deg, var(--canvas) 0%, color-mix(in srgb, var(--surface) 60%, var(--canvas)) 55%, var(--surface) 100%);
    border: 1px solid var(--border); }
  .card header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 14px; }
  .card h2 { font-size: 16px; margin: 0; letter-spacing: -0.01em; }
  .tag { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .glass { border-radius: 22px; padding: 14px; border: 1px solid var(--border);
    background: linear-gradient(145deg, var(--fill), color-mix(in srgb, var(--surface) 58%, transparent));
    box-shadow: 0 12px 36px rgb(0 0 0 / 12%), inset 0 1px 0 var(--highlight);
    -webkit-backdrop-filter: blur(var(--blur)) saturate(180%); backdrop-filter: blur(var(--blur)) saturate(180%); }
  .kicker { margin: 0 0 6px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; letter-spacing: .16em; color: var(--accent); }
  .title { margin: 0; font-size: 15px; font-weight: 600; }
  .muted { margin: 4px 0 12px; font-size: 11px; color: var(--muted); font-family: "JetBrains Mono", ui-monospace, monospace; }
  .row { display: flex; gap: 8px; }
  button { font: inherit; font-size: 12px; font-weight: 600; border-radius: 12px; padding: 9px 12px; cursor: pointer; }
  .accent-btn { border: 0; background: var(--accent); color: var(--on-accent); box-shadow: inset 0 1px 0 var(--highlight), 0 6px 18px color-mix(in srgb, var(--accent) 28%, transparent); }
  .accent-btn:hover { background: var(--accent-strong); }
  .ghost-btn { border: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 40%, transparent); color: var(--ink); }
  .swatches { list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 12px; margin: 14px 0 0; padding: 0; }
  .swatches li { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 10px; color: var(--muted); }
  .dot { width: 10px; height: 10px; border-radius: 50%; border: 1px solid rgb(255 255 255 / 18%); flex: 0 0 auto; }
  .sw { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .swatches code { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9px; opacity: .8; }
</style>
</head>
<body>
  <h1>Aurogram · превью тем</h1>
  <p class="lead">Файл сгенерирован из <code>web/src/lib/themes.ts</code> (npm run themes:preview). Каждая карточка показывает реальные токены своей темы: фон с двумя свечениями, стеклянную карточку с blur и inset-бликом, акцентную кнопку с цветом текста из темы.</p>
  <div class="grid">${themeList.map(themeCard).join("")}
  </div>
</body>
</html>
`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log(`theme preview written: ${outputPath} (${themeList.length} themes)`);
