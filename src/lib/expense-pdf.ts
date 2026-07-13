import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExpensePdfLine {
  date: string;
  type: string;
  name: string;
  detail: string;
  amount: string;
  currency: string;
}

export interface ExpensePdfSection {
  title: string;
  lines: ExpensePdfLine[];
  subtotal?: string;
}

export interface ExpensePdfOptions {
  reportTitle: string;
  periodLabel: string;
  generatedAt: string;
  displayCurrency: string;
  sections: ExpensePdfSection[];
  grandTotal: string;
  filename: string;
}

const BRAND_RGB: [number, number, number] = [27, 94, 75];

export function downloadExpensesPdf({
  reportTitle,
  periodLabel,
  generatedAt,
  displayCurrency,
  sections,
  grandTotal,
  filename,
}: ExpensePdfOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('OfficeEx', 14, 12);
  doc.setFontSize(11);
  doc.text(reportTitle, 14, 20);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.text(`Period: ${periodLabel}`, 14, 36);
  doc.text(`Generated: ${generatedAt}`, 14, 42);
  doc.text(`Totals shown in: ${displayCurrency}`, 14, 48);

  let cursorY = 54;

  for (const section of sections) {
    if (section.lines.length === 0) continue;

    if (cursorY > 250) {
      doc.addPage();
      cursorY = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(...BRAND_RGB);
    doc.text(section.title, 14, cursorY);
    cursorY += 4;

    autoTable(doc, {
      startY: cursorY,
      head: [['Date', 'Type', 'Name', 'Details', 'Amount', 'Cur']],
      body: section.lines.map((line) => [
        line.date,
        line.type,
        line.name,
        line.detail,
        line.amount,
        line.currency,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: BRAND_RGB,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [242, 246, 244] },
      margin: { left: 14, right: 14 },
    });

    cursorY =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    if (section.subtotal) {
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(`${section.title} subtotal: ${section.subtotal}`, 14, cursorY);
      cursorY += 10;
    }
  }

  if (cursorY > 265) {
    doc.addPage();
    cursorY = 20;
  }

  doc.setDrawColor(...BRAND_RGB);
  doc.setLineWidth(0.4);
  doc.line(14, cursorY, pageWidth - 14, cursorY);
  cursorY += 8;

  doc.setFontSize(12);
  doc.setTextColor(...BRAND_RGB);
  doc.text(`Grand Total (${displayCurrency}): ${grandTotal}`, 14, cursorY);

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Amounts converted to display currency using configured exchange rates.',
    14,
    doc.internal.pageSize.getHeight() - 10,
  );

  doc.save(filename);
}
