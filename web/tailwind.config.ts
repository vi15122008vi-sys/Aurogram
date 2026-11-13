import type { Config } from "tailwindcss";

/** Цвет из темы с поддержкой alpha-модификаторов: bg-accent/10, border-line/40 и т.д.
 *  Каналы пишет applyTheme (web/src/lib/themes.ts) как «R G B». */
const themed = (token: string) => `rgb(var(--${token}-rgb) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: themed("canvas"),
        surface: themed("surface"),
        surfaceRaised: themed("surface-raised"),
        border: "var(--border)",
        raised: themed("raised"),
        ink: themed("ink"),
        muted: themed("muted"),
        line: "var(--line)",
        accent: themed("accent"),
        "accent-strong": themed("accent-strong"),
        success: themed("success"),
        warning: themed("warning"),
        danger: themed("danger"),
        ghost: themed("ghost"),
      },
      fontFamily: {
        sans: ["Inter Tight", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backdropBlur: {
        glass: "24px",
      },
      borderRadius: {
        "glass-card": "20px",
        "glass-modal": "28px",
      },
    },
  },
  plugins: [],
} satisfies Config;
