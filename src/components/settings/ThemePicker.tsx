import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { THEME_PRESETS, type ColorScheme } from '../../lib/themes';
import { clsx } from '../../lib/utils';
import { ThemeColorEditor } from './ThemeColorEditor';

const SCHEME_OPTIONS: {
  id: ColorScheme;
  label: string;
  icon: typeof Sun;
}[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

export function ThemePicker() {
  const {
    themePreset,
    colorScheme,
    resolvedColorScheme,
    customColorsEnabled,
    setThemePreset,
    setColorScheme,
  } = useTheme();

  return (
    <div className="theme-picker">
      <div className="theme-picker-section">
        <p className="theme-picker-label">Palette</p>
        <div className="theme-picker-grid">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={clsx(
                'theme-picker-option',
                themePreset === preset.id && 'theme-picker-option-active',
              )}
              onClick={() => setThemePreset(preset.id)}
              aria-pressed={themePreset === preset.id}
            >
              <span className="theme-picker-swatch" aria-hidden>
                <span style={{ background: preset.swatch[0] }} />
                <span style={{ background: preset.swatch[1] }} />
              </span>
              <span className="theme-picker-option-copy">
                <strong>{preset.label}</strong>
                <span>{preset.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="theme-picker-section">
        <p className="theme-picker-label">Appearance</p>
        <div className="theme-picker-schemes">
          {SCHEME_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={clsx(
                'theme-picker-scheme',
                colorScheme === id && 'theme-picker-scheme-active',
              )}
              onClick={() => setColorScheme(id)}
              aria-pressed={colorScheme === id}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
        <p className="theme-picker-note">
          Currently showing{' '}
          <strong>{resolvedColorScheme === 'dark' ? 'dark' : 'light'}</strong>{' '}
          mode
          {colorScheme === 'system' ? ' (follows your device)' : ''}.
          {customColorsEnabled ? ' Custom colors are active.' : ''}
        </p>
      </div>

      <ThemeColorEditor />
    </div>
  );
}
