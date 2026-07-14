import { useState } from 'react';
import { FileDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FixedExpensesSection } from '../components/expenses/FixedExpensesSection';
import { SalarySection } from '../components/expenses/SalarySection';
import { OfficeSpendSummary } from '../components/expenses/OfficeSpendSummary';
import { useOfficeExpenses } from '../hooks/useExpenses';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { FilterBar, getCategoryLabel } from '../components/ui/FilterBar';
import { CurrencySelect } from '../components/ui/CurrencySelect';
import { AmountDisplay } from '../components/ui/AmountDisplay';
import { useFilter } from '../context/FilterContext';
import { useCurrency } from '../context/CurrencyContext';
import { filterOfficeExpenses } from '../lib/calculations';
import { MONTHS, OFFICE_EXPENSE_CATEGORIES } from '../lib/constants';
import {
  deriveMonthYear,
  formatDateTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '../lib/datetime';
import { getYearOptions } from '../lib/utils';
import { buildOfficeExpensesPdf } from '../lib/expense-pdf-export';
import { FIXED_EXPENSE_AMOUNT_CATEGORIES } from '../lib/constants';
import {
  getFixedExpenseId,
  useFixedExpenses,
} from '../hooks/useFixedExpenses';
import type { CurrencyCode, OfficeExpenseCategory, OfficeExpenseRecord } from '../types';

interface ExpenseFormData {
  category: OfficeExpenseCategory;
  name: string;
  amount: string;
  currency: CurrencyCode;
  month: number;
  year: number;
  description: string;
  transactionAt: string;
}

const emptyForm = (currency: CurrencyCode = 'USD'): ExpenseFormData => ({
  category: 'salaries',
  name: '',
  amount: '',
  currency,
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  description: '',
  transactionAt: toDatetimeLocalValue(Date.now()),
});

export function OfficeExpensesPage() {
  const { permissions } = useAuth();
  const { filter } = useFilter();
  const { displayCurrency, rates } = useCurrency();
  const { expenses, addExpense, updateExpense, deleteExpense, loading } =
    useOfficeExpenses();
  const { records: fixedRecords } = useFixedExpenses();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeExpenseRecord | null>(null);
  const [deleting, setDeleting] = useState<OfficeExpenseRecord | null>(null);
  const [form, setForm] = useState<ExpenseFormData>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  const visibleExpenses = filterOfficeExpenses(expenses, filter);

  const monthForFixed =
    filter.month === 'all' ? new Date().getMonth() + 1 : filter.month;
  const fixedRecord =
    fixedRecords.find(
      (record) => record.id === getFixedExpenseId(filter.year, monthForFixed),
    ) ?? null;

  const handleExportPdf = () => {
    const hasFixedAmounts =
      fixedRecord &&
      FIXED_EXPENSE_AMOUNT_CATEGORIES.some(
        (category) => (fixedRecord.amounts[category.value] ?? 0) > 0,
      );
    const hasSalaries =
      fixedRecord && (fixedRecord.salaryEntries?.length ?? 0) > 0;
    if (!hasFixedAmounts && !hasSalaries && visibleExpenses.length === 0) {
      window.alert('No office expenses to export for the selected period.');
      return;
    }
    buildOfficeExpensesPdf(
      fixedRecord,
      visibleExpenses,
      filter,
      displayCurrency,
      rates,
    );
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(displayCurrency));
    setModalOpen(true);
  };

  const openEdit = (record: OfficeExpenseRecord) => {
    setEditing(record);
    setForm({
      category: record.category,
      name: record.name ?? record.description,
      amount: String(record.amount),
      currency: record.currency ?? 'USD',
      month: record.month,
      year: record.year,
      description: record.description,
      transactionAt: toDatetimeLocalValue(record.transactionAt ?? record.createdAt),
    });
    setModalOpen(true);
  };

  const handleTransactionAtChange = (transactionAt: string) => {
    const { month, year } = deriveMonthYear(fromDatetimeLocalValue(transactionAt));
    setForm((current) => ({ ...current, transactionAt, month, year }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const transactionAt = fromDatetimeLocalValue(form.transactionAt);
      const payload = {
        category: form.category,
        name: form.name,
        amount: parseFloat(form.amount),
        currency: form.currency,
        month: form.month,
        year: form.year,
        description: form.description,
        transactionAt,
      };

      if (editing) {
        await updateExpense(editing.id, payload);
      } else {
        await addExpense(payload);
      }
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    try {
      await deleteExpense(deleting.id);
      setDeleteModalOpen(false);
      setDeleting(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page office-page">
      <FilterBar showOwnerFilter={false} />

      <OfficeSpendSummary
        fixedRecords={fixedRecords}
        additionalExpenses={expenses}
      />

      <div className="office-sections">
        {permissions.canViewEmployees && (
          <section className="office-section office-section-salaries">
            <SalarySection />
          </section>
        )}

        <section className="office-section office-section-fixed">
          <FixedExpensesSection />
        </section>

        <section className="office-section office-section-additional">
      <Card className="office-additional-card">
        <CardHeader
          title="Additional Office Expenses"
          subtitle={
            permissions.canCreateOfficeExpenses && !permissions.canDeleteOfficeExpenses
              ? 'Add and update office expense records for any period'
              : 'Manage company-wide operational expenses'
          }
          action={
            <div className="card-header-actions">
              <Button variant="secondary" onClick={handleExportPdf}>
                <FileDown size={18} />
                Export PDF
              </Button>
              {permissions.canCreateOfficeExpenses ? (
                <Button onClick={openCreate}>
                  <Plus size={18} />
                  Add Office Expense
                </Button>
              ) : null}
            </div>
          }
        />

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Expense Name</th>
                <th>Description</th>
                <th>Date & Time</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Last Updated</th>
                {(permissions.canEditOfficeExpenses ||
                  permissions.canDeleteOfficeExpenses) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleExpenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      permissions.canEditOfficeExpenses ||
                      permissions.canDeleteOfficeExpenses
                        ? 9
                        : 8
                    }
                    className="empty-cell"
                  >
                    No additional office expense records found
                  </td>
                </tr>
              ) : (
                visibleExpenses.map((record) => (
                  <tr key={record.id}>
                    <td>{getCategoryLabel(record.category)}</td>
                    <td>{record.name ?? record.description}</td>
                    <td>{record.description}</td>
                    <td>
                      {formatDateTime(record.transactionAt ?? record.createdAt)}
                    </td>
                    <td>
                      {MONTHS.find((month) => month.value === record.month)?.label}{' '}
                      {record.year}
                    </td>
                    <td className="text-danger">
                      <AmountDisplay amount={record.amount} currency={record.currency} />
                    </td>
                    <td>{record.currency ?? 'USD'}</td>
                    <td>
                      {record.updatedAt ? formatDateTime(record.updatedAt) : '—'}
                    </td>
                    {(permissions.canEditOfficeExpenses ||
                      permissions.canDeleteOfficeExpenses) && (
                      <td>
                        <div className="table-actions">
                          {permissions.canEditOfficeExpenses && (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => openEdit(record)}
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {permissions.canDeleteOfficeExpenses && (
                            <button
                              type="button"
                              className="icon-btn danger"
                              onClick={() => {
                                setDeleting(record);
                                setDeleteModalOpen(true);
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
        </section>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Office Expense' : 'Add Office Expense'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : editing ? 'Update' : 'Add Expense'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="form-grid">
          <Select
            label="Category"
            options={OFFICE_EXPENSE_CATEGORIES.map((category) => ({
              value: category.value,
              label: category.label,
            }))}
            value={form.category}
            onChange={(event) =>
              setForm({
                ...form,
                category: event.target.value as OfficeExpenseCategory,
              })
            }
          />
          <Input
            label="Expense Name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
            placeholder="e.g. January salaries"
          />
          <Input
            label="Date & Time"
            type="datetime-local"
            value={form.transactionAt}
            onChange={(event) => handleTransactionAtChange(event.target.value)}
            required
          />
          <CurrencySelect
            value={form.currency}
            onChange={(currency) => setForm({ ...form, currency })}
          />
          <Input
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            required
          />
          <Select
            label="Month"
            options={MONTHS.map((month) => ({
              value: month.value,
              label: month.label,
            }))}
            value={form.month}
            onChange={(event) =>
              setForm({ ...form, month: Number(event.target.value) })
            }
          />
          <Select
            label="Year"
            options={getYearOptions().map((year) => ({
              value: year,
              label: String(year),
            }))}
            value={form.year}
            onChange={(event) =>
              setForm({ ...form, year: Number(event.target.value) })
            }
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
            required
            placeholder="Additional details"
          />
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Office Expense"
        message="Are you sure you want to delete this office expense?"
        loading={submitting}
      />
    </div>
  );
}
