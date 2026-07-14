import { COMPANY_SHARE_RATE } from './constants';
import {
  DEFAULT_CURRENCY,
  formatCurrencyAmount,
  resolveCurrency,
} from './currency';
import type { CurrencyCode } from '../types';

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string {
  return formatCurrencyAmount(amount, resolveCurrency(currency));
}

export function calculateCompanyShare(amount: number): number {
  return Math.round(amount * COMPANY_SHARE_RATE * 100) / 100;
}

export function getMonthLabel(month: number): string {
  return new Date(2000, month - 1).toLocaleString('en-US', { month: 'short' });
}

export function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => currentYear - i);
}

export function clsx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}
