import {
  FIXED_EXPENSE_AMOUNT_CATEGORIES,
  OFFICE_EXPENSE_CATEGORIES,
} from './constants';
import { convertCurrency, resolveCurrency } from './currency';
import { sumPaidSalaries } from './salaries';
import type {
  CurrencyConversion,
  FilterState,
  FixedMonthlyExpenses,
  OfficeExpenseRecord,
} from '../types';

export interface OfficeSpendLine {
  id: string;
  label: string;
  amount: number;
}

function toDisplay(
  amount: number,
  currency: CurrencyConversion['displayCurrency'] | undefined,
  conversion: CurrencyConversion,
): number {
  return convertCurrency(
    amount,
    resolveCurrency(currency),
    conversion.displayCurrency,
    conversion.rates,
  );
}

export function filterFixedRecordsForFilter(
  records: FixedMonthlyExpenses[],
  filter: FilterState,
): FixedMonthlyExpenses[] {
  return records.filter((record) => {
    if (record.year !== filter.year) return false;
    if (filter.month !== 'all' && record.month !== filter.month) return false;
    return true;
  });
}

export function computeOfficeSpendBreakdown(
  fixedRecords: FixedMonthlyExpenses[],
  additionalExpenses: OfficeExpenseRecord[],
  filter: FilterState,
  conversion: CurrencyConversion,
): OfficeSpendLine[] {
  const totals = new Map<string, { id: string; label: string; amount: number }>();
  const relevantFixed = filterFixedRecordsForFilter(fixedRecords, filter);

  const addAmount = (id: string, label: string, amount: number) => {
    if (amount <= 0) return;
    const existing = totals.get(id);
    if (existing) {
      existing.amount += amount;
      return;
    }
    totals.set(id, { id, label, amount });
  };

  for (const record of relevantFixed) {
    const salaryTotal = toDisplay(
      sumPaidSalaries(record.salaryEntries ?? []),
      record.currency,
      conversion,
    );
    addAmount('salaries', 'Employee Salaries', salaryTotal);

    for (const category of FIXED_EXPENSE_AMOUNT_CATEGORIES) {
      addAmount(
        category.value,
        category.label,
        toDisplay(record.amounts[category.value] ?? 0, record.currency, conversion),
      );
    }
  }

  const relevantAdditional = additionalExpenses.filter((expense) => {
    if (expense.year !== filter.year) return false;
    if (filter.month !== 'all' && expense.month !== filter.month) return false;
    return true;
  });

  for (const category of OFFICE_EXPENSE_CATEGORIES) {
    const categoryTotal = relevantAdditional
      .filter((expense) => expense.category === category.value)
      .reduce(
        (sum, expense) =>
          sum + toDisplay(expense.amount, expense.currency, conversion),
        0,
      );

    if (category.value === 'salaries') {
      addAmount('salaries', 'Employee Salaries', categoryTotal);
    } else {
      const fixedMatch = FIXED_EXPENSE_AMOUNT_CATEGORIES.find(
        (item) => item.value === category.value,
      );
      if (fixedMatch) {
        addAmount(fixedMatch.value, fixedMatch.label, categoryTotal);
      } else {
        addAmount(
          `additional-${category.value}`,
          category.label,
          categoryTotal,
        );
      }
    }
  }

  return Array.from(totals.values()).sort((left, right) => right.amount - left.amount);
}

export function sumOfficeSpendBreakdown(lines: OfficeSpendLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

export function sumFixedOfficeSpend(
  fixedRecords: FixedMonthlyExpenses[],
  filter: FilterState,
  conversion: CurrencyConversion,
): number {
  return sumOfficeSpendBreakdown(
    computeOfficeSpendBreakdown(fixedRecords, [], filter, conversion),
  );
}

export function sumAdditionalOfficeSpend(
  additionalExpenses: OfficeExpenseRecord[],
  filter: FilterState,
  conversion: CurrencyConversion,
): number {
  return additionalExpenses
    .filter((expense) => {
      if (expense.year !== filter.year) return false;
      if (filter.month !== 'all' && expense.month !== filter.month) return false;
      return true;
    })
    .reduce(
      (sum, expense) =>
        sum + toDisplay(expense.amount, expense.currency, conversion),
      0,
    );
}

export function sumTotalOfficeSpend(
  fixedRecords: FixedMonthlyExpenses[],
  additionalExpenses: OfficeExpenseRecord[],
  filter: FilterState,
  conversion: CurrencyConversion,
): number {
  return sumOfficeSpendBreakdown(
    computeOfficeSpendBreakdown(fixedRecords, additionalExpenses, filter, conversion),
  );
}

export function sumFixedOfficeSpendForMonth(
  fixedRecords: FixedMonthlyExpenses[],
  year: number,
  month: number,
  conversion: CurrencyConversion,
): number {
  return sumFixedOfficeSpend(
    fixedRecords,
    { year, month, ownerId: 'all' },
    conversion,
  );
}
