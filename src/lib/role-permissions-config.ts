import { canAccessChat as employeeChatEligible, isVerifiedEmployee } from './account-access';
import { isAccountApproved } from './account-status';
import type { Permissions } from './permissions';
import type { AccountStatus, UserRole } from '../types';

export type PermissionKey = keyof Permissions;

export type ConfigurableRole = Exclude<UserRole, 'admin'>;

export const CONFIGURABLE_ROLES: ConfigurableRole[] = [
  'project_owner',
  'viewer',
  'employee',
];

export type RolePermissionsConfig = Record<UserRole, Permissions>;

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  items: PermissionDefinition[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'pages',
    label: 'Pages & navigation',
    items: [
      {
        key: 'canViewIncomeOnDashboard',
        label: 'Overview',
        description: 'Home dashboard with income and balance summary',
      },
      {
        key: 'canViewIncome',
        label: 'Income',
        description: 'Project income records and company share',
      },
      {
        key: 'canManageOwnerExpenses',
        label: 'Owner expenses',
        description: 'Personal expenses that offset company share',
      },
      {
        key: 'canAccessOfficeExpenses',
        label: 'Office expenses',
        description: 'Office and fixed operational costs',
      },
      {
        key: 'canViewExpenseTransactions',
        label: 'Ledger',
        description: 'Full transaction history',
      },
      {
        key: 'canManageUsers',
        label: 'Team & users',
        description: 'User management and approvals (admin only by default)',
      },
      {
        key: 'canAccessChat',
        label: 'Messages',
        description: 'Team chat and direct messages',
      },
      {
        key: 'canAccessEmployeePortal',
        label: 'Employee portal',
        description: 'Salary, attendance, and leave for linked employees',
      },
    ],
  },
  {
    id: 'office',
    label: 'Office expense actions',
    items: [
      {
        key: 'canCreateOfficeExpenses',
        label: 'Create office expenses',
        description: 'Add new office expense entries',
      },
      {
        key: 'canEditOfficeExpenses',
        label: 'Edit office expenses',
        description: 'Update existing office expenses',
      },
      {
        key: 'canDeleteOfficeExpenses',
        label: 'Delete office expenses',
        description: 'Remove office expense entries',
      },
      {
        key: 'canUpdateFixedExpenses',
        label: 'Fixed monthly expenses',
        description: 'Edit electricity, rent, and other fixed costs',
      },
    ],
  },
  {
    id: 'team',
    label: 'Team management',
    items: [
      {
        key: 'canViewEmployees',
        label: 'View employees',
        description: 'See employee records and attendance',
      },
      {
        key: 'canManageEmployees',
        label: 'Manage employees',
        description: 'Create and edit employee records, leave, and payslips',
      },
      {
        key: 'canVerifyEmployees',
        label: 'Verify sign-ups',
        description: 'Approve or reject pending employee accounts',
      },
    ],
  },
  {
    id: 'employee',
    label: 'Employee portal',
    items: [
      {
        key: 'canViewOwnSalary',
        label: 'View own salary',
        description: 'Salary breakdown inside the employee portal',
      },
    ],
  },
];

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

/** Hardcoded defaults — used on first load and when resetting a role. */
export function getDefaultRolePermissions(): RolePermissionsConfig {
  return {
    admin: {
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
      canAccessChat: true,
      canVerifyEmployees: true,
    },
    project_owner: {
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
      canAccessChat: true,
      canVerifyEmployees: false,
    },
    viewer: {
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
      canAccessChat: true,
      canVerifyEmployees: false,
    },
    employee: {
      ...NO_PERMISSIONS,
      canAccessChat: true,
      canAccessEmployeePortal: true,
      canViewOwnSalary: true,
    },
  };
}

function sanitizePermissions(value: unknown): Permissions | null {
  if (!value || typeof value !== 'object') return null;

  const defaults = NO_PERMISSIONS;
  const input = value as Partial<Permissions>;
  const next = { ...defaults };

  for (const key of Object.keys(defaults) as PermissionKey[]) {
    if (typeof input[key] === 'boolean') {
      next[key] = input[key];
    }
  }

  return next;
}

export function parseRolePermissionsConfig(value: unknown): RolePermissionsConfig {
  const defaults = getDefaultRolePermissions();
  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const input = value as Partial<Record<UserRole, unknown>>;
  return {
    admin: sanitizePermissions(input.admin) ?? defaults.admin,
    project_owner: sanitizePermissions(input.project_owner) ?? defaults.project_owner,
    viewer: sanitizePermissions(input.viewer) ?? defaults.viewer,
    employee: sanitizePermissions(input.employee) ?? defaults.employee,
  };
}

/** Admin permissions are always full access; team management cannot be removed from admin. */
export function enforceAdminGuardrails(permissions: Permissions): Permissions {
  const defaults = getDefaultRolePermissions().admin;
  return {
    ...defaults,
    ...permissions,
    canManageUsers: true,
    canVerifyEmployees: true,
  };
}

export function resolvePermissionsForRole(
  role: UserRole | undefined,
  accountStatus: AccountStatus | undefined,
  employeeId: string | undefined,
  config: RolePermissionsConfig,
): Permissions {
  if (!role || !isAccountApproved({ role, accountStatus })) {
    return NO_PERMISSIONS;
  }

  if (role === 'admin') {
    return enforceAdminGuardrails(config.admin);
  }

  const base = { ...config[role] };

  if (role === 'employee') {
    const verified = isVerifiedEmployee(role, accountStatus, employeeId);
    const portalAccess = base.canAccessEmployeePortal && verified;
    return {
      ...NO_PERMISSIONS,
      canAccessChat: base.canAccessChat && employeeChatEligible(role, accountStatus),
      canAccessEmployeePortal: portalAccess,
      canViewOwnSalary: portalAccess && base.canViewOwnSalary,
    };
  }

  return {
    ...base,
    canAccessChat: base.canAccessChat && employeeChatEligible(role, accountStatus),
  };
}

export function cloneRolePermissionsConfig(config: RolePermissionsConfig): RolePermissionsConfig {
  return {
    admin: { ...config.admin },
    project_owner: { ...config.project_owner },
    viewer: { ...config.viewer },
    employee: { ...config.employee },
  };
}
