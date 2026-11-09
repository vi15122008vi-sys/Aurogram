import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        ghost: "var(--ghost)",
      },
      fontFamily: {
        sans: ["Inter Tight", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;