import { useAuth } from '../context/AuthContext';
import { useFilter } from '../context/FilterContext';
import { useCurrency } from '../context/CurrencyContext';
import { useIncomes } from '../hooks/useIncomes';
import { useOfficeExpenses, useOwnerExpenses } from '../hooks/useExpenses';
import { useUsers } from '../hooks/useUsers';
import { buildTransactions, filterOfficeExpenses, filterOwnerExpenses } from '../lib/calculations';
import { buildExpenseLedgerPdf } from '../lib/expense-pdf-export';
import { formatDateTime } from '../lib/datetime';
import { FileDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { FilterBar, getCategoryLabel } from '../components/ui/FilterBar';
import { AmountDisplay } from '../components/ui/AmountDisplay';
import { Badge } from '../components/ui/Badge';
import { getMonthLabel } from '../lib/utils';

export function TransactionsPage() {
  const { profile, permissions, isAdmin } = useAuth();
  const { filter } = useFilter();
  const { displayCurrency, rates } = useCurrency();
  const { incomes, loading: incomesLoading } = useIncomes(permissions.canViewIncome);
  const { expenses: ownerExpenses, loading: ownerLoading } = useOwnerExpenses(
    permissions.canManageOwnerExpenses,
  );
  const { expenses: officeExpenses, loading: officeLoading } = useOfficeExpenses(
    permissions.canAccessOfficeExpenses,
  );
  const { users, loading: usersLoading } = useUsers();

  const loading = incomesLoading || ownerLoading || officeLoading || usersLoading;

  const effectiveFilter = isAdmin
    ? filter
    : { ...filter, ownerId: profile?.uid ?? 'all' };

  const transactions = buildTransactions(
    incomes,
    ownerExpenses,
    officeExpenses,
    users,
    effectiveFilter,
  ).filter((transaction) =>
    permissions.canViewIncome ? true : transaction.type !== 'income',
  );

  const expenseOwnerRecords = filterOwnerExpenses(ownerExpenses, effectiveFilter);
  const expenseOfficeRecords = filterOfficeExpenses(officeExpenses, effectiveFilter);

  const handleExportPdf = () => {
    const expenseTransactions = transactions.filter((tx) => tx.type !== 'income');
    if (expenseTransactions.length === 0) {
      window.alert('No expense records to export for the selected period.');
      return;
    }

    buildExpenseLedgerPdf(
      expenseOwnerRecords,
      expenseOfficeRecords,
      users,
      effectiveFilter,
      displayCurrency,
      rates,
      false,
    );
  };

  return (
    <div className="page">
      <FilterBar showOwnerFilter={permissions.canViewIncome && isAdmin} />

      <Card>
        <CardHeader
          title="Expense Transactions"
          subtitle={`${transactions.length} records found`}
          action={
            <Button variant="secondary" onClick={handleExportPdf} disabled={loading}>
              <FileDown size={18} />
              Export PDF
            </Button>
          }
        />

        {loading ? (
          <div className="loading-screen">
            <div className="spinner" />
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Period</th>
                  {isAdmin && permissions.canViewIncome && <th>Owner / Category</th>}
                  <th>Amount</th>
                  <th>Currency</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin && permissions.canViewIncome ? 9 : 8}
                      className="empty-cell"
                    >
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={`${tx.type}-${tx.id}`}>
                      <td>
                        {formatDateTime(tx.transactionAt ?? tx.createdAt)}
                      </td>
                      <td>
                        <Badge
                          variant={
                            tx.type === 'income'
                              ? 'success'
                              : tx.type === 'office_expense'
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {tx.type === 'income'
                            ? 'Income'
                            : tx.type === 'office_expense'
                              ? 'Office'
                              : 'Owner Expense'}
                        </Badge>
                      </td>
                      <td>{tx.name ?? tx.description}</td>
                      <td>{tx.description}</td>
                      <td>
                        {getMonthLabel(tx.month)} {tx.year}
                      </td>
                      {isAdmin && permissions.canViewIncome && (
                        <td>
                          {tx.ownerName ??
                            (tx.category ? getCategoryLabel(tx.category) : '-')}
                        </td>
                      )}
                      <td
                        className={
                          tx.type === 'income' ? 'text-success' : 'text-danger'
                        }
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        <AmountDisplay
                          amount={
                            tx.type === 'income'
                              ? (tx.companyShare ?? tx.amount)
                              : tx.amount
                          }
                          currency={tx.currency}
                        />
                      </td>
                      <td>{tx.currency ?? 'USD'}</td>
                      <td>{tx.updatedAt ? formatDateTime(tx.updatedAt) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
