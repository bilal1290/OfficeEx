import { ArrowDownRight, ArrowUpRight, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { getMonthLabel } from '../../lib/utils';
import { COMPANY_SHARE_RATE } from '../../lib/constants';
import type { FilterState } from '../../types';

interface DashboardSummaryProps {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  monthlyProfitLoss: number;
  filter: FilterState;
}

export function DashboardSummary({
  totalIncome,
  totalExpenses,
  netBalance,
  monthlyProfitLoss,
  filter,
}: DashboardSummaryProps) {
  const { formatDisplay } = useCurrency();

  const periodLabel =
    filter.month === 'all'
      ? `Full year ${filter.year}`
      : `${getMonthLabel(filter.month as number)} ${filter.year}`;

  const expenseRatio =
    totalIncome > 0 ? Math.min(100, Math.round((totalExpenses / totalIncome) * 100)) : 0;
  const healthAngle = totalIncome > 0 ? (netBalance / totalIncome) * 360 : 0;
  const isPositive = netBalance >= 0;

  const metrics = [
    {
      key: 'income',
      label: 'Income',
      value: totalIncome,
      hint: `${COMPANY_SHARE_RATE * 100}% company share`,
      icon: TrendingUp,
      tone: 'income' as const,
    },
    {
      key: 'expenses',
      label: 'Expenses',
      value: totalExpenses,
      hint: 'Office + owner',
      icon: TrendingDown,
      tone: 'expense' as const,
    },
    {
      key: 'profit',
      label: 'Profit / Loss',
      value: monthlyProfitLoss,
      hint: periodLabel,
      icon: Wallet,
      tone: monthlyProfitLoss >= 0 ? ('income' as const) : ('expense' as const),
    },
  ];

  return (
    <section className="dashboard-summary" aria-label="Financial snapshot">
      <div className="summary-hero">
        <div
          className="summary-ring"
          style={{
            background: `conic-gradient(
              var(--primary) 0deg ${Math.max(healthAngle, 8)}deg,
              var(--border) ${Math.max(healthAngle, 8)}deg 360deg
            )`,
          }}
          aria-hidden
        >
          <div className="summary-ring-inner">
            <Scale size={18} strokeWidth={2} />
          </div>
        </div>

        <div className="summary-hero-copy">
          <span className="summary-eyebrow">{periodLabel}</span>
          <p className="summary-label">Net balance</p>
          <p className={`summary-balance ${isPositive ? 'text-success' : 'text-danger'}`}>
            {formatDisplay(netBalance)}
          </p>
          <div className="summary-meta">
            <span className={`summary-trend ${isPositive ? 'up' : 'down'}`}>
              {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {isPositive ? 'In surplus' : 'In deficit'}
            </span>
            <span className="summary-ratio">
              {expenseRatio}% of income spent
            </span>
          </div>
        </div>

        <div className="summary-bar" aria-hidden>
          <div className="summary-bar-income" style={{ flex: totalIncome || 1 }} />
          <div className="summary-bar-expense" style={{ flex: totalExpenses || 0.001 }} />
        </div>
      </div>

      <div className="summary-metrics">
        {metrics.map(({ key, label, value, hint, icon: Icon, tone }) => (
          <div key={key} className={`summary-metric summary-metric-${tone}`}>
            <div className="summary-metric-icon">
              <Icon size={16} strokeWidth={2.25} />
            </div>
            <div className="summary-metric-body">
              <span className="summary-metric-label">{label}</span>
              <span className="summary-metric-value">{formatDisplay(value)}</span>
              <span className="summary-metric-hint">{hint}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
