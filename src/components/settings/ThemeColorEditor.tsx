import { RotateCcw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { THEME_COLOR_FIELDS, isValidHexColor } from '../../lib/theme-colors';
import { Button } from '../ui/Button';

export function ThemeColorEditor() {
  const {
    resolvedColorScheme,
    customColorsEnabled,
    customColors,
    setCustomColorsEnabled,
    setCustomColor,
    resetCustomColors,
    syncCustomColorsFromPalette,
  } = useTheme();

  return (
    <div className="theme-color-editor">
      <div className="theme-color-editor-header">
        <div>
          <p className="theme-picker-label">Custom colors</p>
          <p className="theme-color-editor-desc">
            Override palette colors for{' '}
            <strong>{resolvedColorScheme === 'dark' ? 'dark' : 'light'}</strong>{' '}
            mode. Changes apply instantly.
          </p>
        </div>
        <label className="theme-color-toggle">
          <input
            type="checkbox"
            checked={customColorsEnabled}
            onChange={(event) => setCustomColorsEnabled(event.target.checked)}
          />
          <span>Use custom colors</span>
        </label>
      </div>

      {customColorsEnabled && (
        <>
          <div className="theme-color-grid">
            {THEME_COLOR_FIELDS.map(({ key, label, hint }) => (
              <label key={key} className="theme-color-field">
                <span className="theme-color-field-label">{label}</span>
                <span className="theme-color-field-control">
                  <input
                    type="color"
                    value={customColors[key]}
                    onChange={(event) => setCustomColor(key, event.target.value)}
                    aria-label={`${label} color`}
                  />
                  <input
                    type="text"
                    className="theme-color-hex"
                    value={customColors[key]}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (isValidHexColor(value) || value.startsWith('#')) {
                        setCustomColor(key, value);
                      }
                    }}
                    spellCheck={false}
                    maxLength={7}
                  />
                </span>
                <span className="theme-color-field-hint">{hint}</span>
              </label>
            ))}
          </div>

          <div className="theme-color-preview" aria-hidden>
            <span className="theme-color-preview-chip brand">Brand</span>
            <span className="theme-color-preview-chip accent">Accent</span>
            <span className="theme-color-preview-chip surface">Surface</span>
            <span className="theme-color-preview-chip danger">Expense</span>
          </div>

          <div className="theme-color-actions">
            <Button variant="secondary" size="sm" onClick={syncCustomColorsFromPalette}>
              Pull from current palette
            </Button>
            <Button variant="ghost" size="sm" onClick={resetCustomColors}>
              <RotateCcw size={15} />
              Reset all colors
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
