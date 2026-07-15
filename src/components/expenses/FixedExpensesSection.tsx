import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFilter } from '../../context/FilterContext';
import { useCurrency } from '../../context/CurrencyContext';
import {
  createEmptyFixedAmounts,
  getFixedExpenseId,
  useFixedExpenses,
} from '../../hooks/useFixedExpenses';
import { FIXED_EXPENSE_AMOUNT_CATEGORIES } from '../../lib/constants';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { CurrencySelect } from '../ui/CurrencySelect';
import { Input } from '../ui/Input';
import type { CurrencyCode, FixedExpenseCategory } from '../../types';

export function FixedExpensesSection() {
  const { profile, permissions } = useAuth();
  const { filter } = useFilter();
  const { formatNative, formatDisplay, convertToDisplay, displayCurrency } = useCurrency();
  const { saveAmounts, loading, records } = useFixedExpenses();

  const month = filter.month === 'all' ? null : filter.month;
  const year = filter.year;

  const [amounts, setAmounts] = useState(createEmptyFixedAmounts());
  const [currency, setCurrency] = useState<CurrencyCode>(displayCurrency);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (month === null) {
      setAmounts(createEmptyFixedAmounts());
      setSaved(false);
      return;
    }
    const id = getFixedExpenseId(year, month);
    const existing = records.find((record) => record.id === id);
    setAmounts({ ...createEmptyFixedAmounts(), ...existing?.amounts });
    setCurrency(existing?.currency ?? displayCurrency);
    setSaved(false);
  }, [records, year, month, displayCurrency]);

  const total = FIXED_EXPENSE_AMOUNT_CATEGORIES.reduce(
    (sum, category) => sum + (amounts[category.value] ?? 0),
    0,
  );
  const totalInDisplay = convertToDisplay(total, currency);

  const handleAmountChange = (category: FixedExpenseCategory, value: string) => {
    setAmounts((current) => ({
      ...current,
      [category]: value === '' ? 0 : parseFloat(value),
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!profile || !permissions.canUpdateFixedExpenses || month === null) return;

    setSubmitting(true);
    try {
      await saveAmounts(year, month, amounts, profile.uid, currency);
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Card className="fixed-expenses-card">
      <CardHeader
        title="Fixed Monthly Expenses"
        subtitle="Rent, utilities & maintenance — salaries tracked separately"
        action={
          permissions.canUpdateFixedExpenses ? (
            <Button onClick={handleSave} disabled={submitting || month === null}>
              <Save size={16} />
              {submitting ? 'Saving...' : 'Save Amounts'}
            </Button>
          ) : undefined
        }
      />

      {month === null && (
        <p className="fixed-expenses-month-warning">
          Choose a specific month in the filter bar to edit fixed monthly amounts.
        </p>
      )}

      {permissions.canUpdateFixedExpenses && (
        <div className="fixed-expenses-currency">
          <CurrencySelect
            label="Amounts Currency"
            value={currency}
            onChange={setCurrency}
          />
        </div>
      )}

      <div className="fixed-expenses-grid">
        {FIXED_EXPENSE_AMOUNT_CATEGORIES.map((category) => (
          <div key={category.value} className="fixed-expense-item">
            <label className="fixed-expense-label" htmlFor={category.value}>
              {category.label}
            </label>
            {permissions.canUpdateFixedExpenses ? (
              <Input
                id={category.value}
                type="number"
                min="0"
                step="0.01"
                value={amounts[category.value] || ''}
                onChange={(event) =>
                  handleAmountChange(category.value, event.target.value)
                }
                placeholder="0.00"
              />
            ) : (
              <p className="fixed-expense-value">
                {formatNative(amounts[category.value] ?? 0, currency)}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="fixed-expenses-footer">
        <span className="fixed-expenses-total-label">
          Section Total ({currency}
          {currency !== displayCurrency ? ` · ≈ ${displayCurrency}` : ''})
        </span>
        <strong className="fixed-expenses-total">
          {formatNative(total, currency)}
          {currency !== displayCurrency && (
            <span className="amount-converted"> ≈ {formatDisplay(totalInDisplay)}</span>
          )}
        </strong>
        {saved && (
          <span className="fixed-expenses-saved">Amounts saved successfully</span>
        )}
      </div>
    </Card>
  );
}
