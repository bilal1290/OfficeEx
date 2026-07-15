import { canAccessChat, isVerifiedEmployee } from './account-access';
import { isAccountApproved } from './account-status';
import {
  getDefaultRolePermissions,
  resolvePermissionsForRole,
  type RolePermissionsConfig,
} from './role-permissions-config';
import type { AccountStatus, UserRole } from '../types';

export interface Permissions {
  canViewIncome: boolean;
  canManageUsers: boolean;
  canManageEmployees: boolean;
  canViewEmployees: boolean;
  canManageOwnerExpenses: boolean;
  canAccessOfficeExpenses: boolean;
  canCreateOfficeExpenses: boolean;
  canEditOfficeExpenses: boolean;
  canDeleteOfficeExpenses: boolean;
  canUpdateFixedExpenses: boolean;
  canViewExpenseTransactions: boolean;
  canViewIncomeOnDashboard: boolean;
  canViewOwnSalary: boolean;
  canAccessEmployeePortal: boolean;
  canAccessChat: boolean;
  canVerifyEmployees: boolean;
}

export { canAccessChat, isVerifiedEmployee };

export function getPermissions(
  role?: UserRole,
  accountStatus?: AccountStatus,
  employeeId?: string,
  config: RolePermissionsConfig = getDefaultRolePermissions(),
): Permissions {
  if (role && !isAccountApproved({ role, accountStatus })) {
    return resolvePermissionsForRole(undefined, accountStatus, employeeId, config);
  }

  return resolvePermissionsForRole(role, accountStatus, employeeId, config);
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'viewer':
      return 'Expense Viewer';
    case 'project_owner':
      return 'Project Owner';
    case 'employee':
      return 'Employee';
  }
}

export function getAccountStatusLabel(status?: AccountStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending verification';
    case 'verified':
      return 'Verified';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Active';
  }
}

export type { RolePermissionsConfig };
