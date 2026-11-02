import { createElement } from 'react';
import { View } from 'react-native';

import { Text } from '../components';
import { useTheme } from '../theme/useTheme';
import { font, radius, space, touch } from '../theme/tokens';

import type { DateFieldProps } from './DateField';

/** Native browser date picker (the iOS wheel picker in Safari / home-screen apps). */
export function DateField({ label, value, onChange, error, disabled, testID, min, max, optional }: DateFieldProps) {
  const { c, mode } = useTheme();
  return (
    <View style={{ gap: space.xs, flex: 1, minWidth: 150 }}>
      <Text variant="muted">{label}</Text>
      {createElement('input', {
        type: 'date',
        value: value ?? '',
        min,
        max,
        required: !optional,
        disabled,
        'aria-label': label,
        'data-testid': testID,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value || undefined),
        style: {
          minHeight: touch,
          boxSizing: 'border-box',
          width: '100%',
          border: `1px solid ${error ? c.danger : c.border}`,
          borderRadius: radius.m,
          background: disabled ? c.surfaceAlt : c.surface,
          color: c.text,
          fontSize: font.m,
          padding: `0 ${space.m}px`,
          fontFamily: 'inherit',
          colorScheme: mode,
          WebkitAppearance: 'none',
          appearance: 'none',
          display: 'flex',
          alignItems: 'center',
        },
      })}
      {error ? (
        <Text variant="small" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
