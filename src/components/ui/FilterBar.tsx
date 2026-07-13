import { RotateCcw } from 'lucide-react';
import { MONTHS, OFFICE_EXPENSE_CATEGORIES } from '../../lib/constants';
import { getYearOptions, getMonthLabel } from '../../lib/utils';
import { useFilter } from '../../context/FilterContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useUsers } from '../../hooks/useUsers';
import { CURRENCY_OPTIONS } from '../../lib/constants';
import type { CurrencyCode } from '../../types';

interface FilterBarProps {
  showOwnerFilter?: boolean;
}

export function FilterBar({ showOwnerFilter = true }: FilterBarProps) {
  const { filter, setFilter, resetFilter } = useFilter();
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  const { projectOwners } = useUsers();

  const monthValue = filter.month === 'all' ? 'all' : String(filter.month);
  const yearValue = String(filter.year);

  const monthOptions = [
    { value: 'all', label: 'All months' },
    ...MONTHS.map((month) => ({
      value: String(month.value),
      label: getMonthLabel(month.value),
    })),
  ];

  const yearOptions = getYearOptions().map((year) => ({
    value: String(year),
    label: String(year),
  }));

  const ownerOptions = [
    { value: 'all', label: 'All owners' },
    ...projectOwners.map((owner) => ({
      value: owner.uid,
      label: owner.displayName,
    })),
  ];

  const handleMonthChange = (value: string) => {
    setFilter({
      month: value === 'all' ? 'all' : Number(value),
    });
  };

  const handleYearChange = (value: string) => {
    setFilter({ year: Number(value) });
  };

  const handleOwnerChange = (value: string) => {
    setFilter({ ownerId: value });
  };

  const handleCurrencyChange = (value: string) => {
    setDisplayCurrency(value as CurrencyCode);
  };

  return (
    <div className="filter-toolbar" role="toolbar" aria-label="Data filters">
      <div className="filter-field">
        <label className="filter-field-label" htmlFor="filter-month">
          Month
        </label>
        <select
          id="filter-month"
          className="filter-field-select"
          value={monthValue}
          onChange={(event) => handleMonthChange(event.target.value)}
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label className="filter-field-label" htmlFor="filter-year">
          Year
        </label>
        <select
          id="filter-year"
          className="filter-field-select"
          value={yearValue}
          onChange={(event) => handleYearChange(event.target.value)}
        >
          {yearOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {showOwnerFilter && (
        <div className="filter-field filter-field-wide">
          <label className="filter-field-label" htmlFor="filter-owner">
            Owner
          </label>
          <select
            id="filter-owner"
            className="filter-field-select"
            value={filter.ownerId}
            onChange={(event) => handleOwnerChange(event.target.value)}
          >
            {ownerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="filter-field">
        <label className="filter-field-label" htmlFor="filter-currency">
          Currency
        </label>
        <select
          id="filter-currency"
          className="filter-field-select"
          value={displayCurrency}
          onChange={(event) => handleCurrencyChange(event.target.value)}
        >
          {CURRENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.value}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="filter-toolbar-reset"
        onClick={resetFilter}
        title="Reset filters"
        aria-label="Reset filters"
      >
        <RotateCcw size={15} strokeWidth={2.25} />
        <span>Reset</span>
      </button>
    </div>
  );
}

export function getCategoryLabel(category: string): string {
  return (
    OFFICE_EXPENSE_CATEGORIES.find((item) => item.value === category)?.label ??
    category
  );
}
