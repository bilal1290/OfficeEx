import { isAccountApproved } from './account-status';
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

const NO_PERMISSIONS: Permissions = {
  canViewIncome: false,
  canManageUsers: false,
  canManageEmployees: false,
  canViewEmployees: false,
  canManageOwnerExpenses: false,
  canAccessOfficeExpenses: false,
  canCreateOfficeExpenses: false,
  canEditOfficeExpenses: false,
  canDeleteOfficeExpenses: false,
  canUpdateFixedExpenses: false,
  canViewExpenseTransactions: false,
  canViewIncomeOnDashboard: false,
  canViewOwnSalary: false,
  canAccessEmployeePortal: false,
  canAccessChat: false,
  canVerifyEmployees: false,
};

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

export function getPermissions(
  role?: UserRole,
  accountStatus?: AccountStatus,
  employeeId?: string,
): Permissions {
  if (
    role &&
    !isAccountApproved({ role, accountStatus })
  ) {
    return NO_PERMISSIONS;
  }

  switch (role) {
    case 'admin':
      return {
        canViewIncome: true,
        canManageUsers: true,
        canManageEmployees: true,
        canViewEmployees: true,
        canManageOwnerExpenses: true,
        canAccessOfficeExpenses: true,
        canCreateOfficeExpenses: true,
        canEditOfficeExpenses: true,
        canDeleteOfficeExpenses: true,
        canUpdateFixedExpenses: true,
        canViewExpenseTransactions: true,
        canViewIncomeOnDashboard: true,
        canViewOwnSalary: false,
        canAccessEmployeePortal: false,
        canAccessChat: canAccessChat('admin', accountStatus),
        canVerifyEmployees: true,
      };
    case 'viewer':
      return {
        canViewIncome: false,
        canManageUsers: false,
        canManageEmployees: false,
        canViewEmployees: true,
        canManageOwnerExpenses: false,
        canAccessOfficeExpenses: true,
        canCreateOfficeExpenses: true,
        canEditOfficeExpenses: true,
        canDeleteOfficeExpenses: false,
        canUpdateFixedExpenses: true,
        canViewExpenseTransactions: true,
        canViewIncomeOnDashboard: false,
        canViewOwnSalary: false,
        canAccessEmployeePortal: false,
        canAccessChat: canAccessChat('viewer', accountStatus),
        canVerifyEmployees: false,
      };
    case 'project_owner':
      return {
        canViewIncome: true,
        canManageUsers: false,
        canManageEmployees: false,
        canViewEmployees: false,
        canManageOwnerExpenses: true,
        canAccessOfficeExpenses: false,
        canCreateOfficeExpenses: false,
        canEditOfficeExpenses: false,
        canDeleteOfficeExpenses: false,
        canUpdateFixedExpenses: false,
        canViewExpenseTransactions: true,
        canViewIncomeOnDashboard: true,
        canViewOwnSalary: false,
        canAccessEmployeePortal: false,
        canAccessChat: canAccessChat('project_owner', accountStatus),
        canVerifyEmployees: false,
      };
    case 'employee':
      return {
        ...NO_PERMISSIONS,
        canViewOwnSalary: isVerifiedEmployee(role, accountStatus, employeeId),
        canAccessEmployeePortal: isVerifiedEmployee(role, accountStatus, employeeId),
        canAccessChat: canAccessChat(role, accountStatus),
      };
    default:
      return NO_PERMISSIONS;
  }
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
