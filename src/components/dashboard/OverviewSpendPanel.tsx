import { useMemo } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { getExpenseCategoryBreakdown } from '../../lib/calculations';
import type {
  FilterState,
  FixedMonthlyExpenses,
  OfficeExpenseRecord,
  OwnerExpenseRecord,
} from '../../types';

interface OverviewSpendPanelProps {
  ownerExpenses: OwnerExpenseRecord[];
  officeExpenses: OfficeExpenseRecord[];
  fixedRecords?: FixedMonthlyExpenses[];
  filter: FilterState;
}

export function OverviewSpendPanel({
  ownerExpenses,
  officeExpenses,
  fixedRecords = [],
  filter,
}: OverviewSpendPanelProps) {
  const { formatDisplay, displayCurrency, rates } = useCurrency();

  const lines = useMemo(
    () =>
      getExpenseCategoryBreakdown(
        ownerExpenses,
        officeExpenses,
        filter,
        { displayCurrency, rates },
        fixedRecords,
      ),
    [ownerExpenses, officeExpenses, filter, displayCurrency, rates, fixedRecords],
  );

  const total = lines.reduce((sum, line) => sum + line.value, 0);

  return (
    <div className="overview-spend">
      <div className="overview-spend-head">
        <div>
          <h3 className="overview-spend-title">Spends</h3>
          <p className="overview-spend-subtitle">{displayCurrency} · by category</p>
        </div>
        <div className="overview-spend-total">
          <span>Total</span>
          <strong>{formatDisplay(total)}</strong>
        </div>
      </div>

      {total === 0 ? (
        <p className="overview-spend-empty">No expenses recorded for this period.</p>
      ) : (
        <ul className="overview-spend-list">
          {lines.map((line) => {
            const share = total > 0 ? (line.value / total) * 100 : 0;
            return (
              <li key={line.name} className="overview-spend-item">
                <div className="overview-spend-row">
                  <span className="overview-spend-label">{line.name}</span>
                  <span className="overview-spend-amount">{formatDisplay(line.value)}</span>
                </div>
                <div className="overview-spend-track" aria-hidden>
                  <span
                    className="overview-spend-fill"
                    style={{ width: `${Math.max(share, share > 0 ? 3 : 0)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
