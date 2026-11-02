import { Platform } from 'react-native';

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 6, m: 10, l: 14, pill: 999 } as const;
export const font = { xs: 12, s: 14, m: 16, l: 18, xl: 22, xxl: 28 } as const;
/** Minimum touch target (§6.15). */
export const touch = 44;
export const tabular = { fontVariant: ['tabular-nums' as const] };
export const systemFont = Platform.select({ web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', default: undefined });
