import type { UserRole } from '../types';

export interface Permissions {
  canViewIncome: boolean;
  canManageUsers: boolean;
  canManageOwnerExpenses: boolean;
  canAccessOfficeExpenses: boolean;
  canCreateOfficeExpenses: boolean;
  canEditOfficeExpenses: boolean;
  canDeleteOfficeExpenses: boolean;
  canUpdateFixedExpenses: boolean;
  canViewExpenseTransactions: boolean;
  canViewIncomeOnDashboard: boolean;
}

export function getPermissions(role?: UserRole): Permissions {
  switch (role) {
    case 'admin':
      return {
        canViewIncome: true,
        canManageUsers: true,
        canManageOwnerExpenses: true,
        canAccessOfficeExpenses: true,
        canCreateOfficeExpenses: true,
        canEditOfficeExpenses: true,
        canDeleteOfficeExpenses: true,
        canUpdateFixedExpenses: true,
        canViewExpenseTransactions: true,
        canViewIncomeOnDashboard: true,
      };
    case 'viewer':
      return {
        canViewIncome: false,
        canManageUsers: false,
        canManageOwnerExpenses: false,
        canAccessOfficeExpenses: true,
        canCreateOfficeExpenses: false,
        canEditOfficeExpenses: true,
        canDeleteOfficeExpenses: false,
        canUpdateFixedExpenses: true,
        canViewExpenseTransactions: true,
        canViewIncomeOnDashboard: false,
      };
    case 'project_owner':
    default:
      return {
        canViewIncome: true,
        canManageUsers: false,
        canManageOwnerExpenses: true,
        canAccessOfficeExpenses: false,
        canCreateOfficeExpenses: false,
        canEditOfficeExpenses: false,
        canDeleteOfficeExpenses: false,
        canUpdateFixedExpenses: false,
        canViewExpenseTransactions: true,
        canViewIncomeOnDashboard: true,
      };
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
  }
}
