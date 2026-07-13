import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { FilterState } from '../types';

interface FilterContextValue {
  filter: FilterState;
  setFilter: (filter: Partial<FilterState>) => void;
  resetFilter: () => void;
}

const defaultFilter = (): FilterState => ({
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  ownerId: 'all',
});

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<FilterState>(defaultFilter);

  const setFilter = (partial: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...partial }));
  };

  const resetFilter = () => setFilterState(defaultFilter());

  return (
    <FilterContext.Provider value={{ filter, setFilter, resetFilter }}>
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
