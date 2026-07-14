import type { Employee } from '../types';

export function getEmployeeLabel(employee: Pick<Employee, 'name' | 'title'>): string {
  return employee.title ? `${employee.name} · ${employee.title}` : employee.name;
}

export function resolveEmployeeEmail(
  employee: Pick<Employee, 'email' | 'userId'>,
  users: Array<{ uid: string; email: string }>,
): string | null {
  const direct = employee.email?.trim();
  if (direct) return direct;

  if (employee.userId) {
    const linked = users.find((user) => user.uid === employee.userId);
    const linkedEmail = linked?.email?.trim();
    if (linkedEmail) return linkedEmail;
  }

  return null;
}

export function normalizeEmployees(
  data: Record<string, Employee> | null | undefined,
): Employee[] {
  if (!data) return [];
  return Object.values(data)
    .filter((employee) => employee?.id && employee.name)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function serializeEmployeeForDatabase(
  employee: Employee,
): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {
    id: employee.id,
    name: employee.name,
    monthlySalary: employee.monthlySalary,
    active: employee.active,
    createdAt: employee.createdAt,
  };

  if (employee.title) payload.title = employee.title;
  if (employee.email) payload.email = employee.email;
  if (employee.currency) payload.currency = employee.currency;
  if (employee.userId) payload.userId = employee.userId;
  if (employee.updatedAt != null) payload.updatedAt = employee.updatedAt;

  return payload;
}
