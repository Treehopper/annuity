import { createContext, useContext, useState, type ReactNode } from 'react';
import { View, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

/** Layout classes by window width, not device type (§4.12). */
export type LayoutClass = 'compact' | 'medium' | 'expanded';

export function layoutClassFor(width: number): LayoutClass {
  return width < 600 ? 'compact' : width < 840 ? 'medium' : 'expanded';
}

export function useLayoutClass(): LayoutClass {
  return layoutClassFor(useWindowDimensions().width);
}

export function listPaneWidth(cls: LayoutClass): number {
  return cls === 'expanded' ? 360 : 320;
}

const PaneWidthContext = createContext<number | undefined>(undefined);

/** Measures itself and provides its width to panels (§4.12 rule 6). */
export function Pane({ children, style, initialWidth }: { children: ReactNode; style?: StyleProp<ViewStyle>; initialWidth?: number }) {
  const window = useWindowDimensions();
  const [width, setWidth] = useState<number | undefined>(initialWidth);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };
  return (
    <View style={[{ flex: 1, minWidth: 0 }, style]} onLayout={onLayout}>
      <PaneWidthContext.Provider value={width ?? initialWidth ?? window.width}>{children}</PaneWidthContext.Provider>
    </View>
  );
}

/** Width of the enclosing pane; falls back to the window width. */
export function usePaneWidth(): number {
  const window = useWindowDimensions();
  return useContext(PaneWidthContext) ?? window.width;
}

/** Fixed-width pane for tests and the dev gallery. */
export function FixedPane({ width, children }: { width: number; children: ReactNode }) {
  return <PaneWidthContext.Provider value={width}>{children}</PaneWidthContext.Provider>;
}
