import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  applyCustomThemeColors,
  capturePaletteForBothSchemes,
  capturePaletteForScheme,
  clearCustomThemeColors,
  colorsForScheme,
  defaultCustomColors,
  readStoredCustomColors,
  updateSchemeColors,
  writeStoredCustomColors,
  type StoredCustomColors,
  type ThemeColorKey,
  type ThemeColorOverrides,
} from '../lib/theme-colors';
import {
  isThemePresetId,
  resolveColorScheme,
  type ColorScheme,
  type ThemePresetId,
} from '../lib/themes';

interface ThemeContextValue {
  themePreset: ThemePresetId;
  colorScheme: ColorScheme;
  resolvedColorScheme: 'light' | 'dark';
  customColorsEnabled: boolean;
  customColors: ThemeColorOverrides;
  setThemePreset: (preset: ThemePresetId) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setCustomColorsEnabled: (enabled: boolean) => void;
  setCustomColor: (key: ThemeColorKey, value: string) => void;
  resetCustomColors: () => void;
  syncCustomColorsFromPalette: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  toggleColorScheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const PRESET_STORAGE_KEY = 'officeex-theme-preset';
const SCHEME_STORAGE_KEY = 'officeex-color-scheme';

function readPreset(): ThemePresetId {
  const stored = localStorage.getItem(PRESET_STORAGE_KEY);
  return stored && isThemePresetId(stored) ? stored : 'forest';
}

function readScheme(): ColorScheme {
  const stored = localStorage.getItem(SCHEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  const legacy = localStorage.getItem('officeex-theme');
  if (legacy === 'light' || legacy === 'dark') return legacy;
  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreset, setThemePresetState] = useState<ThemePresetId>(readPreset);
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(readScheme);
  const [customColorState, setCustomColorState] = useState<StoredCustomColors>(
    readStoredCustomColors,
  );
  const [prefersDark, setPrefersDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );
  const presetRef = useRef(themePreset);

  const resolvedColorScheme = useMemo(
    () => resolveColorScheme(colorScheme, prefersDark),
    [colorScheme, prefersDark],
  );

  const customColors = useMemo(
    () => colorsForScheme(customColorState, resolvedColorScheme),
    [customColorState, resolvedColorScheme],
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setPrefersDark(media.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme-preset', themePreset);
    document.documentElement.setAttribute('data-theme', resolvedColorScheme);
    localStorage.setItem(PRESET_STORAGE_KEY, themePreset);
    localStorage.setItem(SCHEME_STORAGE_KEY, colorScheme);
    localStorage.setItem('officeex-theme', resolvedColorScheme);
  }, [themePreset, colorScheme, resolvedColorScheme]);

  useEffect(() => {
    writeStoredCustomColors(customColorState);
  }, [customColorState]);

  useEffect(() => {
    if (customColorState.enabled) {
      applyCustomThemeColors(customColors, resolvedColorScheme);
      return;
    }
    clearCustomThemeColors();
  }, [customColorState.enabled, customColors, resolvedColorScheme]);

  useEffect(() => {
    if (!customColorState.enabled || presetRef.current === themePreset) {
      presetRef.current = themePreset;
      return;
    }

    presetRef.current = themePreset;
    const frameId = requestAnimationFrame(() => {
      setCustomColorState((current) => ({
        ...current,
        [resolvedColorScheme]: capturePaletteForScheme(resolvedColorScheme),
      }));
    });

    return () => cancelAnimationFrame(frameId);
  }, [themePreset, customColorState.enabled, resolvedColorScheme]);

  const setThemePreset = useCallback((preset: ThemePresetId) => {
    setThemePresetState(preset);
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
  }, []);

  const setCustomColorsEnabled = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        setCustomColorState(defaultCustomColors());
        return;
      }

      requestAnimationFrame(() => {
        setCustomColorState((current) => ({
          enabled: true,
          light:
            resolvedColorScheme === 'light'
              ? capturePaletteForScheme('light')
              : current.light,
          dark:
            resolvedColorScheme === 'dark'
              ? capturePaletteForScheme('dark')
              : current.dark,
        }));
      });
    },
    [resolvedColorScheme],
  );

  const setCustomColor = useCallback(
    (key: ThemeColorKey, value: string) => {
      setCustomColorState((current) => ({
        ...updateSchemeColors(current, resolvedColorScheme, { [key]: value }),
        enabled: true,
      }));
    },
    [resolvedColorScheme],
  );

  const resetCustomColors = useCallback(() => {
    requestAnimationFrame(() => {
      const { light, dark } = capturePaletteForBothSchemes(resolvedColorScheme);
      setCustomColorState({
        enabled: true,
        light,
        dark,
      });
    });
  }, [resolvedColorScheme]);

  const syncCustomColorsFromPalette = useCallback(() => {
    setCustomColorState((current) => ({
      ...current,
      enabled: true,
      [resolvedColorScheme]: capturePaletteForScheme(resolvedColorScheme),
    }));
  }, [resolvedColorScheme]);

  const toggleColorScheme = useCallback(() => {
    setColorSchemeState((current) => {
      const resolved = resolveColorScheme(current, prefersDark);
      return resolved === 'light' ? 'dark' : 'light';
    });
  }, [prefersDark]);

  const value = useMemo(
    () => ({
      themePreset,
      colorScheme,
      resolvedColorScheme,
      customColorsEnabled: customColorState.enabled,
      customColors,
      setThemePreset,
      setColorScheme,
      setCustomColorsEnabled,
      setCustomColor,
      resetCustomColors,
      syncCustomColorsFromPalette,
      theme: resolvedColorScheme,
      toggleTheme: toggleColorScheme,
      toggleColorScheme,
    }),
    [
      themePreset,
      colorScheme,
      resolvedColorScheme,
      customColorState.enabled,
      customColors,
      setThemePreset,
      setColorScheme,
      setCustomColorsEnabled,
      setCustomColor,
      resetCustomColors,
      syncCustomColorsFromPalette,
      toggleColorScheme,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
