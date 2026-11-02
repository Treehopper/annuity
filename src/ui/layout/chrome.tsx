import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { IconName } from '../components';

/** Header data a panel declares; the layout decides how to render it (§4.12 rule 7). */
export interface PanelAction {
  key: string;
  label: string;
  icon?: IconName;
  onPress: () => void;
  /** Shown as a header button instead of inside the ⋮ menu. */
  primary?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}

export interface PanelChrome {
  title?: string;
  badge?: { status: 'offer' | 'active' | 'closed'; label: string };
  actions?: PanelAction[];
}

type Setter = (c: PanelChrome) => void;
const ChromeContext = createContext<Setter | undefined>(undefined);

export function ChromeProvider({ onChange, children }: { onChange: Setter; children: ReactNode }) {
  return <ChromeContext.Provider value={onChange}>{children}</ChromeContext.Provider>;
}

/**
 * Declares the panel's title, badge and actions. Pass a memoized object or primitives
 * via deps, since the chrome is re-published whenever deps change.
 */
export function usePanelChrome(chrome: PanelChrome, deps: unknown[]) {
  const set = useContext(ChromeContext);
  useEffect(() => {
    set?.(chrome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useChromeState(): [PanelChrome, Setter] {
  return useState<PanelChrome>({});
}
