import type { SelectHTMLAttributes } from 'react';
import { CalendarRange, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { MONTHS, OFFICE_EXPENSE_CATEGORIES } from '../../lib/constants';
import { getYearOptions, getMonthLabel } from '../../lib/utils';
import { useFilter } from '../../context/FilterContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useUsers } from '../../hooks/useUsers';
import { CURRENCY_OPTIONS } from '../../lib/constants';

interface FilterBarProps {
  showOwnerFilter?: boolean;
}

interface FilterPillProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Array<{ value: string | number; label: string }>;
}

function FilterPill({ label, options, className, ...props }: FilterPillProps) {
  return (
    <label className={`filter-pill ${className ?? ''}`.trim()}>
      <span className="filter-pill-key">{label}</span>
      <select className="filter-pill-select" {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({ showOwnerFilter = true }: FilterBarProps) {
  const { filter, setFilter, resetFilter } = useFilter();
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  const { projectOwners } = useUsers();

  const monthOptions = [
    { value: 'all', label: 'All' },
    ...MONTHS.map((month) => ({
      value: month.value,
      label: getMonthLabel(month.value).slice(0, 3),
    })),
  ];

  const yearOptions = getYearOptions().map((year) => ({
    value: year,
    label: String(year),
  }));

  const ownerOptions = [
    { value: 'all', label: 'Everyone' },
    ...projectOwners.map((owner) => ({
      value: owner.uid,
      label: owner.displayName,
    })),
  ];

  const currencyOptions = CURRENCY_OPTIONS.map((option) => ({
    value: option.value,
    label: option.value,
  }));

  const periodLabel =
    filter.month === 'all'
      ? `${filter.year}`
      : `${getMonthLabel(filter.month as number).slice(0, 3)} ${filter.year}`;

  return (
    <div className="filter-strip" role="toolbar" aria-label="Data filters">
      <div className="filter-strip-mark">
        <SlidersHorizontal size={13} strokeWidth={2.25} aria-hidden />
        <span>Filter</span>
      </div>

      <span className="filter-period" title="Active period">
        <CalendarRange size={12} strokeWidth={2.25} aria-hidden />
        {periodLabel}
      </span>

      <div className="filter-strip-controls">
        <FilterPill
          label="Mo"
          options={monthOptions}
          value={filter.month}
          aria-label="Month"
          onChange={(event) =>
            setFilter({
              month:
                event.target.value === 'all' ? 'all' : Number(event.target.value),
            })
          }
        />
        <FilterPill
          label="Yr"
          options={yearOptions}
          value={filter.year}
          aria-label="Year"
          onChange={(event) => setFilter({ year: Number(event.target.value) })}
        />
        {showOwnerFilter && (
          <FilterPill
            label="Owner"
            options={ownerOptions}
            value={filter.ownerId}
            aria-label="Project owner"
            className="filter-pill-wide"
            onChange={(event) => setFilter({ ownerId: event.target.value })}
          />
        )}
        <FilterPill
          label="Cur"
          options={currencyOptions}
          value={displayCurrency}
          aria-label="Display currency"
          onChange={(event) =>
            setDisplayCurrency(event.target.value as typeof displayCurrency)
          }
        />
      </div>

      <button
        type="button"
        className="filter-reset"
        onClick={resetFilter}
        title="Reset filters"
        aria-label="Reset filters"
      >
        <RotateCcw size={14} strokeWidth={2.25} />
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
