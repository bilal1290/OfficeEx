import type { Permissions } from './permissions';

interface DefaultRouteOptions {
  isVerifiedEmployee?: boolean;
  /** When redirecting away from `/`, do not return dashboard as a target. */
  skipDashboard?: boolean;
}

export function getDefaultRoute(
  permissions: Permissions,
  options: DefaultRouteOptions = {},
): string {
  if (options.isVerifiedEmployee) {
    return '/my-salary';
  }

  const candidates: Array<[boolean, string]> = [
    [!options.skipDashboard && permissions.canViewIncomeOnDashboard, '/'],
    [permissions.canViewIncome, '/income'],
    [permissions.canManageOwnerExpenses, '/expenses'],
    [permissions.canAccessOfficeExpenses, '/office-expenses'],
    [permissions.canViewExpenseTransactions, '/transactions'],
    [permissions.canAccessChat, '/chat'],
    [permissions.canAccessEmployeePortal, '/my-salary'],
    [permissions.canManageUsers, '/users'],
  ];

  for (const [allowed, path] of candidates) {
    if (allowed) return path;
  }

  return '/settings';
}

export function getEffectiveOwnerFilter(
  filter: import('../types').FilterState,
  profileUid: string | undefined,
  isAdmin: boolean,
): import('../types').FilterState {
  if (isAdmin) return filter;
  return { ...filter, ownerId: profileUid ?? 'all' };
}
