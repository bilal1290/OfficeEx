import type { FixedExpenseCategory, OfficeExpenseCategory, CurrencyCode } from '../types';

export const COMPANY_SHARE_RATE = 0.6;

export const CURRENCY_OPTIONS: { value: CurrencyCode; label: string }[] = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'PKR', label: 'PKR — Pakistani Rupee' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
];

export const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export const OFFICE_EXPENSE_CATEGORIES: {
  value: OfficeExpenseCategory;
  label: string;
}[] = [
  { value: 'salaries', label: 'Employee Salaries' },
  { value: 'rent', label: 'Office Rent' },
  { value: 'electricity', label: 'Electricity Bills' },
  { value: 'internet', label: 'Internet Bills' },
  { value: 'food', label: 'Food & Refreshments' },
  { value: 'miscellaneous', label: 'Miscellaneous Expenses' },
];

export const CATEGORY_COLORS: Record<OfficeExpenseCategory, string> = {
  salaries: '#1B5E4B',
  rent: '#2F6B56',
  electricity: '#3D8B6E',
  internet: '#5A7268',
  food: '#0F3D30',
  miscellaneous: '#6B8F7A',
};

import type { UserRole } from '../types';

export const FIXED_EXPENSE_CATEGORIES: {
  value: FixedExpenseCategory;
  label: string;
}[] = [
  { value: 'electricity', label: 'Electricity Bill' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'rent', label: 'Office Rent' },
  { value: 'maintenance', label: 'Office Maintenance' },
  { value: 'misc', label: 'Miscellaneous' },
];

export const USER_ROLES: {
  value: UserRole;
  label: string;
  description: string;
}[] = [
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Full access to income, expenses, users, and settings',
  },
  {
    value: 'project_owner',
    label: 'Project Owner',
    description: 'Manage own project income and personal expenses',
  },
  {
    value: 'viewer',
    label: 'Expense Viewer',
    description: 'View, add, and update office & fixed expenses (no income access)',
  },
];

export const CHART_COLORS = [
  '#1B5E4B',
  '#2F6B56',
  '#3D8B6E',
  '#5A7268',
  '#0F3D30',
  '#6ECF9A',
  '#164D3D',
];
