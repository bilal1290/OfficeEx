import type { CurrencyCode, ExchangeRates } from '../types';

export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

/** 1 USD equals this many PKR (admin-configurable). */
export const DEFAULT_USD_TO_PKR = 280;

/** Fixed USD value of 1 EUR and 1 GBP until separate fields are needed. */
const EUR_USD_RATE = 1.09;
const GBP_USD_RATE = 1.27;

export function buildExchangeRates(usdToPkr: number): ExchangeRates {
  const safeRate = usdToPkr > 0 ? usdToPkr : DEFAULT_USD_TO_PKR;
  return {
    USD: 1,
    PKR: 1 / safeRate,
    EUR: EUR_USD_RATE,
    GBP: GBP_USD_RATE,
  };
}

/** USD value of one unit of each currency. */
export const DEFAULT_EXCHANGE_RATES: ExchangeRates = buildExchangeRates(
  DEFAULT_USD_TO_PKR,
);

export const CURRENCY_META: Record<
  CurrencyCode,
  { label: string; symbol: string; locale: string }
> = {
  USD: { label: 'US Dollar', symbol: '$', locale: 'en-US' },
  PKR: { label: 'Pakistani Rupee', symbol: '₨', locale: 'en-PK' },
  EUR: { label: 'Euro', symbol: '€', locale: 'de-DE' },
  GBP: { label: 'British Pound', symbol: '£', locale: 'en-GB' },
};

export function resolveCurrency(currency?: CurrencyCode): CurrencyCode {
  return currency ?? DEFAULT_CURRENCY;
}

export function convertCurrency(
  amount: number,
  from: CurrencyCode | undefined,
  to: CurrencyCode,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES,
): number {
  const source = resolveCurrency(from);
  if (source === to) return amount;

  const usdValue = amount * rates[source];
  const converted = usdValue / rates[to];
  return Math.round(converted * 100) / 100;
}

export function formatCurrencyAmount(
  amount: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string {
  const { locale } = CURRENCY_META[currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === 'PKR' ? 0 : 2,
  }).format(amount);
}

export function formatCompactCurrency(
  value: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string {
  const symbol = CURRENCY_META[currency].symbol;
  if (Math.abs(value) >= 1000) {
    return `${symbol}${(value / 1000).toFixed(0)}k`;
  }
  return `${symbol}${Math.round(value)}`;
}
