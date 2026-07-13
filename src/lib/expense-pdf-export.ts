import { downloadExpensesPdf, type ExpensePdfLine, type ExpensePdfSection } from './expense-pdf';
import { FIXED_EXPENSE_CATEGORIES } from './constants';
import { resolveCurrency } from './currency';
import type {
  CurrencyCode,
  ExchangeRates,
  FilterState,
  FixedMonthlyExpenses,
  OfficeExpenseRecord,
  OwnerExpenseRecord,
} from '../types';
import { convertCurrency } from './currency';
import { formatCurrencyAmount } from './currency';
import { formatDateTime } from './datetime';
import { getMonthLabel } from './utils';
import { getCategoryLabel } from '../components/ui/FilterBar';
import { resolveUserName } from './users';
import type { UserProfile } from '../types';

function formatPeriodLabel(filter: FilterState): string {
  const monthLabel =
    filter.month === 'all' ? 'All months' : getMonthLabel(filter.month as number);
  return `${monthLabel} ${filter.year}`;
}

function toDisplayAmount(
  amount: number,
  currency: CurrencyCode | undefined,
  displayCurrency: CurrencyCode,
  rates: ExchangeRates,
): number {
  return convertCurrency(amount, currency, displayCurrency, rates);
}

function formatDisplayLine(
  amount: number,
  currency: CurrencyCode | undefined,
  displayCurrency: CurrencyCode,
  rates: ExchangeRates,
): string {
  return formatCurrencyAmount(
    toDisplayAmount(amount, currency, displayCurrency, rates),
    displayCurrency,
  );
}

export function buildOwnerExpensesPdf(
  expenses: OwnerExpenseRecord[],
  users: UserProfile[],
  filter: FilterState,
  displayCurrency: CurrencyCode,
  rates: ExchangeRates,
) {
  const lines: ExpensePdfLine[] = expenses.map((expense) => ({
    date: formatDateTime(expense.transactionAt ?? expense.createdAt),
    type: 'Owner Expense',
    name: expense.name ?? expense.description,
    detail: resolveUserName(expense.ownerId, users, expense.ownerName),
    amount: formatDisplayLine(expense.amount, expense.currency, displayCurrency, rates),
    currency: resolveCurrency(expense.currency),
  }));

  const total = expenses.reduce(
    (sum, expense) =>
      sum + toDisplayAmount(expense.amount, expense.currency, displayCurrency, rates),
    0,
  );

  downloadExpensesPdf({
    reportTitle: 'Project Owner Expenses',
    periodLabel: formatPeriodLabel(filter),
    generatedAt: formatDateTime(Date.now()),
    displayCurrency,
    sections: [
      {
        title: 'Owner Expenses',
        lines,
        subtotal: formatCurrencyAmount(total, displayCurrency),
      },
    ],
    grandTotal: formatCurrencyAmount(total, displayCurrency),
    filename: `officeex-owner-expenses-${filter.year}${filter.month === 'all' ? '' : `-${filter.month}`}.pdf`,
  });
}

export function buildOfficeExpensesPdf(
  fixedRecord: FixedMonthlyExpenses | null,
  officeExpenses: OfficeExpenseRecord[],
  filter: FilterState,
  displayCurrency: CurrencyCode,
  rates: ExchangeRates,
) {
  const sections: ExpensePdfSection[] = [];

  if (fixedRecord) {
    const fixedLines: ExpensePdfLine[] = FIXED_EXPENSE_CATEGORIES.filter(
      (category) => (fixedRecord.amounts[category.value] ?? 0) > 0,
    ).map((category) => ({
      date: '—',
      type: 'Fixed',
      name: category.label,
      detail: 'Monthly fixed amount',
      amount: formatDisplayLine(
        fixedRecord.amounts[category.value] ?? 0,
        fixedRecord.currency,
        displayCurrency,
        rates,
      ),
      currency: resolveCurrency(fixedRecord.currency),
    }));

    const fixedTotal = FIXED_EXPENSE_CATEGORIES.reduce(
      (sum, category) =>
        sum +
        toDisplayAmount(
          fixedRecord.amounts[category.value] ?? 0,
          fixedRecord.currency,
          displayCurrency,
          rates,
        ),
      0,
    );

    if (fixedLines.length > 0) {
      sections.push({
        title: 'Fixed Monthly Expenses',
        lines: fixedLines,
        subtotal: formatCurrencyAmount(fixedTotal, displayCurrency),
      });
    }
  }

  const officeLines: ExpensePdfLine[] = officeExpenses.map((expense) => ({
    date: formatDateTime(expense.transactionAt ?? expense.createdAt),
    type: 'Office',
    name: expense.name ?? expense.description,
    detail: getCategoryLabel(expense.category),
    amount: formatDisplayLine(expense.amount, expense.currency, displayCurrency, rates),
    currency: resolveCurrency(expense.currency),
  }));

  const officeTotal = officeExpenses.reduce(
    (sum, expense) =>
      sum + toDisplayAmount(expense.amount, expense.currency, displayCurrency, rates),
    0,
  );

  if (officeLines.length > 0) {
    sections.push({
      title: 'Additional Office Expenses',
      lines: officeLines,
      subtotal: formatCurrencyAmount(officeTotal, displayCurrency),
    });
  }

  const fixedTotal = fixedRecord
    ? FIXED_EXPENSE_CATEGORIES.reduce(
        (sum, category) =>
          sum +
          toDisplayAmount(
            fixedRecord.amounts[category.value] ?? 0,
            fixedRecord.currency,
            displayCurrency,
            rates,
          ),
        0,
      )
    : 0;

  const grandTotal = fixedTotal + officeTotal;

  downloadExpensesPdf({
    reportTitle: 'Office Expenses Report',
    periodLabel: formatPeriodLabel(filter),
    generatedAt: formatDateTime(Date.now()),
    displayCurrency,
    sections,
    grandTotal: formatCurrencyAmount(grandTotal, displayCurrency),
    filename: `officeex-office-expenses-${filter.year}${filter.month === 'all' ? '' : `-${filter.month}`}.pdf`,
  });
}

export function buildExpenseLedgerPdf(
  ownerExpenses: OwnerExpenseRecord[],
  officeExpenses: OfficeExpenseRecord[],
  users: UserProfile[],
  filter: FilterState,
  displayCurrency: CurrencyCode,
  rates: ExchangeRates,
  includeIncome: boolean,
  incomeLines: ExpensePdfLine[] = [],
) {
  const ownerLines: ExpensePdfLine[] = ownerExpenses.map((expense) => ({
    date: formatDateTime(expense.transactionAt ?? expense.createdAt),
    type: 'Owner Expense',
    name: expense.name ?? expense.description,
    detail: resolveUserName(expense.ownerId, users, expense.ownerName),
    amount: formatDisplayLine(expense.amount, expense.currency, displayCurrency, rates),
    currency: resolveCurrency(expense.currency),
  }));

  const officeLines: ExpensePdfLine[] = officeExpenses.map((expense) => ({
    date: formatDateTime(expense.transactionAt ?? expense.createdAt),
    type: 'Office Expense',
    name: expense.name ?? expense.description,
    detail: getCategoryLabel(expense.category),
    amount: formatDisplayLine(expense.amount, expense.currency, displayCurrency, rates),
    currency: resolveCurrency(expense.currency),
  }));

  const sections: ExpensePdfSection[] = [];

  if (includeIncome && incomeLines.length > 0) {
    sections.push({ title: 'Income', lines: incomeLines });
  }

  if (ownerLines.length > 0) {
    const ownerTotal = ownerExpenses.reduce(
      (sum, expense) =>
        sum + toDisplayAmount(expense.amount, expense.currency, displayCurrency, rates),
      0,
    );
    sections.push({
      title: 'Owner Expenses',
      lines: ownerLines,
      subtotal: formatCurrencyAmount(ownerTotal, displayCurrency),
    });
  }

  if (officeLines.length > 0) {
    const officeTotal = officeExpenses.reduce(
      (sum, expense) =>
        sum + toDisplayAmount(expense.amount, expense.currency, displayCurrency, rates),
      0,
    );
    sections.push({
      title: 'Office Expenses',
      lines: officeLines,
      subtotal: formatCurrencyAmount(officeTotal, displayCurrency),
    });
  }

  const grandTotal =
    ownerExpenses.reduce(
      (sum, expense) =>
        sum + toDisplayAmount(expense.amount, expense.currency, displayCurrency, rates),
      0,
    ) +
    officeExpenses.reduce(
      (sum, expense) =>
        sum + toDisplayAmount(expense.amount, expense.currency, displayCurrency, rates),
      0,
    );

  downloadExpensesPdf({
    reportTitle: 'Expense Ledger Report',
    periodLabel: formatPeriodLabel(filter),
    generatedAt: formatDateTime(Date.now()),
    displayCurrency,
    sections,
    grandTotal: formatCurrencyAmount(grandTotal, displayCurrency),
    filename: `officeex-expense-ledger-${filter.year}${filter.month === 'all' ? '' : `-${filter.month}`}.pdf`,
  });
}
