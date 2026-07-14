import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { getMonthLabel } from '../../lib/utils';
import type {
  FilterState,
  FixedMonthlyExpenses,
  IncomeRecord,
  OfficeExpenseRecord,
  OwnerExpenseRecord,
} from '../../types';
import { IncomeVsExpensesChart } from '../charts/IncomeVsExpensesChart';
import { OverviewSpendPanel } from './OverviewSpendPanel';

interface DashboardSummaryProps {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  monthlyProfitLoss: number;
  filter: FilterState;
  incomes: IncomeRecord[];
  ownerExpenses: OwnerExpenseRecord[];
  officeExpenses: OfficeExpenseRecord[];
  fixedRecords?: FixedMonthlyExpenses[];
}

export function DashboardSummary({
  totalIncome,
  totalExpenses,
  netBalance,
  monthlyProfitLoss,
  filter,
  incomes,
  ownerExpenses,
  officeExpenses,
  fixedRecords = [],
}: DashboardSummaryProps) {
  const { formatDisplay } = useCurrency();

  const periodLabel =
    filter.month === 'all'
      ? `Full year ${filter.year}`
      : `${getMonthLabel(filter.month as number)} ${filter.year}`;

  const expenseRatio =
    totalIncome > 0 ? Math.min(100, Math.round((totalExpenses / totalIncome) * 100)) : 0;
  const isPositive = netBalance >= 0;

  const kpis = [
    { key: 'income', label: 'Income', value: totalIncome, tone: 'income' as const },
    { key: 'expenses', label: 'Expenses', value: totalExpenses, tone: 'expense' as const },
    {
      key: 'margin',
      label: 'Margin',
      value: monthlyProfitLoss,
      tone: monthlyProfitLoss >= 0 ? ('income' as const) : ('expense' as const),
    },
  ];

  return (
    <section className="overview-panel" aria-label="Financial overview">
      <header className="overview-head">
        <div className="overview-balance-block">
          <p className="overview-period">{periodLabel}</p>
          <p className="overview-label">Net balance</p>
          <p className={`overview-balance ${isPositive ? 'is-positive' : 'is-negative'}`}>
            {formatDisplay(netBalance)}
          </p>
          <p className="overview-status">
            <span className={`overview-status-badge ${isPositive ? 'up' : 'down'}`}>
              {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {isPositive ? 'Surplus' : 'Deficit'}
            </span>
            <span className="overview-status-meta">{expenseRatio}% of income spent</span>
          </p>
        </div>

        <div className="overview-kpis">
          {kpis.map(({ key, label, value, tone }) => (
            <div key={key} className={`overview-kpi overview-kpi-${tone}`}>
              <span className="overview-kpi-label">{label}</span>
              <span className="overview-kpi-value">{formatDisplay(value)}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="overview-flow-bar" aria-hidden>
        <span
          className="overview-flow-bar-income"
          style={{ flex: totalIncome || 1 }}
        />
        <span
          className="overview-flow-bar-expense"
          style={{ flex: totalExpenses || 0.001 }}
        />
      </div>

      <div className="overview-body">
        <IncomeVsExpensesChart
          embedded
          incomes={incomes}
          ownerExpenses={ownerExpenses}
          officeExpenses={officeExpenses}
          fixedRecords={fixedRecords}
          year={filter.year}
        />
        <OverviewSpendPanel
          ownerExpenses={ownerExpenses}
          officeExpenses={officeExpenses}
          fixedRecords={fixedRecords}
          filter={filter}
        />
      </div>
    </section>
  );
}
