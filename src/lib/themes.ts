export type ThemePresetId = 'forest' | 'midnight' | 'ocean' | 'slate' | 'rose';

export type ColorScheme = 'light' | 'dark' | 'system';

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  description: string;
  swatch: [string, string];
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'forest',
    label: 'Forest',
    description: 'Bottle green ledger — default OfficeEx look',
    swatch: ['#145A45', '#1F9A72'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep navy with violet accents',
    swatch: ['#1E3A5F', '#6366F1'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Cool teal and sky blues',
    swatch: ['#0E7490', '#38BDF8'],
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Neutral graphite for focused work',
    swatch: ['#334155', '#64748B'],
  },
  {
    id: 'rose',
    label: 'Rose',
    description: 'Warm plum and soft coral',
    swatch: ['#9D174D', '#FB7185'],
  },
];

export function isThemePresetId(value: string): value is ThemePresetId {
  return THEME_PRESETS.some((preset) => preset.id === value);
}

export function resolveColorScheme(
  scheme: ColorScheme,
  prefersDark: boolean,
): 'light' | 'dark' {
  if (scheme === 'system') {
    return prefersDark ? 'dark' : 'light';
  }
  return scheme;
}
