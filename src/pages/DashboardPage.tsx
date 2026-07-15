import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { FilterBar } from '../components/ui/FilterBar';
import { Card, CardHeader } from '../components/ui/Card';
import { DataErrorBanner } from '../components/ui/DataErrorBanner';
import { DashboardSummary } from '../components/dashboard/DashboardSummary';
import { OwnerPayablesCard } from '../components/dashboard/OwnerPayablesCard';
import { useFilter } from '../context/FilterContext';
import { useCurrency } from '../context/CurrencyContext';
import { useIncomes } from '../hooks/useIncomes';
import { useOfficeExpenses, useOwnerExpenses } from '../hooks/useExpenses';
import { useAuth } from '../context/AuthContext';
import { useFixedExpenses } from '../hooks/useFixedExpenses';
import { useUsers } from '../hooks/useUsers';
import {
  buildTransactions,
  computeFinancialSummary,
  computeOwnerPayables,
} from '../lib/calculations';
import { getEffectiveOwnerFilter } from '../lib/routing';
import { Badge } from '../components/ui/Badge';
import { getMonthLabel } from '../lib/utils';

export function DashboardPage() {
  const { permissions, profile, isAdmin } = useAuth();
  const { filter } = useFilter();
  const effectiveFilter = getEffectiveOwnerFilter(filter, profile?.uid, isAdmin);
  const { displayCurrency, rates, format } = useCurrency();
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
  } = useOfficeExpenses(permissions.canAccessOfficeExpenses);
  const { users, loading: usersLoading, error: usersError } = useUsers();
  const {
    records: fixedRecords,
    loading: fixedLoading,
    error: fixedError,
  } = useFixedExpenses(permissions.canAccessOfficeExpenses);

  const loading =
    incomesLoading || ownerLoading || officeLoading || usersLoading || fixedLoading;
  const dataError =
    incomesError ?? ownerError ?? officeError ?? usersError ?? fixedError;

  const summary = computeFinancialSummary(
    incomes,
    ownerExpenses,
    officeExpenses,
    effectiveFilter,
    conversion,
    fixedRecords,
  );

  const ownerPayables = computeOwnerPayables(
    incomes,
    ownerExpenses,
    users,
    effectiveFilter,
    conversion,
  );

  const recentTransactions = buildTransactions(
    incomes,
    ownerExpenses,
    officeExpenses,
    users,
    effectiveFilter,
    fixedRecords,
  ).slice(0, 5);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="overview-page">
      {dataError && <DataErrorBanner message={dataError} />}
      <FilterBar showOwnerFilter={isAdmin} />

      <DashboardSummary
        totalIncome={summary.totalIncome}
        totalExpenses={summary.totalExpenses}
        netBalance={summary.netBalance}
        monthlyProfitLoss={summary.monthlyProfitLoss}
        filter={effectiveFilter}
        ownerId={effectiveFilter.ownerId}
        incomes={incomes}
        ownerExpenses={ownerExpenses}
        officeExpenses={officeExpenses}
        fixedRecords={fixedRecords}
      />

      <div className="overview-grid">
        <Card className="overview-activity" padding={false}>
          <CardHeader title="Recent activity" subtitle="Latest entries" />
          <div className="overview-activity-list">
            {recentTransactions.length === 0 ? (
              <p className="overview-empty">No transactions yet</p>
            ) : (
              recentTransactions.map((tx) => (
                <div key={`${tx.type}-${tx.id}`} className="overview-activity-item">
                  <span className={`overview-activity-icon overview-activity-icon-${tx.type}`}>
                    {tx.type === 'income' ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                  </span>
                  <div className="overview-activity-copy">
                    <p className="overview-activity-title">{tx.description}</p>
                    <p className="overview-activity-meta">
                      {getMonthLabel(tx.month).slice(0, 3)} {tx.year}
                      {tx.ownerName && ` · ${tx.ownerName}`}
                    </p>
                  </div>
                  <div className="overview-activity-amount">
                    <span className={tx.type === 'income' ? 'text-success' : 'text-danger'}>
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

        <OwnerPayablesCard payables={ownerPayables} compact />
      </div>
    </div>
  );
}
