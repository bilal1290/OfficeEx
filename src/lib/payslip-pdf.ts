import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MONTHS } from './constants';
import { formatCurrencyAmount } from './currency';
import type { CurrencyCode, EmployeePayslip } from '../types';

const BRAND_RGB: [number, number, number] = [27, 94, 75];

function periodLabel(payslip: EmployeePayslip): string {
  const monthName = MONTHS.find((item) => item.value === payslip.month)?.label ?? 'Month';
  return `${monthName} ${payslip.year}`;
}

export function buildPayslipPdfBase64(
  payslip: EmployeePayslip,
  currency: CurrencyCode = payslip.currency ?? 'PKR',
): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const label = periodLabel(payslip);

  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('OfficeEx', 14, 12);
  doc.setFontSize(11);
  doc.text('Salary Invoice', 14, 20);
  doc.setFontSize(9);
  doc.text(label, pageWidth - 14, 12, { align: 'right' });
  doc.text(payslip.paid ? 'PAID' : 'PENDING', pageWidth - 14, 20, { align: 'right' });

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.text(payslip.employeeName, 14, 42);
  doc.setFontSize(10);
  doc.text(`Pay period: ${label}`, 14, 49);
  doc.text(`Currency: ${currency}`, 14, 55);

  autoTable(doc, {
    startY: 62,
    head: [['Description', 'Amount']],
    body: [
      ['Base salary', formatCurrencyAmount(payslip.baseSalary, currency)],
      ['Leave days', String(payslip.leaveDays)],
      ['Leave deduction', formatCurrencyAmount(-payslip.leaveDeduction, currency)],
      ['Bonus', formatCurrencyAmount(payslip.bonus, currency)],
      ['Other deductions', formatCurrencyAmount(-payslip.otherDeductions, currency)],
      ['Net payable', formatCurrencyAmount(payslip.netAmount, currency)],
    ],
    theme: 'grid',
    headStyles: { fillColor: BRAND_RGB },
    styles: { fontSize: 10 },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;

  if (payslip.note?.trim()) {
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`Note: ${payslip.note.trim()}`, 14, finalY + 10);
  }

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('This is a system-generated salary invoice from OfficeEx.', 14, 285);

  return doc.output('datauristring').split(',')[1];
}

export function payslipPdfFilename(payslip: EmployeePayslip): string {
  const monthName = MONTHS.find((item) => item.value === payslip.month)?.label ?? 'Month';
  const safeName = payslip.employeeName.replace(/[^\w.-]+/g, '_');
  return `OfficeEx-Payslip-${safeName}-${monthName}-${payslip.year}.pdf`;
}
