import { get, set, ref } from 'firebase/database';
import { db } from './firebase';
import { buildPayslipFromEntry } from './salaries';
import type { CurrencyCode, EmployeePayslip, MonthlySalaryEntry } from '../types';

export async function syncEmployeePayslips(
  year: number,
  month: number,
  entries: MonthlySalaryEntry[],
  currency?: CurrencyCode,
) {
  if (!db) throw new Error('Database is not configured');
  const database = db;

  await Promise.all(
    entries.map(async (entry) => {
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
  );
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
