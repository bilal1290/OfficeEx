import {
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { FilterBar } from '../components/ui/FilterBar';
import { Card, CardHeader } from '../components/ui/Card';
import { DataErrorBanner } from '../components/ui/DataErrorBanner';
import { IncomeVsExpensesChart } from '../components/charts/IncomeVsExpensesChart';
import { ExpenseBreakdownChart } from '../components/charts/ExpenseBreakdownChart';
import { OwnerContributionsChart } from '../components/charts/OwnerContributionsChart';
import { DashboardSummary } from '../components/dashboard/DashboardSummary';
import { OwnerPayablesCard } from '../components/dashboard/OwnerPayablesCard';
import { useFilter } from '../context/FilterContext';
import { useCurrency } from '../context/CurrencyContext';
import { useIncomes } from '../hooks/useIncomes';
import { useOfficeExpenses, useOwnerExpenses } from '../hooks/useExpenses';
import { useUsers } from '../hooks/useUsers';
import {
  buildTransactions,
  computeFinancialSummary,
  computeOwnerPayables,
  computeSectionBalances,
} from '../lib/calculations';
import { Badge } from '../components/ui/Badge';
import { getMonthLabel } from '../lib/utils';

export function DashboardPage() {
  const { filter } = useFilter();
  const { displayCurrency, rates, formatDisplay, format } = useCurrency();
  const conversion = { displayCurrency, rates };
  const { incomes, loading: incomesLoading, error: incomesError } = useIncomes();
  const {
    expenses: ownerExpenses,
    loading: ownerLoading,
    error: ownerError,
  } = useOwnerExpenses();
  const {
    expenses: officeExpenses,
    loading: officeLoading,
    error: officeError,
  } = useOfficeExpenses();
  const { users, loading: usersLoading, error: usersError } = useUsers();

  const loading = incomesLoading || ownerLoading || officeLoading || usersLoading;
  const dataError = incomesError ?? ownerError ?? officeError ?? usersError;

  const summary = computeFinancialSummary(
    incomes,
    ownerExpenses,
    officeExpenses,
    filter,
    conversion,
  );

  const sectionBalances = computeSectionBalances(
    incomes,
    ownerExpenses,
    officeExpenses,
    users,
    filter,
    conversion,
  );

  const ownerPayables = computeOwnerPayables(
    incomes,
    ownerExpenses,
    users,
    filter,
    conversion,
  );

  const recentTransactions = buildTransactions(
    incomes,
    ownerExpenses,
    officeExpenses,
    users,
    filter,
  ).slice(0, 6);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="dashboard">
      {dataError && <DataErrorBanner message={dataError} />}
      <FilterBar />

      <DashboardSummary
        totalIncome={summary.totalIncome}
        totalExpenses={summary.totalExpenses}
        netBalance={summary.netBalance}
        monthlyProfitLoss={summary.monthlyProfitLoss}
        filter={filter}
      />

      <div className="dashboard-bento">
        <div className="bento-primary">
          <IncomeVsExpensesChart
            incomes={incomes}
            ownerExpenses={ownerExpenses}
            officeExpenses={officeExpenses}
            year={filter.year}
          />
        </div>
        <div className="bento-side">
          <ExpenseBreakdownChart
            ownerExpenses={ownerExpenses}
            officeExpenses={officeExpenses}
            filter={filter}
          />
        </div>
        <div className="bento-half">
          <OwnerContributionsChart incomes={incomes} users={users} filter={filter} />
        </div>
        <div className="bento-half">
          <Card className="recent-card" padding={false}>
            <CardHeader
              title="Recent activity"
              subtitle="Latest ledger entries"
            />
            <div className="transaction-list transaction-list-compact">
              {recentTransactions.length === 0 ? (
                <p className="empty-cell">No transactions yet</p>
              ) : (
                recentTransactions.map((tx) => (
                  <div key={`${tx.type}-${tx.id}`} className="transaction-item transaction-item-compact">
                    <div className={`transaction-icon transaction-icon-${tx.type}`}>
                      {tx.type === 'income' ? (
                        <ArrowUpRight size={15} />
                      ) : (
                        <ArrowDownRight size={15} />
                      )}
                    </div>
                    <div className="transaction-details">
                      <p className="transaction-desc">{tx.description}</p>
                      <p className="transaction-meta">
                        {getMonthLabel(tx.month).slice(0, 3)} {tx.year}
                        {tx.ownerName && ` · ${tx.ownerName}`}
                      </p>
                    </div>
                    <div className="transaction-amount transaction-amount-compact">
                      <span
                        className={
                          tx.type === 'income' ? 'text-success' : 'text-danger'
                        }
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {format(
                          tx.type === 'income'
                            ? (tx.companyShare ?? tx.amount)
                            : tx.amount,
                          tx.currency,
                        )}
                      </span>
                      <Badge
                        variant={
                          tx.type === 'income'
                            ? 'success'
                            : tx.type === 'office_expense'
                              ? 'warning'
                              : 'danger'
                        }
                      >
                        {tx.type === 'income' ? 'In' : 'Out'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <OwnerPayablesCard payables={ownerPayables} />

      <Card className="section-balances-card">
        <CardHeader title="Section balances" subtitle="Company share vs owner expenses" />
        <div className="table-wrapper">
          <table className="data-table data-table-compact">
            <thead>
              <tr>
                <th>Section</th>
                <th>Income</th>
                <th>Expenses</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {sectionBalances.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-cell">
                    No data for selected filters
                  </td>
                </tr>
              ) : (
                sectionBalances.map((section) => (
                  <tr key={section.label}>
                    <td>{section.label}</td>
                    <td className="text-success">{formatDisplay(section.income)}</td>
                    <td className="text-danger">{formatDisplay(section.expenses)}</td>
                    <td className={section.balance >= 0 ? 'text-success' : 'text-danger'}>
                      {formatDisplay(section.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
