import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';
import type { Employee } from '../types';

function normalizeEmployee(employeeId: string, value: unknown): Employee | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Partial<Employee>;
  if (!record.name || typeof record.monthlySalary !== 'number') {
    return null;
  }

  return {
    id: record.id ?? employeeId,
    name: record.name,
    title: record.title,
    email: record.email,
    monthlySalary: record.monthlySalary,
    currency: record.currency,
    active: record.active ?? true,
    userId: record.userId,
    createdAt: record.createdAt ?? Date.now(),
    updatedAt: record.updatedAt,
  };
}

export function useEmployeeRecord(employeeId?: string) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(Boolean(employeeId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId || !db) {
      setEmployee(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const employeeRef = ref(db, `employees/${employeeId}`);
    const unsubscribe = onValue(
      employeeRef,
      (snapshot) => {
        setEmployee(
          snapshot.exists()
            ? normalizeEmployee(employeeId, snapshot.val())
            : null,
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Employee record listener error:', err);
        setError(
          err.message.includes('permission_denied')
            ? 'Unable to load your employee profile.'
            : err.message,
        );
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [employeeId]);

  return { employee, loading, error };
}
