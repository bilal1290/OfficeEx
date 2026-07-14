import { useMemo } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { useFilter } from '../../context/FilterContext';
import {
  computeOfficeSpendBreakdown,
  sumOfficeSpendBreakdown,
} from '../../lib/office-totals';
import { getMonthLabel } from '../../lib/utils';
import { Card, CardHeader } from '../ui/Card';
import type { FixedMonthlyExpenses, OfficeExpenseRecord } from '../../types';

interface OfficeSpendSummaryProps {
  fixedRecords: FixedMonthlyExpenses[];
  additionalExpenses: OfficeExpenseRecord[];
}

export function OfficeSpendSummary({
  fixedRecords,
  additionalExpenses,
}: OfficeSpendSummaryProps) {
  const { filter } = useFilter();
  const { formatDisplay, displayCurrency, rates } = useCurrency();

  const lines = useMemo(
    () =>
      computeOfficeSpendBreakdown(fixedRecords, additionalExpenses, filter, {
        displayCurrency,
        rates,
      }),
    [fixedRecords, additionalExpenses, filter, displayCurrency, rates],
  );

  const total = sumOfficeSpendBreakdown(lines);

  const periodLabel =
    filter.month === 'all'
      ? `Full year ${filter.year}`
      : `${getMonthLabel(filter.month as number)} ${filter.year}`;

  return (
    <Card className="spend-summary-card office-spend-summary">
      <CardHeader
        title="Office spend breakdown"
        subtitle={`${periodLabel} · ${displayCurrency}`}
      />

      {total === 0 ? (
        <p className="spend-summary-empty">
          No office expenses recorded for this period yet. Save fixed amounts, salaries, or
          add additional expenses below.
        </p>
      ) : (
        <ul className="spend-summary-list">
          {lines.map((line) => {
            const share = total > 0 ? (line.amount / total) * 100 : 0;
            return (
              <li key={line.id} className="spend-summary-item">
                <div className="spend-summary-row">
                  <span className="spend-summary-label">{line.label}</span>
                  <span className="spend-summary-amount">{formatDisplay(line.amount)}</span>
                </div>
                <div className="spend-summary-bar" aria-hidden>
                  <span
                    className="spend-summary-bar-fill"
                    style={{ width: `${Math.max(share, share > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="spend-summary-share">{Math.round(share)}% of total</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="spend-summary-footer">
        <span>Total office spend</span>
        <strong>{formatDisplay(total)}</strong>
      </div>
    </Card>
  );
}
