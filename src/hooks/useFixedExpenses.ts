import { useEffect, useState } from 'react';
import { onValue, ref, set } from 'firebase/database';
import { FIXED_EXPENSE_CATEGORIES } from '../lib/constants';
import { db } from '../lib/firebase';
import type { FixedExpenseCategory, FixedMonthlyExpenses } from '../types';

export function createEmptyFixedAmounts(): Record<FixedExpenseCategory, number> {
  return FIXED_EXPENSE_CATEGORIES.reduce(
    (amounts, category) => {
      amounts[category.value] = 0;
      return amounts;
    },
    {} as Record<FixedExpenseCategory, number>,
  );
}

export function getFixedExpenseId(year: number, month: number): string {
  return `${year}-${month}`;
}

export function useFixedExpenses(enabled = true) {
  const [records, setRecords] = useState<FixedMonthlyExpenses[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRecords([]);
      setLoading(false);
      return;
    }

    if (!db) {
      setLoading(false);
      return;
    }

    const fixedRef = ref(db, 'fixedExpenses');
    const unsubscribe = onValue(
      fixedRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() as Record<string, FixedMonthlyExpenses>;
          setRecords(Object.values(data));
        } else {
          setRecords([]);
        }
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Fixed expenses listener error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [enabled]);

  const getRecord = (year: number, month: number): FixedMonthlyExpenses => {
    const id = getFixedExpenseId(year, month);
    const existing = records.find((record) => record.id === id);
    if (existing) return existing;

    return {
      id,
      month,
      year,
      amounts: createEmptyFixedAmounts(),
    };
  };

  const saveAmounts = async (
    year: number,
    month: number,
    amounts: Record<FixedExpenseCategory, number>,
    updatedBy: string,
    currency?: FixedMonthlyExpenses['currency'],
  ) => {
    if (!db) throw new Error('Database is not configured');

    const existing = getRecord(year, month);
    const record: FixedMonthlyExpenses = {
      ...existing,
      amounts,
      currency: currency ?? existing.currency,
      updatedAt: Date.now(),
      updatedBy,
    };

    await set(ref(db, `fixedExpenses/${record.id}`), record);
    return record;
  };

  const saveSalaryEntries = async (
    year: number,
    month: number,
    salaryEntries: FixedMonthlyExpenses['salaryEntries'],
    updatedBy: string,
    currency?: FixedMonthlyExpenses['currency'],
  ) => {
    if (!db) throw new Error('Database is not configured');

    const existing = getRecord(year, month);
    const record: FixedMonthlyExpenses = {
      ...existing,
      salaryEntries,
      currency: currency ?? existing.currency,
      updatedAt: Date.now(),
      updatedBy,
    };

    await set(ref(db, `fixedExpenses/${record.id}`), record);
    return record;
  };

  return { records, loading, error, getRecord, saveAmounts, saveSalaryEntries };
}
