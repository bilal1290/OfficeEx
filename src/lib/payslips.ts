import { get, remove, ref, set } from 'firebase/database';
import { db } from './firebase';
import { buildPayslipFromEntry } from './salaries';
import type { CurrencyCode, EmployeePayslip, MonthlySalaryEntry } from '../types';

export async function syncEmployeePayslips(
  year: number,
  month: number,
  entries: MonthlySalaryEntry[],
  currency?: CurrencyCode,
  previousEmployeeIds: string[] = [],
) {
  if (!db) throw new Error('Database is not configured');
  const database = db;
  const payslipId = `${year}-${month}`;
  const activeEmployeeIds = new Set(entries.map((entry) => entry.employeeId));
  const staleEmployeeIds = previousEmployeeIds.filter(
    (employeeId) => !activeEmployeeIds.has(employeeId),
  );

  await Promise.all([
    ...entries.map(async (entry) => {
      const payslip = buildPayslipFromEntry(entry, month, year, currency);
      const sentSnapshot = await get(
        ref(database, `employeePayslips/${entry.employeeId}/${payslip.id}/emailSentAt`),
      );
      if (sentSnapshot.exists()) {
        payslip.emailSentAt = Number(sentSnapshot.val());
      }
      return set(
        ref(database, `employeePayslips/${entry.employeeId}/${payslip.id}`),
        payslip,
      );
    }),
    ...staleEmployeeIds.map((employeeId) =>
      remove(ref(database, `employeePayslips/${employeeId}/${payslipId}`)),
    ),
  ]);
}

export async function markPayslipEmailSent(
  employeeId: string,
  year: number,
  month: number,
) {
  if (!db) throw new Error('Database is not configured');

  const id = `${year}-${month}`;
  const payslipRef = ref(db, `employeePayslips/${employeeId}/${id}/emailSentAt`);
  await set(payslipRef, Date.now());
}

export function normalizePayslips(
  data: Record<string, EmployeePayslip> | null | undefined,
): EmployeePayslip[] {
  if (!data) return [];
  return Object.values(data).sort((left, right) => {
    if (left.year !== right.year) return right.year - left.year;
    return right.month - left.month;
  });
}
