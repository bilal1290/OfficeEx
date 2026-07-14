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
  canVerifyEmployees: false,
};

export function isVerifiedEmployee(
  role?: UserRole,
  accountStatus?: AccountStatus,
  employeeId?: string,
): boolean {
  return role === 'employee' && accountStatus === 'verified' && Boolean(employeeId);
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
        canVerifyEmployees: false,
      };
    case 'employee':
      return {
        ...NO_PERMISSIONS,
        canViewOwnSalary: isVerifiedEmployee(role, accountStatus, employeeId),
        canAccessEmployeePortal: isVerifiedEmployee(role, accountStatus, employeeId),
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
