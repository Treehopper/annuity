import type { PaletteId } from '@alp/core';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useAppStore } from '@/store/appStore';

import { palettes, type Mode, type Tokens } from './palettes';

export interface Theme {
  palette: PaletteId;
  mode: Mode;
  c: Tokens;
}

const ThemeContext = createContext<Theme>({ palette: 'classic', mode: 'light', c: palettes.classic.light });

/** Effective tokens = palettes[settings.palette][mode] (§6.15). */
export function ThemeProvider({ children, override }: { children: ReactNode; override?: Partial<Pick<Theme, 'palette' | 'mode'>> }) {
  const system = useColorScheme();
  const settings = useAppStore((s) => s.settings);
  const palette = override?.palette ?? settings?.palette ?? 'classic';
  const appearance = settings?.appearance ?? 'system';
  const mode: Mode = override?.mode ?? (appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance);
  const value = useMemo(() => ({ palette, mode, c: palettes[palette][mode] }), [palette, mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
