import { describe, expect, it } from 'vitest';
import { computeMonthlyBalances } from '../calculations';
import { DEFAULT_EXCHANGE_RATES } from '../currency';
import { computeLeaveDeduction, computeNetSalary } from '../salaries';
import { getDefaultRoute } from '../routing';
import { getPermissions } from '../permissions';

const conversion = { displayCurrency: 'USD' as const, rates: DEFAULT_EXCHANGE_RATES };

describe('getDefaultRoute', () => {
  it('avoids redirect loops when dashboard and office are disabled', () => {
    const permissions = getPermissions('project_owner', 'verified', undefined);
    const restricted = {
      ...permissions,
      canViewIncomeOnDashboard: false,
      canViewIncome: false,
      canAccessOfficeExpenses: false,
    };

    expect(getDefaultRoute(restricted, { skipDashboard: true })).toBe('/expenses');
  });
});

describe('computeLeaveDeduction', () => {
  it('recalculates when base salary changes', () => {
    const first = computeLeaveDeduction(30_000, 2, 3, 2026);
    const second = computeLeaveDeduction(60_000, 2, 3, 2026);
    expect(second).toBeGreaterThan(first);
  });

  it('caps leave deduction at base salary', () => {
    const deduction = computeLeaveDeduction(30_000, 40, 2, 2026);
    expect(deduction).toBeLessThanOrEqual(30_000);
  });
});

describe('computeNetSalary', () => {
  it('recomputes leave deduction from leave days each time', () => {
    const net = computeNetSalary(
      {
        baseSalary: 60_000,
        leaveDays: 2,
        leaveDeduction: 1_935,
        bonus: 0,
        otherDeductions: 0,
      },
      3,
      2026,
    );

    expect(net).toBeLessThan(60_000);
    expect(net).toBeGreaterThan(56_000);
  });
});

describe('computeMonthlyBalances', () => {
  it('does not double-count fixed and additional office expenses', () => {
    const balances = computeMonthlyBalances(
      [],
      [],
      [
        {
          id: 'office-rent',
          category: 'rent',
          name: 'Office Rent',
          amount: 5_000,
          month: 3,
          year: 2026,
          description: 'Rent',
          transactionAt: Date.now(),
          createdAt: Date.now(),
        },
      ],
      2026,
      conversion,
      [
        {
          id: '2026-3',
          month: 3,
          year: 2026,
          amounts: {
            electricity: 0,
            salaries: 0,
            rent: 10_000,
            maintenance: 0,
            misc: 0,
          },
          salaryEntries: [],
          updatedAt: Date.now(),
        },
      ],
    );

    expect(balances[2]?.expenses).toBe(15_000);
  });
});
