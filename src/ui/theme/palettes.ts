import type { PaletteId } from '@alp/core';

/** Design tokens (README §6.15). */
export interface Tokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  positive: string;
  warning: string;
  danger: string;
  chart1: string;
  chart2: string;
  chart3: string;
}

export type Mode = 'light' | 'dark';

type Base = Omit<Tokens, 'chart1'>;
const withChart = (t: Base): Tokens => ({ ...t, chart1: t.primary });

export const palettes: Record<PaletteId, Record<Mode, Tokens>> = {
  classic: {
    light: withChart({ bg: '#F5F7FA', surface: '#FFFFFF', surfaceAlt: '#EAEEF3', border: '#D3DAE3', text: '#1A2330', textMuted: '#566273', primary: '#1C6E8C', onPrimary: '#F5F7FA', positive: '#1D7A4E', warning: '#94580A', danger: '#B42318', chart2: '#C2410C', chart3: '#7C3AED' }),
    dark: withChart({ bg: '#0E141B', surface: '#161E27', surfaceAlt: '#1F2934', border: '#2C3947', text: '#E6EBF1', textMuted: '#9BA8B7', primary: '#5DB9D8', onPrimary: '#0E141B', positive: '#4CC38A', warning: '#F2B84B', danger: '#F7837A', chart2: '#F59E5B', chart3: '#B69CFA' }),
  },
  solarized: {
    light: withChart({ bg: '#FDF6E3', surface: '#EEE8D5', surfaceAlt: '#E4DDC8', border: '#D6CFBA', text: '#073642', textMuted: '#4F6369', primary: '#1D6CA2', onPrimary: '#FDF6E3', positive: '#5D6B00', warning: '#826200', danger: '#CA2522', chart2: '#CB4B16', chart3: '#6C71C4' }),
    dark: withChart({ bg: '#002B36', surface: '#073642', surfaceAlt: '#0D4050', border: '#1E4E5A', text: '#EEE8D5', textMuted: '#9BA8A8', primary: '#48A0DE', onPrimary: '#002B36', positive: '#8EA300', warning: '#C49500', danger: '#E87775', chart2: '#D44E17', chart3: '#7075C5' }),
  },
  nord: {
    light: withChart({ bg: '#ECEFF4', surface: '#FFFFFF', surfaceAlt: '#E5E9F0', border: '#D8DEE9', text: '#2E3440', textMuted: '#4C566A', primary: '#4D6D95', onPrimary: '#ECEFF4', positive: '#597442', warning: '#A85237', danger: '#B44953', chart2: '#C77055', chart3: '#A87CA0' }),
    dark: withChart({ bg: '#2E3440', surface: '#3B4252', surfaceAlt: '#434C5E', border: '#4C566A', text: '#ECEFF4', textMuted: '#B8C0CE', primary: '#88C0D0', onPrimary: '#2E3440', positive: '#A3BE8C', warning: '#EBCB8B', danger: '#D89FA4', chart2: '#D08770', chart3: '#B48EAD' }),
  },
  gruvbox: {
    light: withChart({ bg: '#FBF1C7', surface: '#F9F5D7', surfaceAlt: '#F2E5BC', border: '#D5C4A1', text: '#3C3836', textMuted: '#665C54', primary: '#076678', onPrimary: '#FBF1C7', positive: '#74700D', warning: '#956110', danger: '#9D0006', chart2: '#AF3A03', chart3: '#8F3F71' }),
    dark: withChart({ bg: '#282828', surface: '#32302F', surfaceAlt: '#3C3836', border: '#504945', text: '#EBDBB2', textMuted: '#BDAE93', primary: '#83A598', onPrimary: '#282828', positive: '#B8BB26', warning: '#FABD2F', danger: '#FC6857', chart2: '#FE8019', chart3: '#D3869B' }),
  },
  catppuccin: {
    light: withChart({ bg: '#EFF1F5', surface: '#FFFFFF', surfaceAlt: '#E6E9EF', border: '#CCD0DA', text: '#4C4F69', textMuted: '#65687D', primary: '#145FF5', onPrimary: '#EFF1F5', positive: '#327C21', warning: '#976014', danger: '#D20F39', chart2: '#EF5801', chart3: '#8839EF' }),
    dark: withChart({ bg: '#1E1E2E', surface: '#313244', surfaceAlt: '#45475A', border: '#585B70', text: '#CDD6F4', textMuted: '#AFB6CE', primary: '#89B4FA', onPrimary: '#1E1E2E', positive: '#A6E3A1', warning: '#F9E2AF', danger: '#F38BA8', chart2: '#FAB387', chart3: '#CBA6F7' }),
  },
};

export const paletteNames: Record<PaletteId, string> = {
  classic: 'Classic',
  solarized: 'Solarized',
  nord: 'Nord',
  gruvbox: 'Gruvbox',
  catppuccin: 'Catppuccin',
};

/* ---------- WCAG contrast (used by the palette unit test) ---------- */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Contrast requirements per token (§6.15): [token, backgrounds, minimum ratio]. */
export const contrastRequirements: [keyof Tokens, (keyof Tokens)[], number][] = [
  ['text', ['bg', 'surface', 'surfaceAlt'], 4.5],
  ['textMuted', ['bg', 'surface', 'surfaceAlt'], 4.5],
  ['primary', ['bg', 'surface'], 4.5],
  ['onPrimary', ['primary'], 4.5],
  ['positive', ['bg', 'surface'], 4.5],
  ['warning', ['bg', 'surface'], 4.5],
  ['danger', ['bg', 'surface'], 4.5],
  ['chart1', ['bg', 'surface'], 3],
  ['chart2', ['bg', 'surface'], 3],
  ['chart3', ['bg', 'surface'], 3],
];
