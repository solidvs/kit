import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './tokens.css';
import './base.css';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ColorMode = 'light' | 'dark' | 'auto';

type ColorModeContextValue = {
  /** The user's choice. */
  colorMode: ColorMode;
  /** What is on screen: `auto` resolved against the operating system. */
  resolvedColorMode: 'light' | 'dark';
  setColorMode: (mode: ColorMode) => void;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

type PlatformProviderProps = {
  children: ReactNode;
  /** Light by default in every system (ADR-0011); dark and "same as the system" are user choices. */
  defaultColorMode?: ColorMode;
};

/**
 * Root provider of every platform interface: loads the fonts (Inter and JetBrains Mono, SIL OFL 1.1,
 * self-hosted), the tokens and the base styles, and applies the color mode to `<html>`.
 */
export function PlatformProvider({ children, defaultColorMode = 'light' }: PlatformProviderProps) {
  const [colorMode, setColorMode] = useState<ColorMode>(defaultColorMode);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (colorMode !== 'auto' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => setSystemDark(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [colorMode]);

  const resolvedColorMode = colorMode === 'auto' ? (systemDark ? 'dark' : 'light') : colorMode;

  // Applied during render as well as in the effect, so the first paint already has the right theme.
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-color-mode', resolvedColorMode);
  useEffect(() => {
    document.documentElement.setAttribute('data-color-mode', resolvedColorMode);
  }, [resolvedColorMode]);

  const set = useCallback((mode: ColorMode) => setColorMode(mode), []);
  const value = useMemo(() => ({ colorMode, resolvedColorMode, setColorMode: set }), [colorMode, resolvedColorMode, set]);

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export function useColorMode(): ColorModeContextValue {
  const value = useContext(ColorModeContext);
  if (!value) throw new Error('useColorMode must be used inside PlatformProvider');
  return value;
}
