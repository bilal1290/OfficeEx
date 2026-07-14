import type { Employee } from '../types';

export function getEmployeeLabel(employee: Pick<Employee, 'name' | 'title'>): string {
  return employee.title ? `${employee.name} · ${employee.title}` : employee.name;
}

export function normalizeEmployees(
  data: Record<string, Employee> | null | undefined,
): Employee[] {
  if (!data) return [];
  return Object.values(data)
    .filter((employee) => employee?.id && employee.name)
    .sort((left, right) => left.name.localeCompare(right.name));
}
