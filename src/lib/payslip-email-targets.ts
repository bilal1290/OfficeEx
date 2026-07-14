import { get, ref } from 'firebase/database';
import { db } from './firebase';
import type { MonthlySalaryEntry } from '../types';

export async function resolvePayslipEmailTargets(
  year: number,
  month: number,
  entries: MonthlySalaryEntry[],
  previousEntries: MonthlySalaryEntry[] = [],
): Promise<Set<string>> {
  const targets = new Set<string>();
  const payslipId = `${year}-${month}`;
  const previouslyPaid = new Set(
    previousEntries.filter((entry) => entry.paid).map((entry) => entry.employeeId),
  );

  for (const entry of entries) {
    if (!entry.paid) continue;

    const newlyPaid = !previouslyPaid.has(entry.employeeId);
    if (newlyPaid) {
      targets.add(entry.employeeId);
      continue;
    }

    if (!db) continue;
    const sentSnapshot = await get(
      ref(db, `employeePayslips/${entry.employeeId}/${payslipId}/emailSentAt`),
    );
    if (!sentSnapshot.exists()) {
      targets.add(entry.employeeId);
    }
  }

  return targets;
}
