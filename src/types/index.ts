export type UserRole = 'admin' | 'project_owner' | 'viewer' | 'employee';

export type AccountStatus = 'pending' | 'verified' | 'rejected';

export type CurrencyCode = 'USD' | 'PKR' | 'EUR' | 'GBP';

export type ExchangeRates = Record<CurrencyCode, number>;

export interface CurrencyConversion {
  displayCurrency: CurrencyCode;
  rates: ExchangeRates;
}

export type OfficeExpenseCategory =
  | 'salaries'
  | 'rent'
  | 'electricity'
  | 'internet'
  | 'food'
  | 'miscellaneous';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  accountStatus?: AccountStatus;
  employeeId?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface IncomeRecord {
  id: string;
  ownerId: string;
  ownerName: string;
  amount: number;
  currency?: CurrencyCode;
  companyShare: number;
  month: number;
  year: number;
  description: string;
  transactionAt: number;
  createdAt: number;
  updatedAt?: number;
}

export interface OwnerExpenseRecord {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  amount: number;
  currency?: CurrencyCode;
  month: number;
  year: number;
  description: string;
  transactionAt: number;
  createdAt: number;
  updatedAt?: number;
}

export interface OfficeExpenseRecord {
  id: string;
  category: OfficeExpenseCategory;
  name: string;
  amount: number;
  currency?: CurrencyCode;
  month: number;
  year: number;
  description: string;
  transactionAt: number;
  createdAt: number;
  updatedAt?: number;
}

export type TransactionType = 'income' | 'owner_expense' | 'office_expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency?: CurrencyCode;
  month: number;
  year: number;
  description: string;
  name?: string;
  createdAt: number;
  transactionAt?: number;
  updatedAt?: number;
  ownerId?: string;
  ownerName?: string;
  category?: OfficeExpenseCategory;
  companyShare?: number;
}

export interface FilterState {
  month: number | 'all';
  year: number;
  ownerId: string | 'all';
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  monthlyProfitLoss: number;
  companyShareTotal: number;
  ownerExpensesTotal: number;
  officeExpensesTotal: number;
}

export interface OwnerPayable {
  ownerId: string;
  ownerName: string;
  grossIncome: number;
  companyShareDue: number;
  ownerExpenses: number;
  netPayableToCompany: number;
  ownerRetained: number;
}

export interface SectionBalance {
  label: string;
  income: number;
  expenses: number;
  balance: number;
}

export interface MonthlyBalance {
  month: number;
  year: number;
  income: number;
  expenses: number;
  balance: number;
}

export type FixedExpenseCategory =
  | 'electricity'
  | 'salaries'
  | 'rent'
  | 'maintenance'
  | 'misc';

export interface FixedMonthlyExpenses {
  id: string;
  month: number;
  year: number;
  amounts: Record<FixedExpenseCategory, number>;
  currency?: CurrencyCode;
  salaryEntries?: MonthlySalaryEntry[];
  updatedAt?: number;
  updatedBy?: string;
}

export interface Employee {
  id: string;
  name: string;
  title?: string;
  email?: string;
  monthlySalary: number;
  currency?: CurrencyCode;
  active: boolean;
  userId?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface MonthlySalaryEntry {
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  leaveDays: number;
  leaveDeduction: number;
  bonus: number;
  otherDeductions: number;
  amount: number;
  paid: boolean;
  note?: string;
}

export interface EmployeePayslip {
  id: string;
  employeeId: string;
  employeeName: string;
  month: number;
  year: number;
  baseSalary: number;
  leaveDays: number;
  leaveDeduction: number;
  bonus: number;
  otherDeductions: number;
  netAmount: number;
  paid: boolean;
  currency?: CurrencyCode;
  note?: string;
  updatedAt?: number;
  emailSentAt?: number;
}

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  note?: string;
  markedAt: number;
  markedBy: string;
}

export type LeaveType = 'paid' | 'unpaid';

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  leaveType: LeaveType;
  reason?: string;
  status: LeaveRequestStatus;
  appliedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
  /** Optimistic client id — used until the server assigns a real id */
  clientId?: string;
  status?: 'pending' | 'sent' | 'failed';
}

export type ChatConversationType = 'direct' | 'group';

export interface ChatConversation {
  id: string;
  type: ChatConversationType;
  name: string | null;
  slug: string | null;
  createdBy: string;
  createdAt: number;
  memberIds: string[];
}

export type ChatNotificationType = 'message' | 'mention';

export interface ChatNotification {
  id: string;
  recipientFirebaseUid: string;
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  preview: string;
  type: ChatNotificationType;
  readAt: number | null;
  createdAt: number;
}
