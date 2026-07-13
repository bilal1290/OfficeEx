import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card } from '../ui/Card';
import { useCurrency } from '../../context/CurrencyContext';
import { getExpenseCategoryBreakdown } from '../../lib/calculations';
import { CATEGORY_COLORS, CHART_COLORS } from '../../lib/constants';
import type {
  FilterState,
  OfficeExpenseCategory,
  OfficeExpenseRecord,
  OwnerExpenseRecord,
} from '../../types';
import { ChartEmpty, ChartShell, ChartTooltip } from './ChartTooltip';

interface ExpenseBreakdownChartProps {
  ownerExpenses: OwnerExpenseRecord[];
  officeExpenses: OfficeExpenseRecord[];
  filter: FilterState;
}

const CHART_HEIGHT = 168;

export function ExpenseBreakdownChart({
  ownerExpenses,
  officeExpenses,
  filter,
}: ExpenseBreakdownChartProps) {
  const { displayCurrency, rates, formatDisplay } = useCurrency();
  const conversion = { displayCurrency, rates };
  const data = getExpenseCategoryBreakdown(
    ownerExpenses,
    officeExpenses,
    filter,
    conversion,
  );

  const colors = data.map(
    (entry, index) =>
      entry.category
        ? CATEGORY_COLORS[entry.category as OfficeExpenseCategory]
        : CHART_COLORS[index % CHART_COLORS.length],
  );

  if (data.length === 0) {
    return (
      <Card className="chart-card" padding={false}>
        <ChartShell title="Spend mix" subtitle="By category">
          <ChartEmpty message="No expense data for this period" />
        </ChartShell>
      </Card>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="chart-card" padding={false}>
      <ChartShell title="Spend mix" subtitle={`${displayCurrency} · ${data.length} categories`}>
        <div className="donut-layout">
          <div className="chart-container chart-container-donut">
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={68}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index]} />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <ChartTooltip formatter={(value) => formatDisplay(Number(value))} />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span className="donut-center-label">Total</span>
              <span className="donut-center-value">{formatDisplay(total)}</span>
            </div>
          </div>

          <ul className="donut-legend">
            {data.slice(0, 5).map((entry, index) => (
              <li key={entry.name} className="donut-legend-item">
                <span className="donut-legend-dot" style={{ background: colors[index] }} />
                <span className="donut-legend-name">{entry.name}</span>
                <span className="donut-legend-pct">
                  {total > 0 ? Math.round((entry.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
            {data.length > 5 && (
              <li className="donut-legend-more">+{data.length - 5} more</li>
            )}
          </ul>
        </div>
      </ChartShell>
    </Card>
  );
}
