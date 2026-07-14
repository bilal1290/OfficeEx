import type { Employee, MonthlySalaryEntry } from '../types';

export function buildSalaryEntries(
  employees: Employee[],
  saved: MonthlySalaryEntry[] | undefined,
): MonthlySalaryEntry[] {
  const savedById = new Map(
    (saved ?? []).map((entry) => [entry.employeeId, entry]),
  );

  return employees
    .filter((employee) => employee.active)
    .map((employee) => {
      const existing = savedById.get(employee.id);
      return {
        employeeId: employee.id,
        employeeName: existing?.employeeName ?? employee.name,
        amount: existing?.amount ?? employee.monthlySalary,
        paid: existing?.paid ?? false,
        note: existing?.note ?? '',
      };
    });
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
