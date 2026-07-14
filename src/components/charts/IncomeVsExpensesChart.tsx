import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../ui/Card';
import { useCurrency } from '../../context/CurrencyContext';
import { computeMonthlyBalances } from '../../lib/calculations';
import { formatCompactCurrency } from '../../lib/currency';
import { getMonthLabel } from '../../lib/utils';
import type {
  FixedMonthlyExpenses,
  IncomeRecord,
  OfficeExpenseRecord,
  OwnerExpenseRecord,
} from '../../types';
import { ChartLegend, ChartShell, ChartTooltip } from './ChartTooltip';

interface IncomeVsExpensesChartProps {
  incomes: IncomeRecord[];
  ownerExpenses: OwnerExpenseRecord[];
  officeExpenses: OfficeExpenseRecord[];
  fixedRecords?: FixedMonthlyExpenses[];
  year: number;
  embedded?: boolean;
}

const CHART_HEIGHT = 168;

export function IncomeVsExpensesChart({
  incomes,
  ownerExpenses,
  officeExpenses,
  fixedRecords = [],
  year,
  embedded = false,
}: IncomeVsExpensesChartProps) {
  const { displayCurrency, rates, formatDisplay } = useCurrency();
  const conversion = { displayCurrency, rates };

  const data = computeMonthlyBalances(
    incomes,
    ownerExpenses,
    officeExpenses,
    year,
    conversion,
    fixedRecords,
  ).map((month) => ({
    name: getMonthLabel(month.month).slice(0, 3),
    income: month.income,
    expenses: month.expenses,
  }));

  const content = (
    <ChartShell
      title="Cash flow"
      subtitle={`${year}`}
      legend={
        <ChartLegend
          items={[
            { label: 'Income', color: '#1B5E4B' },
            { label: 'Expenses', color: '#C45C5C' },
          ]}
        />
      }
    >
      <div className="chart-container chart-container-sm">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={data} barGap={2} barCategoryGap="18%" margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="var(--text-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(value) =>
                formatCompactCurrency(Number(value), displayCurrency)
              }
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-hover)', opacity: 0.5 }}
              content={
                <ChartTooltip formatter={(value) => formatDisplay(Number(value))} />
              }
            />
            <Bar dataKey="income" name="Income" fill="#1B5E4B" radius={[3, 3, 0, 0]} maxBarSize={14} />
            <Bar dataKey="expenses" name="Expenses" fill="#C45C5C" radius={[3, 3, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );

  if (embedded) {
    return <div className="summary-chart-panel">{content}</div>;
  }

  return (
    <Card className="chart-card" padding={false}>
      {content}
    </Card>
  );
}
