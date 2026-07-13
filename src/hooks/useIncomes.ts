import { useEffect, useState } from 'react';
import { onValue, ref, remove, set } from 'firebase/database';
import { db } from '../lib/firebase';
import { calculateCompanyShare, generateId } from '../lib/utils';
import type { IncomeRecord } from '../types';

export function useIncomes(enabled = true) {
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIncomes([]);
      setLoading(false);
      return;
    }

    if (!db) {
      setLoading(false);
      return;
    }

    const incomesRef = ref(db, 'incomes');
    const unsubscribe = onValue(
      incomesRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() as Record<string, IncomeRecord>;
          setIncomes(Object.values(data));
        } else {
          setIncomes([]);
        }
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Incomes listener error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [enabled]);

  const addIncome = async (
    data: Omit<
      IncomeRecord,
      'id' | 'companyShare' | 'createdAt' | 'updatedAt'
    >,
  ) => {
    if (!db) throw new Error('Database is not configured');
    const id = generateId();
    const record: IncomeRecord = {
      ...data,
      id,
      companyShare: calculateCompanyShare(data.amount),
      createdAt: Date.now(),
    };
    await set(ref(db, `incomes/${id}`), record);
    return record;
  };

  const updateIncome = async (
    id: string,
    data: Partial<Omit<IncomeRecord, 'id' | 'createdAt'>>,
  ) => {
    if (!db) throw new Error('Database is not configured');
    const existing = incomes.find((i) => i.id === id);
    if (!existing) throw new Error('Income record not found');

    const updated: IncomeRecord = {
      ...existing,
      ...data,
      updatedAt: Date.now(),
    };
    if (data.amount !== undefined) {
      updated.companyShare = calculateCompanyShare(data.amount);
    }
    await set(ref(db, `incomes/${id}`), updated);
  };

  const deleteIncome = async (id: string) => {
    if (!db) throw new Error('Database is not configured');
    await remove(ref(db, `incomes/${id}`));
  };

  return { incomes, loading, error, addIncome, updateIncome, deleteIncome };
}
