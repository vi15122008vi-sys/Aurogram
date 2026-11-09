export type ThemeId = "aurogram" | "paper" | "mint" | "sky" | "ghost" | "midnight" | "ocean" | "sunset";

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

export interface AurogramTheme {
  id: ThemeId;
  name: string;
  dark: boolean;
  colors: ThemeColors;
}

export const aurogramThemes: Record<ThemeId, AurogramTheme> = {
  aurogram: {
    id: "aurogram",
    name: "Aurogram Dark",
    dark: true,
    colors: {
      canvas: "#0A0A0B", surface: "#111113", raised: "#18181B", ink: "#FAFAFA", muted: "#A1A1AA",
      line: "rgba(255,255,255,0.06)", accent: "#6366F1", accentStrong: "#818CF8", success: "#22C55E",
      warning: "#F59E0B", danger: "#EF4444", ghost: "#A78BFA",
    },
  },
  paper: {
    id: "paper", name: "Paper", dark: false,
    colors: {
      canvas: "#F7F7F8", surface: "#FFFFFF", raised: "#F1F1F3", ink: "#18181B", muted: "#71717A",
      line: "rgba(24,24,27,0.09)", accent: "#18181B", accentStrong: "#3F3F46", success: "#15803D",
      warning: "#B45309", danger: "#B91C1C", ghost: "#7C3AED",
    },
  },
  mint: {
    id: "mint", name: "Mint", dark: false,
    colors: {
      canvas: "#F2F8F5", surface: "#FFFFFF", raised: "#E9F2ED", ink: "#17211B", muted: "#65756A",
      line: "rgba(23,33,27,0.09)", accent: "#10B981", accentStrong: "#059669", success: "#15803D",
      warning: "#B45309", danger: "#B91C1C", ghost: "#6D5BD0",
    },
  },
  sky: {
    id: "sky", name: "Sky", dark: false,
    colors: {
      canvas: "#F2F7FA", surface: "#FFFFFF", raised: "#E9F1F6", ink: "#14202A", muted: "#647584",
      line: "rgba(20,32,42,0.09)", accent: "#0EA5E9", accentStrong: "#0284C7", success: "#15803D",
      warning: "#B45309", danger: "#B91C1C", ghost: "#7658C8",
    },
  },
  ghost: {
    id: "ghost", name: "Ghost", dark: true,
    colors: {
      canvas: "#0C0B10", surface: "#14121A", raised: "#1C1924", ink: "#FAF8FF", muted: "#AAA4B5",
      line: "rgba(255,255,255,0.07)", accent: "#A78BFA", accentStrong: "#C4B5FD", success: "#22C55E",
      warning: "#F59E0B", danger: "#EF4444", ghost: "#C4B5FD",
    },
  },
  midnight: {
    id: "midnight", name: "Midnight", dark: true,
    colors: {
      canvas: "#07070A", surface: "#101013", raised: "#19191D", ink: "#F7F7F8", muted: "#A1A1AA",
      line: "rgba(255,255,255,0.07)", accent: "#F59E0B", accentStrong: "#FBBF24", success: "#22C55E",
      warning: "#FCD34D", danger: "#EF4444", ghost: "#A78BFA",
    },
  },
  ocean: {
    id: "ocean", name: "Ocean", dark: true,
    colors: {
      canvas: "#061016", surface: "#0C1920", raised: "#12232C", ink: "#F0FBFF", muted: "#9BB0BA",
      line: "rgba(255,255,255,0.07)", accent: "#06B6D4", accentStrong: "#22D3EE", success: "#22C55E",
      warning: "#F59E0B", danger: "#EF4444", ghost: "#A78BFA",
    },
  },
  sunset: {
    id: "sunset", name: "Sunset", dark: true,
    colors: {
      canvas: "#10080C", surface: "#1A1015", raised: "#24151C", ink: "#FFF7F8", muted: "#C0A8AE",
      line: "rgba(255,255,255,0.07)", accent: "#F43F5E", accentStrong: "#FB7185", success: "#22C55E",
      warning: "#F59E0B", danger: "#EF4444", ghost: "#C4B5FD",
    },
  },
};

export const themeList = Object.values(aurogramThemes);

export function applyTheme(themeId: ThemeId): void {
  document.documentElement.dataset.theme = themeId;
}