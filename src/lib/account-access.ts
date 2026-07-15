import { isAccountApproved } from './account-status';
import type { AccountStatus, UserRole } from '../types';

export function isVerifiedEmployee(
  role?: UserRole,
  accountStatus?: AccountStatus,
  employeeId?: string,
): boolean {
  return role === 'employee' && accountStatus === 'verified' && Boolean(employeeId);
}

/** Any approved team member who can use Messages (broader than full employee portal). */
export function canAccessChat(
  role?: UserRole,
  accountStatus?: AccountStatus,
): boolean {
  if (!role || !isAccountApproved({ role, accountStatus })) {
    return false;
  }

  if (role === 'employee') {
    return accountStatus === 'verified';
  }

  return role === 'admin' || role === 'viewer' || role === 'project_owner';
}
