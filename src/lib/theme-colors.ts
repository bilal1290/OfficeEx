export interface ThemeColorOverrides {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  danger: string;
}

export type ThemeColorKey = keyof ThemeColorOverrides;

export interface ThemeColorField {
  key: ThemeColorKey;
  label: string;
  hint: string;
}

export const THEME_COLOR_FIELDS: ThemeColorField[] = [
  { key: 'primary', label: 'Brand', hint: 'Buttons, links, and highlights' },
  { key: 'accent', label: 'Accent', hint: 'Charts, badges, and secondary emphasis' },
  { key: 'bg', label: 'Background', hint: 'Page backdrop behind content' },
  { key: 'surface', label: 'Surface', hint: 'Cards, panels, and inputs' },
  { key: 'danger', label: 'Expenses', hint: 'Negative amounts and alerts' },
];

export interface StoredCustomColors {
  enabled: boolean;
  light: ThemeColorOverrides;
  dark: ThemeColorOverrides;
}

const STORAGE_KEY = 'officeex-custom-colors';

const CSS_VARS_TO_CLEAR = [
  '--primary',
  '--primary-hover',
  '--primary-light',
  '--accent',
  '--accent-light',
  '--bg',
  '--surface',
  '--surface-hover',
  '--border',
  '--danger',
  '--danger-light',
  '--gradient-brand',
  '--gradient-surface',
  '--gradient-spend',
  '--nav-bg',
  '--nav-border',
  '--bg-glow-a',
  '--bg-glow-b',
  '--glow',
] as const;

const DEFAULT_LIGHT: ThemeColorOverrides = {
  primary: '#145A45',
  accent: '#1F7A5C',
  bg: '#EEF4F1',
  surface: '#FCFEFD',
  danger: '#B83C3C',
};

const DEFAULT_DARK: ThemeColorOverrides = {
  primary: '#5CB894',
  accent: '#5CB894',
  bg: '#07110D',
  surface: '#101E18',
  danger: '#F08888',
};

export function defaultCustomColors(): StoredCustomColors {
  return {
    enabled: false,
    light: { ...DEFAULT_LIGHT },
    dark: { ...DEFAULT_DARK },
  };
}

export function readStoredCustomColors(): StoredCustomColors {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCustomColors();
    const parsed = JSON.parse(raw) as Partial<StoredCustomColors>;
    return {
      enabled: parsed.enabled ?? false,
      light: { ...DEFAULT_LIGHT, ...parsed.light },
      dark: { ...DEFAULT_DARK, ...parsed.dark },
    };
  } catch {
    return defaultCustomColors();
  }
}

export function writeStoredCustomColors(value: StoredCustomColors) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function isValidHexColor(value: string): boolean {
  return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(value.trim());
}

function cssColorToHex(value: string): string | null {
  const trimmed = value.trim();
  if (isValidHexColor(trimmed)) return normalizeHex(trimmed);
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return rgbToHex(
      Number(rgbMatch[1]),
      Number(rgbMatch[2]),
      Number(rgbMatch[3]),
    );
  }
  return null;
}

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return trimmed.toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex);
  const match = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/.exec(normalized);
  if (!match) return null;
  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function mixHex(base: string, target: string, weight: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(target);
  if (!a || !b) return base;
  const ratio = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    a.r + (b.r - a.r) * ratio,
    a.g + (b.g - a.g) * ratio,
    a.b + (b.b - a.b) * ratio,
  );
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function shiftHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
}

export function sanitizeColorOverrides(
  input: Partial<ThemeColorOverrides>,
  fallback: ThemeColorOverrides,
): ThemeColorOverrides {
  const result = { ...fallback };
  for (const field of THEME_COLOR_FIELDS) {
    const value = input[field.key];
    if (value && isValidHexColor(value)) {
      result[field.key] = normalizeHex(value);
    }
  }
  return result;
}

export function readComputedThemeColors(
  scheme: 'light' | 'dark',
): ThemeColorOverrides {
  if (typeof window === 'undefined') {
    return scheme === 'dark' ? { ...DEFAULT_DARK } : { ...DEFAULT_LIGHT };
  }

  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return cssColorToHex(value) ?? fallback;
  };

  const defaults = scheme === 'dark' ? DEFAULT_DARK : DEFAULT_LIGHT;
  return {
    primary: read('--primary', defaults.primary),
    accent: read('--accent', defaults.accent),
    bg: read('--bg', defaults.bg),
    surface: read('--surface', defaults.surface),
    danger: read('--danger', defaults.danger),
  };
}

export function applyCustomThemeColors(
  colors: ThemeColorOverrides,
  scheme: 'light' | 'dark',
) {
  const root = document.documentElement;
  const primary = normalizeHex(colors.primary);
  const accent = normalizeHex(colors.accent);
  const bg = normalizeHex(colors.bg);
  const surface = normalizeHex(colors.surface);
  const danger = normalizeHex(colors.danger);

  const primaryHover =
    scheme === 'dark' ? shiftHex(primary, 18) : shiftHex(primary, -14);
  const primaryLight = mixHex(surface, primary, scheme === 'dark' ? 0.22 : 0.12);
  const accentLight = mixHex(surface, accent, scheme === 'dark' ? 0.2 : 0.14);
  const surfaceHover = mixHex(surface, primary, scheme === 'dark' ? 0.12 : 0.08);
  const border = mixHex(surface, primary, scheme === 'dark' ? 0.35 : 0.28);
  const dangerLight = mixHex(surface, danger, scheme === 'dark' ? 0.22 : 0.14);

  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-hover', primaryHover);
  root.style.setProperty('--primary-light', primaryLight);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-light', accentLight);
  root.style.setProperty('--bg', bg);
  root.style.setProperty('--surface', surface);
  root.style.setProperty('--surface-hover', surfaceHover);
  root.style.setProperty('--border', border);
  root.style.setProperty('--danger', danger);
  root.style.setProperty('--danger-light', dangerLight);
  root.style.setProperty(
    '--gradient-brand',
    `linear-gradient(135deg, ${primary} 0%, ${accent} 55%, ${mixHex(accent, '#FFFFFF', 0.2)} 100%)`,
  );
  root.style.setProperty(
    '--gradient-surface',
    `linear-gradient(145deg, ${surface} 0%, ${mixHex(surface, primary, 0.1)} 100%)`,
  );
  root.style.setProperty(
    '--gradient-spend',
    `linear-gradient(90deg, ${primary} 0%, ${accent} 100%)`,
  );
  root.style.setProperty('--nav-bg', withAlpha(surface, scheme === 'dark' ? 0.92 : 0.88));
  root.style.setProperty(
    '--nav-border',
    withAlpha(scheme === 'dark' ? surface : primary, scheme === 'dark' ? 0.08 : 0.07),
  );
  root.style.setProperty('--bg-glow-a', withAlpha(accent, scheme === 'dark' ? 0.08 : 0.14));
  root.style.setProperty('--bg-glow-b', withAlpha(primary, scheme === 'dark' ? 0.06 : 0.1));
  root.style.setProperty(
    '--glow',
    `0 0 0 1px ${withAlpha(primary, 0.14)}, 0 8px 32px ${withAlpha(accent, 0.12)}`,
  );
}

export function clearCustomThemeColors() {
  const root = document.documentElement;
  for (const variable of CSS_VARS_TO_CLEAR) {
    root.style.removeProperty(variable);
  }
}

export function capturePaletteForBothSchemes(
  restoreScheme: 'light' | 'dark',
): { light: ThemeColorOverrides; dark: ThemeColorOverrides } {
  const root = document.documentElement;
  clearCustomThemeColors();
  root.setAttribute('data-theme', 'light');
  const light = readComputedThemeColors('light');
  root.setAttribute('data-theme', 'dark');
  const dark = readComputedThemeColors('dark');
  root.setAttribute('data-theme', restoreScheme);
  return { light, dark };
}

export function capturePaletteForScheme(
  scheme: 'light' | 'dark',
): ThemeColorOverrides {
  const root = document.documentElement;
  const previous = root.getAttribute('data-theme') as 'light' | 'dark' | null;
  clearCustomThemeColors();
  root.setAttribute('data-theme', scheme);
  const colors = readComputedThemeColors(scheme);
  if (previous) {
    root.setAttribute('data-theme', previous);
  }
  return colors;
}

export function colorsForScheme(
  stored: StoredCustomColors,
  scheme: 'light' | 'dark',
): ThemeColorOverrides {
  return scheme === 'dark' ? stored.dark : stored.light;
}

export function updateSchemeColors(
  stored: StoredCustomColors,
  scheme: 'light' | 'dark',
  patch: Partial<ThemeColorOverrides>,
): StoredCustomColors {
  const current = colorsForScheme(stored, scheme);
  const next = sanitizeColorOverrides({ ...current, ...patch }, current);
  return {
    ...stored,
    [scheme]: next,
  };
}
