import type { Employee, EmployeePayslip, MonthlySalaryEntry } from '../types';

export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function computeLeaveDeduction(
  baseSalary: number,
  leaveDays: number,
  month: number,
  year: number,
): number {
  if (leaveDays <= 0 || baseSalary <= 0) return 0;
  const maxDays = daysInMonth(month, year);
  const cappedLeaveDays = Math.min(leaveDays, maxDays);
  const dailyRate = baseSalary / maxDays;
  const deduction = Math.round(dailyRate * cappedLeaveDays * 100) / 100;
  return Math.min(deduction, baseSalary);
}

export function computeNetSalary(
  entry: Pick<
    MonthlySalaryEntry,
    'baseSalary' | 'leaveDays' | 'leaveDeduction' | 'bonus' | 'otherDeductions'
  >,
  month?: number,
  year?: number,
): number {
  const base = entry.baseSalary ?? 0;
  let leaveDeduction = entry.leaveDeduction ?? 0;

  if (entry.leaveDays > 0 && month !== undefined && year !== undefined) {
    leaveDeduction = computeLeaveDeduction(base, entry.leaveDays, month, year);
  }

  const bonus = entry.bonus ?? 0;
  const other = entry.otherDeductions ?? 0;
  return Math.max(0, Math.round((base - leaveDeduction - other + bonus) * 100) / 100);
}

export function enrichSalaryEntry(
  entry: Partial<MonthlySalaryEntry> & Pick<MonthlySalaryEntry, 'employeeId' | 'employeeName'>,
  employee: Employee | undefined,
  month: number,
  year: number,
): MonthlySalaryEntry {
  const baseSalary =
    entry.baseSalary ?? employee?.monthlySalary ?? 0;
  const leaveDays = Math.min(entry.leaveDays ?? 0, daysInMonth(month, year));
  const leaveDeduction = computeLeaveDeduction(baseSalary, leaveDays, month, year);
  const bonus = entry.bonus ?? 0;
  const otherDeductions = entry.otherDeductions ?? 0;

  const normalized: MonthlySalaryEntry = {
    employeeId: entry.employeeId,
    employeeName: entry.employeeName,
    baseSalary,
    leaveDays,
    leaveDeduction,
    bonus,
    otherDeductions,
    amount: computeNetSalary(
      { baseSalary, leaveDays, leaveDeduction, bonus, otherDeductions },
      month,
      year,
    ),
    paid: entry.paid ?? false,
    note: entry.note ?? '',
  };

  return normalized;
}

export function buildSalaryEntries(
  employees: Employee[],
  saved: MonthlySalaryEntry[] | undefined,
  month: number,
  year: number,
): MonthlySalaryEntry[] {
  const savedById = new Map(
    (saved ?? []).map((entry) => [entry.employeeId, entry]),
  );

  return employees
    .filter((employee) => employee.active)
    .map((employee) => {
      const existing = savedById.get(employee.id);
      return enrichSalaryEntry(
        {
          employeeId: employee.id,
          employeeName: existing?.employeeName ?? employee.name,
          baseSalary: existing?.baseSalary ?? employee.monthlySalary,
          leaveDays: existing?.leaveDays,
          leaveDeduction: existing?.leaveDeduction,
          bonus: existing?.bonus,
          otherDeductions: existing?.otherDeductions,
          amount: existing?.amount,
          paid: existing?.paid,
          note: existing?.note,
        },
        employee,
        month,
        year,
      );
    });
}

export function buildPayslipFromEntry(
  entry: MonthlySalaryEntry,
  month: number,
  year: number,
  currency?: EmployeePayslip['currency'],
): EmployeePayslip {
  return {
    id: `${year}-${month}`,
    employeeId: entry.employeeId,
    employeeName: entry.employeeName,
    month,
    year,
    baseSalary: entry.baseSalary,
    leaveDays: entry.leaveDays,
    leaveDeduction: entry.leaveDeduction,
    bonus: entry.bonus,
    otherDeductions: entry.otherDeductions,
    netAmount: entry.amount,
    paid: entry.paid,
    currency,
    note: entry.note,
    updatedAt: Date.now(),
  };
}

export function sumPaidSalaries(entries: MonthlySalaryEntry[]): number {
  return entries
    .filter((entry) => entry.paid)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function sumAllSalaries(entries: MonthlySalaryEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

export function countPaidSalaries(entries: MonthlySalaryEntry[]): number {
  return entries.filter((entry) => entry.paid).length;
}
