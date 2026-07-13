import { useCurrency } from '../../context/CurrencyContext';
import { resolveCurrency } from '../../lib/currency';
import type { CurrencyCode } from '../../types';

interface AmountDisplayProps {
  amount: number;
  currency?: CurrencyCode;
  className?: string;
  showConverted?: boolean;
}

export function AmountDisplay({
  amount,
  currency,
  className,
  showConverted = true,
}: AmountDisplayProps) {
  const { formatNative, format, displayCurrency } = useCurrency();
  const nativeCurrency = resolveCurrency(currency);

  return (
    <span className={className}>
      <span className="amount-native">{formatNative(amount, nativeCurrency)}</span>
      {showConverted && nativeCurrency !== displayCurrency && (
        <span className="amount-converted"> ≈ {format(amount, currency)}</span>
      )}
    </span>
  );
}
