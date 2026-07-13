import { CURRENCY_OPTIONS } from '../../lib/constants';
import { Select } from './Select';
import type { CurrencyCode } from '../../types';

interface CurrencySelectProps {
  label?: string;
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  required?: boolean;
}

export function CurrencySelect({
  label = 'Currency',
  value,
  onChange,
  required,
}: CurrencySelectProps) {
  return (
    <Select
      label={label}
      options={CURRENCY_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      }))}
      value={value}
      onChange={(event) => onChange(event.target.value as CurrencyCode)}
      required={required}
    />
  );
}
