export type ThemeId = "aurogram" | "paper" | "mint" | "sky" | "sand" | "sakura" | "ice" | "ghost" | "midnight" | "ocean" | "sunset" | "orange" | "halloween" | "christmas" | "newyear";

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
  /** Праздничный декор поверх интерфейса (снежинки/конфетти). */
  decor?: "snow" | "confetti";
}

/**
 * Пятнадцать визуально различимых тем: у каждой свой фон, свои карточки
 * и свой акцент. Контраст ink/canvas ≥ 14:1, акцент-текста ≥ 3:1,
 * текста на акцентной кнопке ≥ 3.7:1.
 */
export const aurogramThemes: Record<ThemeId, AurogramTheme> = {
  aurogram: {
    id: "aurogram",
    name: "Aurogram Dark",
    dark: true,
    colors: {
      canvas: "#121212", surface: "#1A1A1F", raised: "#242430", ink: "#F7F7FA", muted: "#B0B0BC",
      line: "rgba(255,255,255,0.032)", accent: "#7C7FF5", accentStrong: "#A5B4FC", success: "#34D399",
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
      line: "rgba(15,30,43,0.04)", accent: "#0369A1", accentStrong: "#075985", success: "#15803D",
      warning: "#B45309", danger: "#B91C1C", ghost: "#6D5BD0",
    },
    glass: {
      border: "rgba(15,30,43,0.04)", fill: "rgba(255,255,255,0.66)",
      highlight: "rgba(255,255,255,0.92)", glow: "rgb(2 132 199 / 12%)", blur: "24px", onAccent: "#FFFFFF",
    },
  },
  sand: {
    id: "sand",
    name: "Sand",
    dark: false,
    colors: {
      canvas: "#FDF6E3", surface: "#FFFCF2", raised: "#F3E7C9", ink: "#333333", muted: "#6E5B45",
      line: "rgba(51,51,51,0.07)", accent: "#8B4513", accentStrong: "#6E3610", success: "#15803D",
      warning: "#B45309", danger: "#B91C1C", ghost: "#A16207",
    },
    glass: {
      border: "rgba(139,69,19,0.10)", fill: "rgba(255,252,242,0.74)",
      highlight: "rgba(255,255,255,0.96)", glow: "rgb(139 69 19 / 16%)", blur: "24px", onAccent: "#FFFFFF",
    },
  },
  sakura: {
    id: "sakura",
    name: "Sakura",
    dark: false,
    colors: {
      canvas: "#FFF0F5", surface: "#FFFFFF", raised: "#FAD4E2", ink: "#1A1A1A", muted: "#7A4459",
      line: "rgba(26,26,26,0.07)", accent: "#C2185B", accentStrong: "#AD1457", success: "#15803D",
      warning: "#B45309", danger: "#B91C1C", ghost: "#9D174D",
    },
    glass: {
      border: "rgba(233,30,99,0.10)", fill: "rgba(255,255,255,0.72)",
      highlight: "rgba(255,255,255,0.96)", glow: "rgb(233 30 99 / 18%)", blur: "24px", onAccent: "#FFFFFF",
    },
  },
  ice: {
    id: "ice",
    name: "Ice",
    dark: false,
    colors: {
      canvas: "#E0F2FE", surface: "#FFFFFF", raised: "#CBE7F9", ink: "#0F172A", muted: "#4A6076",
      line: "rgba(15,23,42,0.07)", accent: "#0369A1", accentStrong: "#075985", success: "#15803D",
      warning: "#B45309", danger: "#B91C1C", ghost: "#4F46E5",
    },
    glass: {
      border: "rgba(2,132,199,0.12)", fill: "rgba(255,255,255,0.70)",
      highlight: "rgba(255,255,255,0.97)", glow: "rgb(2 132 199 / 20%)", blur: "26px", onAccent: "#FFFFFF",
    },
  },
  ghost: {
    id: "ghost",
    name: "Ghost",
    dark: true,
    colors: {
      canvas: "#161A2C", surface: "#1F2440", raised: "#2A3150", ink: "#F8F8FF", muted: "#B3B8D2",
      line: "rgba(255,255,255,0.036)", accent: "#A78BFA", accentStrong: "#C4B5FD", success: "#34D399",
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
      canvas: "#10141F", surface: "#161C2B", raised: "#1F2740", ink: "#F5F8FD", muted: "#A6B2C8",
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
      canvas: "#0B1B26", surface: "#142A38", raised: "#1C3A4A", ink: "#ECFBFF", muted: "#A2C2D2",
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
      canvas: "#1B1018", surface: "#2A1522", raised: "#3A1B2C", ink: "#FFF5F9", muted: "#D2B2C0",
      line: "rgba(255,255,255,0.036)", accent: "#FB7185", accentStrong: "#FDA4AF", success: "#22C55E",
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
      canvas: "#1F1409", surface: "#31200D", raised: "#422913", ink: "#FFF8F0", muted: "#D8BCA0",
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
      canvas: "#0C0A14", surface: "#171126", raised: "#221736", ink: "#FCF8FF", muted: "#CDBCDD",
      line: "rgba(255,255,255,0.040)", accent: "#FF7F50", accentStrong: "#FF9E7A", success: "#4ADE80",
      warning: "#FDE047", danger: "#FF5C5C", ghost: "#8A2BE2",
    },
    glass: {
      border: "rgba(255,127,80,0.12)", fill: "rgba(255,127,80,0.09)",
      highlight: "rgba(255,255,255,0.10)", glow: "rgb(138 43 226 / 22%)", blur: "32px", onAccent: "#14060D",
    },
  },
  christmas: {
    id: "christmas",
    name: "Christmas",
    dark: true,
    decor: "snow",
    colors: {
      canvas: "#0F1F15", surface: "#16291D", raised: "#1F3A28", ink: "#F2FFF7", muted: "#A9C9B6",
      line: "rgba(255,255,255,0.040)", accent: "#FF5A65", accentStrong: "#FF7A83", success: "#34D399",
      warning: "#FFD700", danger: "#FF6B6B", ghost: "#FFD700",
    },
    glass: {
      border: "rgba(230,57,70,0.14)", fill: "rgba(230,57,70,0.08)",
      highlight: "rgba(255,255,255,0.10)", glow: "rgb(230 57 70 / 20%)", blur: "26px", onAccent: "#FFFFFF",
    },
  },
  newyear: {
    id: "newyear",
    name: "New Year",
    dark: true,
    decor: "confetti",
    colors: {
      canvas: "#0A192F", surface: "#11243F", raised: "#1A3151", ink: "#F5FAFF", muted: "#9FB3CE",
      line: "rgba(255,255,255,0.045)", accent: "#FFD700", accentStrong: "#FFE44D", success: "#34D399",
      warning: "#FBBF24", danger: "#FF7B72", ghost: "#C0C0C0",
    },
    glass: {
      border: "rgba(255,215,0,0.14)", fill: "rgba(255,215,0,0.07)",
      highlight: "rgba(255,255,255,0.12)", glow: "rgb(255 215 0 / 20%)", blur: "28px", onAccent: "#0A192F",
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
  root.dataset.theme = theme.id;
  window.dispatchEvent(new CustomEvent("aurogram:theme", { detail: theme.id }));
  root.style.setProperty("--on-accent", theme.glass.onAccent);
  root.style.setProperty("color-scheme", theme.dark ? "dark" : "light");

  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.colors.canvas);
}

