import { OFFICE_EXPENSE_CATEGORIES } from './constants';
import { convertCurrency, resolveCurrency } from './currency';
import type {
  CurrencyConversion,
  FilterState,
  FinancialSummary,
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
): FinancialSummary {
  const filteredIncomes = filterIncomes(incomes, filter);
  const filteredOwnerExpenses = filterOwnerExpenses(ownerExpenses, filter);
  const filteredOfficeExpenses = filterOfficeExpenses(officeExpenses, filter);

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
  const officeExpensesTotal = filteredOfficeExpenses.reduce(
    (sum, expense) =>
      sum + toDisplay(expense.amount, expense.currency, conversion),
    0,
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
): SectionBalance[] {
  const sections: SectionBalance[] = [];

  const filteredIncomes = filterIncomes(incomes, filter);
  const filteredOwnerExpenses = filterOwnerExpenses(ownerExpenses, filter);
  const filteredOfficeExpenses = filterOfficeExpenses(officeExpenses, filter);

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

  for (const cat of OFFICE_EXPENSE_CATEGORIES) {
    const catTotal = filteredOfficeExpenses
      .filter((e) => e.category === cat.value)
      .reduce(
        (sum, expense) =>
          sum + toDisplay(expense.amount, expense.currency, conversion),
        0,
      );

    if (catTotal > 0 || filter.ownerId === 'all') {
      sections.push({
        label: cat.label,
        income: 0,
        expenses: catTotal,
        balance: -catTotal,
      });
    }
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
): MonthlyBalance[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthIncomes = incomes.filter(
      (inc) => inc.year === year && inc.month === month,
    );
    const monthOwnerExpenses = ownerExpenses.filter(
      (e) => e.year === year && e.month === month,
    );
    const monthOfficeExpenses = officeExpenses.filter(
      (e) => e.year === year && e.month === month,
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
      monthOfficeExpenses.reduce(
        (sum, record) =>
          sum + toDisplay(record.amount, record.currency, conversion),
        0,
      );

    return { month, year, income, expenses, balance: income - expenses };
  });
}

export function buildTransactions(
  incomes: IncomeRecord[],
  ownerExpenses: OwnerExpenseRecord[],
  officeExpenses: OfficeExpenseRecord[],
  users: UserProfile[],
  filter: FilterState,
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
): { name: string; value: number; category?: string }[] {
  const filteredOffice = filterOfficeExpenses(officeExpenses, filter);
  const filteredOwner = filterOwnerExpenses(ownerExpenses, filter);

  const breakdown: { name: string; value: number; category?: string }[] = [];

  for (const cat of OFFICE_EXPENSE_CATEGORIES) {
    const total = filteredOffice
      .filter((e) => e.category === cat.value)
      .reduce(
        (sum, expense) =>
          sum + toDisplay(expense.amount, expense.currency, conversion),
        0,
      );
    if (total > 0) {
      breakdown.push({ name: cat.label, value: total, category: cat.value });
    }
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
