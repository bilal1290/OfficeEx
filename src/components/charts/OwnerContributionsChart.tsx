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
import { getOwnerContributions } from '../../lib/calculations';
import { formatCompactCurrency } from '../../lib/currency';
import type { FilterState, IncomeRecord, UserProfile } from '../../types';
import { ChartEmpty, ChartLegend, ChartShell, ChartTooltip } from './ChartTooltip';

interface OwnerContributionsChartProps {
  incomes: IncomeRecord[];
  users: UserProfile[];
  filter: FilterState;
}

export function OwnerContributionsChart({
  incomes,
  users,
  filter,
}: OwnerContributionsChartProps) {
  const { displayCurrency, rates, formatDisplay } = useCurrency();
  const conversion = { displayCurrency, rates };
  const data = getOwnerContributions(incomes, users, filter, conversion);

  const chartHeight = Math.min(Math.max(data.length * 36 + 48, 140), 200);

  if (data.length === 0) {
    return (
      <Card className="chart-card" padding={false}>
        <ChartShell title="Owner share" subtitle="Project vs company">
          <ChartEmpty message="No income data for this period" />
        </ChartShell>
      </Card>
    );
  }

  return (
    <Card className="chart-card" padding={false}>
      <ChartShell
        title="Owner share"
        subtitle={`60% company cut · ${displayCurrency}`}
        legend={
          <ChartLegend
            items={[
              { label: 'Project', color: '#1B5E4B' },
              { label: 'Company', color: '#3D8B6E' },
            ]}
          />
        }
      >
        <div className="chart-container chart-container-sm">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data} layout="vertical" barGap={2} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" horizontal={false} />
              <XAxis
                type="number"
                stroke="var(--text-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  formatCompactCurrency(Number(value), displayCurrency)
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-hover)', opacity: 0.4 }}
                content={
                  <ChartTooltip formatter={(value) => formatDisplay(Number(value))} />
                }
              />
              <Bar dataKey="amount" name="Project Income" fill="#1B5E4B" radius={[0, 3, 3, 0]} maxBarSize={8} />
              <Bar dataKey="companyShare" name="Company Share" fill="#3D8B6E" radius={[0, 3, 3, 0]} maxBarSize={8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartShell>
    </Card>
  );
}
