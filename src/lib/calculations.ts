import { FIXED_EXPENSE_AMOUNT_CATEGORIES } from './constants';
import { convertCurrency, resolveCurrency } from './currency';
import {
  computeOfficeSpendBreakdown,
  sumTotalOfficeSpend,
} from './office-totals';
import { sumPaidSalaries } from './salaries';
import type {
  CurrencyConversion,
  FilterState,
  FinancialSummary,
  FixedMonthlyExpenses,
  IncomeRecord,
  MonthlyBalance,
  OfficeExpenseRecord,
  OwnerExpenseRecord,
  OwnerPayable,
  SectionBalance,
  Transaction,
  UserProfile,
} from '../types';

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

function matchesFilter(
  month: number,
  year: number,
  ownerId: string | undefined,
  filter: FilterState,
): boolean {
  if (year !== filter.year) return false;
  if (filter.month !== 'all' && month !== filter.month) return false;
  if (filter.ownerId !== 'all' && ownerId !== filter.ownerId) return false;
  return true;
}

export function filterIncomes(
  incomes: IncomeRecord[],
  filter: FilterState,
): IncomeRecord[] {
  return incomes.filter((i) => matchesFilter(i.month, i.year, i.ownerId, filter));
}

export function filterOwnerExpenses(
  expenses: OwnerExpenseRecord[],
  filter: FilterState,
): OwnerExpenseRecord[] {
  return expenses.filter((e) =>
    matchesFilter(e.month, e.year, e.ownerId, filter),
  );
}

export function filterOfficeExpenses(
  expenses: OfficeExpenseRecord[],
  filter: FilterState,
): OfficeExpenseRecord[] {
  return expenses.filter((e) => {
    if (e.year !== filter.year) return false;
    if (filter.month !== 'all' && e.month !== filter.month) return false;
    return true;
  });
}

export function computeFinancialSummary(
  incomes: IncomeRecord[],
  ownerExpenses: OwnerExpenseRecord[],
  officeExpenses: OfficeExpenseRecord[],
  filter: FilterState,
  conversion: CurrencyConversion,
  fixedRecords: FixedMonthlyExpenses[] = [],
): FinancialSummary {
  const filteredIncomes = filterIncomes(incomes, filter);
  const filteredOwnerExpenses = filterOwnerExpenses(ownerExpenses, filter);

  const companyShareTotal = filteredIncomes.reduce(
    (sum, income) =>
      sum + toDisplay(income.companyShare, income.currency, conversion),
    0,
  );
  const ownerExpensesTotal = filteredOwnerExpenses.reduce(
    (sum, expense) =>
      sum + toDisplay(expense.amount, expense.currency, conversion),
    0,
  );
  const officeExpensesTotal = sumTotalOfficeSpend(
    fixedRecords,
    officeExpenses,
    filter,
    conversion,
  );

  const totalIncome = companyShareTotal;
  const totalExpenses = ownerExpensesTotal + officeExpensesTotal;
  const netBalance = totalIncome - totalExpenses;

  return {
    totalIncome,
    totalExpenses,
    netBalance,
    monthlyProfitLoss: netBalance,
    companyShareTotal,
    ownerExpensesTotal,
    officeExpensesTotal,
  };
}

export function computeSectionBalances(
  incomes: IncomeRecord[],
  ownerExpenses: OwnerExpenseRecord[],
  officeExpenses: OfficeExpenseRecord[],
  users: UserProfile[],
  filter: FilterState,
  conversion: CurrencyConversion,
  fixedRecords: FixedMonthlyExpenses[] = [],
): SectionBalance[] {
  const sections: SectionBalance[] = [];

  const filteredIncomes = filterIncomes(incomes, filter);
  const filteredOwnerExpenses = filterOwnerExpenses(ownerExpenses, filter);

  const owners =
    filter.ownerId === 'all'
      ? users.filter((u) => u.role === 'project_owner')
      : users.filter((u) => u.uid === filter.ownerId);

  for (const owner of owners) {
    const ownerIncomes = filteredIncomes.filter((i) => i.ownerId === owner.uid);
    const companyShareDue = ownerIncomes.reduce(
      (sum, income) =>
        sum + toDisplay(income.companyShare, income.currency, conversion),
      0,
    );
    const ownerExpense = filteredOwnerExpenses
      .filter((e) => e.ownerId === owner.uid)
      .reduce(
        (sum, expense) =>
          sum + toDisplay(expense.amount, expense.currency, conversion),
        0,
      );

    sections.push({
      label: `${owner.displayName} (payable)`,
      income: companyShareDue,
      expenses: ownerExpense,
      balance: companyShareDue - ownerExpense,
    });
  }

  const officeLines = computeOfficeSpendBreakdown(
    fixedRecords,
    officeExpenses,
    filter,
    conversion,
  );

  for (const line of officeLines) {
    sections.push({
      label: line.label,
      income: 0,
      expenses: line.amount,
      balance: -line.amount,
    });
  }

  return sections;
}

export function computeOwnerPayables(
  incomes: IncomeRecord[],
  ownerExpenses: OwnerExpenseRecord[],
  users: UserProfile[],
  filter: FilterState,
  conversion: CurrencyConversion,
): OwnerPayable[] {
  const filteredIncomes = filterIncomes(incomes, filter);
  const filteredOwnerExpenses = filterOwnerExpenses(ownerExpenses, filter);

  const owners =
    filter.ownerId === 'all'
      ? users.filter((user) => user.role === 'project_owner')
      : users.filter((user) => user.uid === filter.ownerId);

  return owners
    .map((owner) => {
      const ownerIncomes = filteredIncomes.filter(
        (income) => income.ownerId === owner.uid,
      );
      const grossIncome = ownerIncomes.reduce(
        (sum, income) =>
          sum + toDisplay(income.amount, income.currency, conversion),
        0,
      );
      const companyShareDue = ownerIncomes.reduce(
        (sum, income) =>
          sum + toDisplay(income.companyShare, income.currency, conversion),
        0,
      );
      const ownerExpenseTotal = filteredOwnerExpenses
        .filter((expense) => expense.ownerId === owner.uid)
        .reduce(
          (sum, expense) =>
            sum + toDisplay(expense.amount, expense.currency, conversion),
          0,
        );

      return {
        ownerId: owner.uid,
        ownerName: owner.displayName,
        grossIncome,
        companyShareDue,
        ownerExpenses: ownerExpenseTotal,
        netPayableToCompany: companyShareDue - ownerExpenseTotal,
        ownerRetained: grossIncome - companyShareDue - ownerExpenseTotal,
      };
    })
    .filter(
      (payable) => payable.grossIncome > 0 || payable.ownerExpenses > 0,
    );
}

export function computeMonthlyBalances(
  incomes: IncomeRecord[],
  ownerExpenses: OwnerExpenseRecord[],
  officeExpenses: OfficeExpenseRecord[],
  year: number,
  conversion: CurrencyConversion,
  fixedRecords: FixedMonthlyExpenses[] = [],
  ownerId: string | 'all' = 'all',
): MonthlyBalance[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthFilter: FilterState = { year, month, ownerId };

    const monthIncomes = incomes.filter(
      (inc) =>
        inc.year === year &&
        inc.month === month &&
        (ownerId === 'all' || inc.ownerId === ownerId),
    );
    const monthOwnerExpenses = ownerExpenses.filter(
      (e) =>
        e.year === year &&
        e.month === month &&
        (ownerId === 'all' || e.ownerId === ownerId),
    );

    const income = monthIncomes.reduce(
      (sum, record) =>
        sum + toDisplay(record.companyShare, record.currency, conversion),
      0,
    );
    const expenses =
      monthOwnerExpenses.reduce(
        (sum, record) =>
          sum + toDisplay(record.amount, record.currency, conversion),
        0,
      ) +
      sumTotalOfficeSpend(fixedRecords, officeExpenses, monthFilter, conversion);

    return { month, year, income, expenses, balance: income - expenses };
  });
}

export function buildTransactions(
  incomes: IncomeRecord[],
  ownerExpenses: OwnerExpenseRecord[],
  officeExpenses: OfficeExpenseRecord[],
  users: UserProfile[],
  filter: FilterState,
  fixedRecords: FixedMonthlyExpenses[] = [],
): Transaction[] {
  const userMap = new Map(users.map((u) => [u.uid, u.displayName]));
  const transactions: Transaction[] = [];

  for (const income of filterIncomes(incomes, filter)) {
    transactions.push({
      id: income.id,
      type: 'income',
      amount: income.amount,
      currency: income.currency,
      companyShare: income.companyShare,
      month: income.month,
      year: income.year,
      description: income.description,
      createdAt: income.createdAt,
      transactionAt: income.transactionAt ?? income.createdAt,
      updatedAt: income.updatedAt,
      ownerId: income.ownerId,
      ownerName: income.ownerName ?? userMap.get(income.ownerId) ?? 'Unknown',
    });
  }

  for (const expense of filterOwnerExpenses(ownerExpenses, filter)) {
    transactions.push({
      id: expense.id,
      type: 'owner_expense',
      amount: expense.amount,
      currency: expense.currency,
      month: expense.month,
      year: expense.year,
      name: expense.name ?? expense.description,
      description: expense.description,
      createdAt: expense.createdAt,
      transactionAt: expense.transactionAt ?? expense.createdAt,
      updatedAt: expense.updatedAt,
      ownerId: expense.ownerId,
      ownerName: expense.ownerName ?? userMap.get(expense.ownerId) ?? 'Unknown',
    });
  }

  for (const expense of filterOfficeExpenses(officeExpenses, filter)) {
    transactions.push({
      id: expense.id,
      type: 'office_expense',
      amount: expense.amount,
      currency: expense.currency,
      month: expense.month,
      year: expense.year,
      name: expense.name ?? expense.description,
      description: expense.description,
      createdAt: expense.createdAt,
      transactionAt: expense.transactionAt ?? expense.createdAt,
      updatedAt: expense.updatedAt,
      category: expense.category,
    });
  }

  const fixedMonths =
    filter.month === 'all'
      ? Array.from({ length: 12 }, (_, index) => index + 1)
      : [filter.month as number];

  for (const month of fixedMonths) {
    const record = fixedRecords.find(
      (item) => item.year === filter.year && item.month === month,
    );
    if (!record) continue;

    const paidSalaries = sumPaidSalaries(record.salaryEntries ?? []);
    if (paidSalaries > 0) {
      transactions.push({
        id: `fixed-${record.id}-salaries`,
        type: 'office_expense',
        amount: paidSalaries,
        currency: record.currency,
        month,
        year: filter.year,
        name: 'Employee Salaries',
        description: 'Paid salaries (monthly checklist)',
        createdAt: record.updatedAt ?? Date.now(),
        transactionAt: record.updatedAt ?? Date.now(),
        updatedAt: record.updatedAt,
        category: 'salaries',
      });
    }

    for (const category of FIXED_EXPENSE_AMOUNT_CATEGORIES) {
      const amount = record.amounts[category.value] ?? 0;
      if (amount <= 0) continue;

      transactions.push({
        id: `fixed-${record.id}-${category.value}`,
        type: 'office_expense',
        amount,
        currency: record.currency,
        month,
        year: filter.year,
        name: category.label,
        description: 'Fixed monthly expense',
        createdAt: record.updatedAt ?? Date.now(),
        transactionAt: record.updatedAt ?? Date.now(),
        updatedAt: record.updatedAt,
        category:
          category.value === 'electricity' ||
          category.value === 'rent'
            ? category.value
            : 'miscellaneous',
      });
    }
  }

  return transactions.sort(
    (a, b) =>
      (b.transactionAt ?? b.createdAt) - (a.transactionAt ?? a.createdAt),
  );
}

export function getOwnerContributions(
  incomes: IncomeRecord[],
  users: UserProfile[],
  filter: FilterState,
  conversion: CurrencyConversion,
): { name: string; amount: number; companyShare: number }[] {
  const filtered = filterIncomes(incomes, filter);
  const owners = users.filter((u) => u.role === 'project_owner');

  return owners
    .map((owner) => {
      const ownerIncomes = filtered.filter((i) => i.ownerId === owner.uid);
      const amount = ownerIncomes.reduce(
        (sum, income) =>
          sum + toDisplay(income.amount, income.currency, conversion),
        0,
      );
      const companyShare = ownerIncomes.reduce(
        (sum, income) =>
          sum + toDisplay(income.companyShare, income.currency, conversion),
        0,
      );
      return { name: owner.displayName, amount, companyShare };
    })
    .filter((o) => o.amount > 0);
}

export function getExpenseCategoryBreakdown(
  ownerExpenses: OwnerExpenseRecord[],
  officeExpenses: OfficeExpenseRecord[],
  filter: FilterState,
  conversion: CurrencyConversion,
  fixedRecords: FixedMonthlyExpenses[] = [],
): { name: string; value: number; category?: string }[] {
  const filteredOwner = filterOwnerExpenses(ownerExpenses, filter);
  const breakdown: { name: string; value: number; category?: string }[] = [];

  for (const line of computeOfficeSpendBreakdown(
    fixedRecords,
    officeExpenses,
    filter,
    conversion,
  )) {
    breakdown.push({
      name: line.label,
      value: line.amount,
      category: line.id.startsWith('additional-')
        ? line.id.replace('additional-', '')
        : line.id,
    });
  }

  const ownerTotal = filteredOwner.reduce(
    (sum, expense) =>
      sum + toDisplay(expense.amount, expense.currency, conversion),
    0,
  );
  if (ownerTotal > 0) {
    breakdown.push({
      name: 'Project Owner Expenses',
      value: ownerTotal,
    });
  }

  return breakdown;
}
