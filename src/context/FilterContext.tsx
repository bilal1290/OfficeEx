import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { FilterState } from '../types';

interface FilterContextValue {
  filter: FilterState;
  setFilter: (filter: Partial<FilterState>) => void;
  resetFilter: () => void;
}

export function createDefaultFilter(): FilterState {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    ownerId: 'all',
  };
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<FilterState>(() => createDefaultFilter());

  const setFilter = useCallback((partial: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilterState(createDefaultFilter());
  }, []);

  const value = useMemo(
    () => ({ filter, setFilter, resetFilter }),
    [filter, setFilter, resetFilter],
  );

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within FilterProvider');
  }
  return context;
}
