import { useEffect, useMemo, useState } from 'react';
import { onValue, ref, set } from 'firebase/database';
import { normalizeEmployees } from '../lib/employees';
import { generateId } from '../lib/utils';
import { db } from '../lib/firebase';
import type { CurrencyCode, Employee } from '../types';

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const employeesRef = ref(db, 'employees');
    const unsubscribe = onValue(
      employeesRef,
      (snapshot) => {
        setEmployees(
          normalizeEmployees(snapshot.val() as Record<string, Employee> | null),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Employees listener error:', err);
        setError(
          err.message.includes('permission_denied')
            ? 'Unable to load employees. Deploy the latest database rules: npx firebase-tools deploy --only database'
            : err.message,
        );
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.active),
    [employees],
  );

  const addEmployee = async (input: {
    name: string;
    title?: string;
    monthlySalary: number;
    currency?: CurrencyCode;
  }) => {
    if (!db) throw new Error('Database is not configured');

    const id = generateId();
    const now = Date.now();
    const employee: Employee = {
      id,
      name: input.name.trim(),
      title: input.title?.trim() || undefined,
      monthlySalary: input.monthlySalary,
      currency: input.currency,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await set(ref(db, `employees/${id}`), employee);
    return employee;
  };

  const updateEmployee = async (
    id: string,
    updates: Partial<
      Pick<Employee, 'name' | 'title' | 'monthlySalary' | 'currency' | 'active'>
    >,
  ) => {
    if (!db) throw new Error('Database is not configured');

    const existing = employees.find((employee) => employee.id === id);
    if (!existing) throw new Error('Employee not found');

    const updated: Employee = {
      ...existing,
      ...updates,
      name: updates.name?.trim() ?? existing.name,
      title:
        updates.title === undefined
          ? existing.title
          : updates.title.trim() || undefined,
      updatedAt: Date.now(),
    };

    await set(ref(db, `employees/${id}`), updated);
    return updated;
  };

  return {
    employees,
    activeEmployees,
    loading,
    error,
    addEmployee,
    updateEmployee,
  };
}
