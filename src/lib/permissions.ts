import type { UserRole } from '../types';

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
};

export function getPermissions(role?: UserRole): Permissions {
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
  }
}
