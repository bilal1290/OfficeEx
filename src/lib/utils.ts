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
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}
