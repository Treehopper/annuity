import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Button, IconButton, Text } from './components';
import { useLayoutClass } from './layout/layout';
import type { PanelAction } from './layout/chrome';
import { useTheme } from './theme/useTheme';
import { radius, space, touch } from './theme/tokens';

/* ---------- AdaptiveSheet: bottom sheet in compact, centered dialog otherwise (§4.12 rule 8) ---------- */

export function AdaptiveSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  testID,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
}) {
  const { c } = useTheme();
  const cls = useLayoutClass();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = cls === 'compact';
  return (
    <Modal visible={visible} transparent animationType={compact ? 'slide' : 'fade'} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: compact ? 'flex-end' : 'center', alignItems: 'center' }}>
        <Pressable
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' } as never}
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          style={{
            width: compact ? '100%' : 520,
            maxWidth: '100%',
            maxHeight: height * (compact ? 0.92 : 0.85),
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.l + 4,
            borderTopRightRadius: radius.l + 4,
            borderBottomLeftRadius: compact ? 0 : radius.l + 4,
            borderBottomRightRadius: compact ? 0 : radius.l + 4,
            paddingBottom: compact ? insets.bottom : 0,
            borderWidth: 1,
            borderColor: c.border,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: space.l, paddingRight: space.xs, paddingTop: space.xs }}>
            <Text variant="heading" style={{ flex: 1 }} accessibilityRole="header">
              {title}
            </Text>
            <IconButton icon="close" label="Close" onPress={onClose} color={c.textMuted} />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.l, paddingTop: space.s, gap: space.m }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={{ padding: space.l, paddingTop: 0, flexDirection: 'row', gap: space.s, justifyContent: 'flex-end' }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Confirmation dialogs (the web viewer has no window.confirm in all contexts) ---------- */

interface ConfirmRequest {
  title: string;
  text?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

const useConfirmStore = create<{ req?: ConfirmRequest; set: (r?: ConfirmRequest) => void }>((set) => ({
  set: (req) => set({ req }),
}));

export function askConfirm(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.getState().set({ ...opts, resolve }));
}

export function ConfirmHost() {
  const { req, set } = useConfirmStore();
  const { c } = useTheme();
  if (!req) return null;
  const done = (ok: boolean) => {
    set(undefined);
    req.resolve(ok);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => done(false)}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View
          testID="confirm-dialog"
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={{ width: 420, maxWidth: '100%', backgroundColor: c.surface, borderRadius: radius.l + 4, padding: space.xl, gap: space.m, borderWidth: 1, borderColor: c.border }}>
          <Text variant="heading">{req.title}</Text>
          {req.text ? <Text variant="muted">{req.text}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.s, marginTop: space.s, flexWrap: 'wrap' }}>
            <Button kind="ghost" label={req.cancelLabel} onPress={() => done(false)} testID="confirm-cancel" />
            <Button kind={req.destructive ? 'danger' : 'primary'} label={req.confirmLabel} onPress={() => done(true)} testID="confirm-ok" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Anchored ⋮ menu ---------- */

export function Menu({ actions, label, testID, icon = 'ellipsis-vertical' }: { actions: PanelAction[]; label: string; testID?: string; icon?: 'ellipsis-vertical' | 'ellipsis-horizontal' }) {
  const { c } = useTheme();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | undefined>();
  const { width } = useWindowDimensions();
  const open = () =>
    anchor.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      setPos({ top: y + h + 2, right: Math.max(space.s, width - (x + w)) });
    });
  if (actions.length === 0) return null;
  return (
    <>
      <View ref={anchor} collapsable={false}>
        <IconButton icon={icon} label={label} onPress={open} testID={testID} color={c.text} />
      </View>
      <Modal visible={!!pos} transparent animationType="fade" onRequestClose={() => setPos(undefined)}>
        <Pressable style={{ flex: 1 }} onPress={() => setPos(undefined)} accessibilityLabel="Close menu">
          <View
            accessibilityRole="menu"
            style={{
              position: 'absolute',
              top: pos?.top ?? 0,
              right: pos?.right ?? 0,
              minWidth: 220,
              backgroundColor: c.surface,
              borderRadius: radius.m,
              borderWidth: 1,
              borderColor: c.border,
              paddingVertical: space.xs,
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}>
            {actions.map((a) => (
              <Pressable
                key={a.key}
                testID={a.testID ?? `menu-${a.key}`}
                accessibilityRole="menuitem"
                disabled={a.disabled}
                onPress={() => {
                  setPos(undefined);
                  a.onPress();
                }}
                style={({ pressed }) => ({
                  minHeight: touch,
                  paddingHorizontal: space.l,
                  justifyContent: 'center',
                  backgroundColor: pressed ? c.surfaceAlt : 'transparent',
                  opacity: a.disabled ? 0.45 : 1,
                })}>
                <Text color={a.destructive ? 'danger' : 'text'}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/* ---------- Snackbar ---------- */

export function Snackbar({ message, actionLabel, onAction, onTimeout, duration = 5000 }: { message: string; actionLabel?: string; onAction?: () => void; onTimeout: () => void; duration?: number }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const t = setTimeout(onTimeout, duration);
    return () => clearTimeout(t);
  }, [message, duration, onTimeout]);
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 72, alignItems: 'center', paddingHorizontal: space.l }}>
      <View
        testID="snackbar"
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.m,
          backgroundColor: c.text,
          borderRadius: radius.m,
          paddingLeft: space.l,
          paddingRight: space.xs,
          minHeight: 48,
          maxWidth: 560,
          width: '100%',
        }}>
        <Text style={{ flex: 1, color: c.bg }}>{message}</Text>
        {actionLabel ? (
          <Pressable accessibilityRole="button" onPress={onAction} style={{ minHeight: touch, justifyContent: 'center', paddingHorizontal: space.m }} testID="snackbar-action">
            <Text bold style={{ color: c.bg }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
