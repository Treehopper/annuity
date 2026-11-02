import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from './theme/useTheme';
import { font, radius, space, systemFont, tabular, touch } from './theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/* ---------- Text ---------- */

type Variant = 'body' | 'muted' | 'title' | 'heading' | 'section' | 'small' | 'amount' | 'amountLarge' | 'display';

const variantStyle: Record<Variant, TextStyle> = {
  body: { fontSize: font.m },
  muted: { fontSize: font.s },
  small: { fontSize: font.xs },
  title: { fontSize: font.xl, fontWeight: '700' },
  heading: { fontSize: font.l, fontWeight: '600' },
  section: { fontSize: font.xs, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  amount: { fontSize: font.m, ...tabular, textAlign: 'right' },
  amountLarge: { fontSize: font.xl, fontWeight: '700', ...tabular },
  display: { fontSize: 72, fontWeight: '300' },
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: 'text' | 'textMuted' | 'primary' | 'positive' | 'warning' | 'danger' | 'onPrimary';
  bold?: boolean;
  italic?: boolean;
}

export function Text({ variant = 'body', color, bold, italic, style, ...rest }: AppTextProps) {
  const { c } = useTheme();
  const tone = color ?? (variant === 'muted' || variant === 'section' || variant === 'small' ? 'textMuted' : 'text');
  return (
    <RNText
      {...rest}
      style={[
        { color: c[tone], fontFamily: systemFont },
        variantStyle[variant],
        bold && { fontWeight: '700' },
        italic && { fontStyle: 'italic' },
        style,
      ]}
    />
  );
}

/* ---------- Layout primitives ---------- */

export function Card({ style, children, ...rest }: ViewProps & { children?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View
      {...rest}
      style={[{ backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: radius.l, padding: space.l, gap: space.s }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.l, marginBottom: space.s }}>
      <Text variant="section" accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.border, marginVertical: space.s }, style]} />;
}

/** Label on the left, tabular amount on the right. */
export function ValueRow({
  label,
  value,
  emphasis,
  color,
  italic,
  indent,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  emphasis?: boolean;
  color?: AppTextProps['color'];
  italic?: boolean;
  indent?: boolean;
  icon?: ReactNode;
}) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.m, paddingLeft: indent ? space.l : 0 }}
      accessible
      accessibilityLabel={typeof label === 'string' && typeof value === 'string' ? `${label} ${value}` : undefined}>
      <Text variant={indent ? 'muted' : 'body'} style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Text variant="amount" bold={emphasis} color={color} italic={italic}>
          {value}
        </Text>
        {icon}
      </View>
    </View>
  );
}

/* ---------- Buttons ---------- */

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  compact?: boolean;
}

export function Button({ label, onPress, kind = 'primary', icon, disabled, loading, style, testID, compact }: ButtonProps) {
  const { c } = useTheme();
  const bg = kind === 'primary' ? c.primary : kind === 'danger' ? c.danger : kind === 'secondary' ? c.surfaceAlt : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? c.onPrimary : c.primary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: touch,
          paddingHorizontal: compact ? space.m : space.l,
          borderRadius: radius.m,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.s,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: c.border,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <RNText style={{ color: fg, fontSize: font.m, fontWeight: '600', fontFamily: systemFont }}>{label}</RNText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color,
  size = 22,
  testID,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  color?: string;
  size?: number;
  testID?: string;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({
        width: touch,
        height: touch,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}>
      <Ionicons name={icon} size={size} color={color ?? c.primary} />
    </Pressable>
  );
}

export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color?: string }) {
  const { c } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? c.text} accessibilityElementsHidden importantForAccessibility="no" />;
}

/* ---------- Chips, badges, segmented ---------- */

export function Chip({ label, selected, onPress, testID }: { label: string; selected?: boolean; onPress?: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 36,
        paddingHorizontal: space.m,
        borderRadius: radius.pill,
        justifyContent: 'center',
        backgroundColor: selected ? c.primary : c.surfaceAlt,
        borderWidth: 1,
        borderColor: selected ? c.primary : c.border,
        opacity: pressed ? 0.75 : 1,
      })}>
      <RNText style={{ color: selected ? c.onPrimary : c.text, fontSize: font.s, fontWeight: selected ? '700' : '500', fontFamily: systemFont }}>{label}</RNText>
    </Pressable>
  );
}

export function StatusBadge({ status, label }: { status: 'offer' | 'active' | 'closed'; label: string }) {
  const { c } = useTheme();
  const color = status === 'active' ? c.positive : c.textMuted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }} accessible accessibilityLabel={label}>
      <View
        style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: status === 'active' ? color : 'transparent', borderWidth: 1.5, borderColor: color }}
      />
      <RNText style={{ color, fontSize: font.xs, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: systemFont }}>
        {label}
      </RNText>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: radius.m, padding: 3, borderWidth: 1, borderColor: c.border }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              minHeight: 38,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.s + 1,
              paddingHorizontal: space.s,
              backgroundColor: sel ? c.surface : 'transparent',
              borderWidth: sel ? 1 : 0,
              borderColor: c.border,
            }}>
            <RNText
              numberOfLines={1}
              style={{ color: sel ? c.primary : c.text, fontWeight: sel ? '700' : '500', fontSize: font.s, fontFamily: systemFont }}>
              {o.label}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Form fields ---------- */

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
  suffix?: string;
  right?: ReactNode;
  align?: 'left' | 'right';
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function Field({ label, error, hint, suffix, right, align = 'left', containerStyle, inputStyle, editable = true, ...input }: FieldProps) {
  const { c } = useTheme();
  return (
    <View style={[{ gap: space.xs }, containerStyle]}>
      <Text variant="muted">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: touch,
            borderWidth: 1,
            borderColor: error ? c.danger : c.border,
            borderRadius: radius.m,
            backgroundColor: editable ? c.surface : c.surfaceAlt,
            paddingHorizontal: space.m,
          }}>
          <TextInput
            accessibilityLabel={label}
            editable={editable}
            placeholderTextColor={c.textMuted}
            {...input}
            style={[
              { flex: 1, minWidth: 0, color: c.text, fontSize: font.m, paddingVertical: space.s, fontFamily: systemFont, textAlign: align },
              align === 'right' && tabular,
              // Remove the browser focus ring offset; the border shows focus state.
              { outlineStyle: 'none' } as unknown as TextStyle,
              inputStyle,
            ]}
          />
          {suffix ? (
            <Text variant="muted" style={{ marginLeft: space.xs }}>
              {suffix}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
      {error ? (
        <Text variant="small" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small">{hint}</Text>
      ) : null}
    </View>
  );
}

export function Toggle({ label, value, onChange, disabled, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: touch, gap: space.m }}>
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
        {hint ? <Text variant="small">{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: c.primary, false: c.border }}
        thumbColor={c.surface}
        {...({ activeThumbColor: c.surface } as object)}
      />
    </View>
  );
}

/** Tappable list row with chevron (settings-style). */
export function LinkRow({ label, value, onPress, testID, selected }: { label: string; value?: string; onPress?: () => void; testID?: string; selected?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: touch + 4,
        gap: space.s,
        paddingHorizontal: space.s,
        borderRadius: radius.m,
        backgroundColor: selected ? c.surfaceAlt : pressed ? c.surfaceAlt : 'transparent',
      })}>
      <Text style={{ flex: 1 }}>{label}</Text>
      {value ? <Text variant="muted">{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </Pressable>
  );
}

export function Banner({ text, tone = 'warning', action, icon }: { text: string; tone?: 'warning' | 'positive' | 'primary'; action?: ReactNode; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s,
        padding: space.m,
        borderRadius: radius.m,
        borderWidth: 1,
        borderColor: c[tone],
        backgroundColor: c.surface,
        flexWrap: 'wrap',
      }}>
      {icon ? <Ionicons name={icon} size={18} color={c[tone]} /> : null}
      <Text style={{ flex: 1, minWidth: 160 }} color={tone}>
        {text}
      </Text>
      {action}
    </View>
  );
}
