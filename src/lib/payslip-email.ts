import { getFunctions, httpsCallable } from 'firebase/functions';
import { MONTHS } from './constants';
import { resolveEmployeeEmail } from './employees';
import { app } from './firebase';
import { buildPayslipPdfBase64, payslipPdfFilename } from './payslip-pdf';
import { buildPayslipFromEntry } from './salaries';
import { markPayslipEmailSent } from './payslips';
import type { CurrencyCode, Employee, EmployeePayslip, MonthlySalaryEntry, UserProfile } from '../types';

export interface PayslipEmailResult {
  sent: string[];
  skipped: Array<{ employeeName: string; reason: string }>;
  failed: Array<{ employeeName: string; reason: string }>;
}

interface SendPayslipEmailRequest {
  to: string;
  employeeName: string;
  periodLabel: string;
  pdfBase64: string;
  fileName: string;
}

interface SendPayslipEmailResponse {
  success: boolean;
}

function periodLabel(month: number, year: number): string {
  const monthName = MONTHS.find((item) => item.value === month)?.label ?? 'Month';
  return `${monthName} ${year}`;
}

async function callSendPayslipEmail(payload: SendPayslipEmailRequest): Promise<void> {
  if (!app) {
    throw new Error('Firebase is not configured.');
  }

  const functions = getFunctions(app);
  const sendPayslipEmail = httpsCallable<SendPayslipEmailRequest, SendPayslipEmailResponse>(
    functions,
    'sendPayslipEmail',
  );

  const response = await sendPayslipEmail(payload);
  if (!response.data.success) {
    throw new Error('Email service did not confirm delivery.');
  }
}

export async function emailPaidPayslips({
  entries,
  employees,
  users,
  year,
  month,
  currency,
  onlyEmployeeIds,
}: {
  entries: MonthlySalaryEntry[];
  employees: Employee[];
  users: UserProfile[];
  year: number;
  month: number;
  currency?: CurrencyCode;
  onlyEmployeeIds?: Set<string>;
}): Promise<PayslipEmailResult> {
  const result: PayslipEmailResult = { sent: [], skipped: [], failed: [] };
  const label = periodLabel(month, year);

  const paidEntries = entries.filter((entry) => {
    if (!entry.paid) return false;
    if (onlyEmployeeIds && !onlyEmployeeIds.has(entry.employeeId)) return false;
    return true;
  });

  for (const entry of paidEntries) {
    const employee = employees.find((item) => item.id === entry.employeeId);
    if (!employee) {
      result.skipped.push({
        employeeName: entry.employeeName,
        reason: 'Employee record not found',
      });
      continue;
    }

    const email = resolveEmployeeEmail(employee, users);
    if (!email) {
      result.skipped.push({
        employeeName: entry.employeeName,
        reason: 'No email on employee or linked account',
      });
      continue;
    }

    const payslip: EmployeePayslip = buildPayslipFromEntry(entry, month, year, currency);

    try {
      const pdfBase64 = buildPayslipPdfBase64(payslip, currency);
      await callSendPayslipEmail({
        to: email,
        employeeName: entry.employeeName,
        periodLabel: label,
        pdfBase64,
        fileName: payslipPdfFilename(payslip),
      });
      await markPayslipEmailSent(entry.employeeId, year, month);
      result.sent.push(entry.employeeName);
    } catch (error) {
      result.failed.push({
        employeeName: entry.employeeName,
        reason:
          error instanceof Error
            ? error.message
            : 'Could not send payslip email',
      });
    }
  }

  return result;
}
