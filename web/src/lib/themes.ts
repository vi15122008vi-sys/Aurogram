export type ThemeId = "aurogram" | "paper" | "mint" | "sky" | "ghost" | "midnight" | "ocean" | "sunset" | "orange" | "halloween";

/** Семантические цвета темы. Каждое значение уходит в CSS-переменную через {@link applyTheme}. */
export interface ThemeColors {
  canvas: string;
  surface: string;
  raised: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentStrong: string;
  success: string;
  warning: string;
  danger: string;
  ghost: string;
}

/**
 * Слой Liquid Glass: у каждой темы собственные «стеклянные» параметры,
 * поэтому карточки, кнопки и фон не сливаются между темами.
 */
export interface ThemeGlass {
  /** Волосяная обводка (1px) вместо жёсткой рамки. */
  border: string;
  /** Тонированный верхний блик в градиенте стекла. */
  fill: string;
  /** Внутренняя световая кромка (inset highlight). */
  highlight: string;
  /** Второе фоновое свечение — характер темы. */
  glow: string;
  /** Сила размытия подложки. */
  blur: string;
  /** Цвет текста и иконок на акцентной кнопке. */
  onAccent: string;
}

export interface AurogramTheme {
  id: ThemeId;
  name: string;
  dark: boolean;
  colors: ThemeColors;
  glass: ThemeGlass;
}

/**
 * Десять визуально различимых тем: у каждой свой фон, свои карточки
 * и свой акцент. Контраст ink/canvas ≥ 14:1, акцент-текста ≥ 3:1,
 * текста на акцентной кнопке ≥ 3.7:1.
 */
export const aurogramThemes: Record<ThemeId, AurogramTheme> = {
  aurogram: {
    id: "aurogram",
    name: "Aurogram Dark",
    dark: true,
    colors: {
      canvas: "#0A0A0C", surface: "#111114", raised: "#191920", ink: "#FAFAFA", muted: "#A1A1AA",
      line: "rgba(255,255,255,0.032)", accent: "#6366F1", accentStrong: "#818CF8", success: "#22C55E",
      warning: "#F59E0B", danger: "#EF4444", ghost: "#A78BFA",
    },
    glass: {
      border: "rgba(255,255,255,0.030)", fill: "rgba(255,255,255,0.045)",
      highlight: "rgba(255,255,255,0.08)", glow: "rgb(99 102 241 / 16%)", blur: "26px", onAccent: "#FFFFFF",
    },
  },
  paper: {
    id: "paper",
    name: "Paper",
    dark: false,
    colors: {
      canvas: "#F7F7F8", surface: "#FFFFFF", raised: "#F0F0F3", ink: "#18181B", muted: "#6B6B75",
      line: "rgba(24,24,27,0.04)", accent: "#18181B", accentStrong: "#3F3F46", success: "#15803D",
      warning: "#B45309", danger: "#B91C1C", ghost: "#6D28D9",
    },
    glass: {
      border: "rgba(24,24,27,0.04)", fill: "rgba(255,255,255,0.70)",
      highlight: "rgba(255,255,255,0.92)", glow: "rgb(113 113 122 / 8%)", blur: "20px", onAccent: "#FFFFFF",
    },
  },
  mint: {
    id: "mint",
    name: "Mint",
    dark: false,
    colors: {
      canvas: "#EAF6EF", surface: "#FFFFFF", raised: "#DDEDE4", ink: "#10241A", muted: "#587264",
      line: "rgba(16,36,26,0.04)", accent: "#067A55", accentStrong: "#056347", success: "#15803D",
      warning: "#B45309", danger: "#B91C1C", ghost: "#6D5BD0",
    },
    glass: {
      border: "rgba(16,36,26,0.04)", fill: "rgba(255,255,255,0.66)",
      highlight: "rgba(255,255,255,0.92)", glow: "rgb(6 122 85 / 12%)", blur: "22px", onAccent: "#FFFFFF",
    },
  },
  sky: {
    id: "sky",
    name: "Sky",
    dark: false,
    colors: {
      canvas: "#ECF4FB", surface: "#FFFFFF", raised: "#DEEBF7", ink: "#0F1E2B", muted: "#557086",
      line: "rgba(15,30,43,0.04)", accent: "#0284C7", accentStrong: "#0369A1", success: "#15803D",
      warning: "#B45309", danger: "#B91C1C", ghost: "#6D5BD0",
    },
    glass: {
      border: "rgba(15,30,43,0.04)", fill: "rgba(255,255,255,0.66)",
      highlight: "rgba(255,255,255,0.92)", glow: "rgb(2 132 199 / 12%)", blur: "24px", onAccent: "#FFFFFF",
    },
  },
  ghost: {
    id: "ghost",
    name: "Ghost",
    dark: true,
    colors: {
      canvas: "#101322", surface: "#171B2E", raised: "#202640", ink: "#F7F7FF", muted: "#A8ABC2",
      line: "rgba(255,255,255,0.036)", accent: "#8B5CF6", accentStrong: "#A78BFA", success: "#22C55E",
      warning: "#F59E0B", danger: "#EF4444", ghost: "#C4B5FD",
    },
    glass: {
      border: "rgba(255,255,255,0.038)", fill: "rgba(139,92,246,0.08)",
      highlight: "rgba(255,255,255,0.10)", glow: "rgb(139 92 246 / 18%)", blur: "30px", onAccent: "#FFFFFF",
    },
  },
  midnight: {
    id: "midnight",
    name: "Midnight",
    dark: true,
    colors: {
      canvas: "#06080F", surface: "#0C111C", raised: "#141B2A", ink: "#F3F6FB", muted: "#94A0B6",
      line: "rgba(255,255,255,0.034)", accent: "#EAB308", accentStrong: "#FACC15", success: "#22C55E",
      warning: "#FDE047", danger: "#EF4444", ghost: "#A78BFA",
    },
    glass: {
      border: "rgba(255,255,255,0.032)", fill: "rgba(234,179,8,0.05)",
      highlight: "rgba(255,255,255,0.08)", glow: "rgb(234 179 8 / 12%)", blur: "26px", onAccent: "#1A1206",
    },
  },
  ocean: {
    id: "ocean",
    name: "Ocean",
    dark: true,
    colors: {
      canvas: "#04121A", surface: "#0A1E29", raised: "#112D3B", ink: "#E9F9FF", muted: "#8CAEBD",
      line: "rgba(255,255,255,0.036)", accent: "#0891B2", accentStrong: "#06B6D4", success: "#22C55E",
      warning: "#F59E0B", danger: "#EF4444", ghost: "#A78BFA",
    },
    glass: {
      border: "rgba(255,255,255,0.032)", fill: "rgba(6,182,212,0.07)",
      highlight: "rgba(255,255,255,0.08)", glow: "rgb(6 182 212 / 16%)", blur: "30px", onAccent: "#FFFFFF",
    },
  },
  sunset: {
    id: "sunset",
    name: "Sunset",
    dark: true,
    colors: {
      canvas: "#140710", surface: "#1F0C18", raised: "#2C1222", ink: "#FFF4F8", muted: "#C3A2B0",
      line: "rgba(255,255,255,0.036)", accent: "#E11D48", accentStrong: "#FB7185", success: "#22C55E",
      warning: "#FBBF24", danger: "#EF4444", ghost: "#C4B5FD",
    },
    glass: {
      border: "rgba(255,255,255,0.034)", fill: "rgba(244,63,94,0.07)",
      highlight: "rgba(255,255,255,0.08)", glow: "rgb(244 63 94 / 16%)", blur: "24px", onAccent: "#FFFFFF",
    },
  },
  orange: {
    id: "orange",
    name: "Orange",
    dark: true,
    colors: {
      canvas: "#1A0E05", surface: "#261607", raised: "#341E0C", ink: "#FFF6EC", muted: "#C9A98C",
      line: "rgba(255,255,255,0.038)", accent: "#F97316", accentStrong: "#FB923C", success: "#22C55E",
      warning: "#FBBF24", danger: "#EF4444", ghost: "#C084FC",
    },
    glass: {
      border: "rgba(255,255,255,0.036)", fill: "rgba(249,115,22,0.08)",
      highlight: "rgba(255,255,255,0.09)", glow: "rgb(249 115 22 / 18%)", blur: "26px", onAccent: "#1A0B02",
    },
  },
  halloween: {
    id: "halloween",
    name: "Halloween",
    dark: true,
    colors: {
      canvas: "#150B22", surface: "#1F1030", raised: "#2C1642", ink: "#FBF5FF", muted: "#B9A5CB",
      line: "rgba(255,255,255,0.038)", accent: "#C026D3", accentStrong: "#D946EF", success: "#4ADE80",
      warning: "#FDE047", danger: "#EF4444", ghost: "#FB923C",
    },
    glass: {
      border: "rgba(255,255,255,0.036)", fill: "rgba(192,38,211,0.09)",
      highlight: "rgba(255,255,255,0.10)", glow: "rgb(251 146 60 / 16%)", blur: "32px", onAccent: "#FFFFFF",
    },
  },
};

export const themeList = Object.values(aurogramThemes);

/** CSS-переменные для цветов — единственное место, где цвета попадают в DOM. */
const colorVariables: Record<keyof ThemeColors, string> = {
  canvas: "--canvas",
  surface: "--surface",
  raised: "--raised",
  ink: "--ink",
  muted: "--muted",
  line: "--line",
  accent: "--accent",
  accentStrong: "--accent-strong",
  success: "--success",
  warning: "--warning",
  danger: "--danger",
  ghost: "--ghost",
};

export function getTheme(themeId: ThemeId): AurogramTheme {
  return aurogramThemes[themeId] ?? aurogramThemes.aurogram;
}

/** «99 102 241» из «#6366F1» — каналы для rgb(var(--token-rgb) / <alpha-value>). */
function channels(value: string): string | null {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(hex)) return null;
  const full = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16)).join(" ");
}

/**
 * Применяет тему к документу.
 * Значения пишутся inline в `:root`, поэтому `index.css` содержит только
 * базовые (aurogram) значения и общую «стеклянную» геометрию — расхождения
 * между превью в ThemePicker и реальным видом больше невозможны.
 *
 * Кроме самого цвета (`--accent`) для каждого hex-токена пишутся каналы
 * (`--accent-rgb`): без них Tailwind не умеет alpha-модификаторы вроде
 * `bg-accent/10`, на которых держатся стеклянные тинты.
 */
export function applyTheme(themeId: ThemeId): void {
  if (typeof document === "undefined") return;
  const theme = getTheme(themeId);
  const root = document.documentElement;

  for (const [key, property] of Object.entries(colorVariables) as Array<[keyof ThemeColors, string]>) {
    const value = theme.colors[key];
    root.style.setProperty(property, value);
    const rgb = channels(value);
    if (rgb) root.style.setProperty(`${property}-rgb`, rgb);
  }

  root.style.setProperty("--surface-raised", theme.colors.raised);
  root.style.setProperty("--surface-raised-rgb", channels(theme.colors.raised) ?? "");
  root.style.setProperty("--border", theme.glass.border);
  root.style.setProperty("--glass-fill", theme.glass.fill);
  root.style.setProperty("--glass-highlight", theme.glass.highlight);
  root.style.setProperty("--glass-blur", theme.glass.blur);
  root.style.setProperty("--theme-glow", theme.glass.glow);
  root.style.setProperty("--on-accent", theme.glass.onAccent);
  root.style.setProperty("color-scheme", theme.dark ? "dark" : "light");
  root.dataset.theme = theme.id;

  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.colors.canvas);
}

