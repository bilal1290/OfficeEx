import { useEffect, useState } from 'react';
import { onValue, ref, remove, set } from 'firebase/database';
import { db } from '../lib/firebase';
import { generateId } from '../lib/utils';
import type { OfficeExpenseRecord, OwnerExpenseRecord } from '../types';

export function useOwnerExpenses(enabled = true) {
  const [expenses, setExpenses] = useState<OwnerExpenseRecord[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    if (!db) {
      setLoading(false);
      return;
    }

    const expensesRef = ref(db, 'ownerExpenses');
    const unsubscribe = onValue(
      expensesRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() as Record<string, OwnerExpenseRecord>;
          setExpenses(Object.values(data));
        } else {
          setExpenses([]);
        }
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Owner expenses listener error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [enabled]);

  const addExpense = async (
    data: Omit<OwnerExpenseRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    if (!db) throw new Error('Database is not configured');
    const id = generateId();
    const record: OwnerExpenseRecord = {
      ...data,
      id,
      createdAt: Date.now(),
    };
    await set(ref(db, `ownerExpenses/${id}`), record);
    return record;
  };

  const updateExpense = async (
    id: string,
    data: Partial<Omit<OwnerExpenseRecord, 'id' | 'createdAt'>>,
  ) => {
    if (!db) throw new Error('Database is not configured');
    const existing = expenses.find((e) => e.id === id);
    if (!existing) throw new Error('Expense record not found');

    const updated: OwnerExpenseRecord = {
      ...existing,
      ...data,
      updatedAt: Date.now(),
    };
    await set(ref(db, `ownerExpenses/${id}`), updated);
  };

  const deleteExpense = async (id: string) => {
    if (!db) throw new Error('Database is not configured');
    await remove(ref(db, `ownerExpenses/${id}`));
  };

  return { expenses, loading, error, addExpense, updateExpense, deleteExpense };
}

export function useOfficeExpenses(enabled = true) {
  const [expenses, setExpenses] = useState<OfficeExpenseRecord[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    if (!db) {
      setLoading(false);
      return;
    }

    const expensesRef = ref(db, 'officeExpenses');
    const unsubscribe = onValue(
      expensesRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() as Record<string, OfficeExpenseRecord>;
          setExpenses(Object.values(data));
        } else {
          setExpenses([]);
        }
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Office expenses listener error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [enabled]);

  const addExpense = async (
    data: Omit<OfficeExpenseRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    if (!db) throw new Error('Database is not configured');
    const id = generateId();
    const record: OfficeExpenseRecord = {
      ...data,
      id,
      createdAt: Date.now(),
    };
    await set(ref(db, `officeExpenses/${id}`), record);
    return record;
  };

  const updateExpense = async (
    id: string,
    data: Partial<Omit<OfficeExpenseRecord, 'id' | 'createdAt'>>,
  ) => {
    if (!db) throw new Error('Database is not configured');
    const existing = expenses.find((e) => e.id === id);
    if (!existing) throw new Error('Expense record not found');

    const updated: OfficeExpenseRecord = {
      ...existing,
      ...data,
      updatedAt: Date.now(),
    };
    await set(ref(db, `officeExpenses/${id}`), updated);
  };

  const deleteExpense = async (id: string) => {
    if (!db) throw new Error('Database is not configured');
    await remove(ref(db, `officeExpenses/${id}`));
  };

  return { expenses, loading, error, addExpense, updateExpense, deleteExpense };
}
