import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../lib/firebase';
import { normalizePayslips } from '../lib/payslips';
import type { EmployeePayslip } from '../types';

export function useEmployeePayslips(employeeId?: string) {
  const [payslips, setPayslips] = useState<EmployeePayslip[]>([]);
  const [loading, setLoading] = useState(Boolean(employeeId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId || !db) {
      setPayslips([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const payslipsRef = ref(db, `employeePayslips/${employeeId}`);
    const unsubscribe = onValue(
      payslipsRef,
      (snapshot) => {
        setPayslips(
          normalizePayslips(snapshot.val() as Record<string, EmployeePayslip> | null),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Employee payslips listener error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [employeeId]);

  return { payslips, loading, error };
}
