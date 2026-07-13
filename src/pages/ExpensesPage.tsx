import { useState } from 'react';
import { FileDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOwnerExpenses } from '../hooks/useExpenses';
import { useUsers } from '../hooks/useUsers';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { FilterBar } from '../components/ui/FilterBar';
import { CurrencySelect } from '../components/ui/CurrencySelect';
import { AmountDisplay } from '../components/ui/AmountDisplay';
import { useFilter } from '../context/FilterContext';
import { useCurrency } from '../context/CurrencyContext';
import { filterOwnerExpenses } from '../lib/calculations';
import { MONTHS } from '../lib/constants';
import {
  deriveMonthYear,
  formatDateTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '../lib/datetime';
import { resolveUserName } from '../lib/users';
import { getYearOptions } from '../lib/utils';
import { buildOwnerExpensesPdf } from '../lib/expense-pdf-export';
import type { CurrencyCode, OwnerExpenseRecord } from '../types';

interface ExpenseFormData {
  ownerId: string;
  name: string;
  amount: string;
  currency: CurrencyCode;
  month: number;
  year: number;
  description: string;
  transactionAt: string;
}

const emptyForm = (ownerId = '', currency: CurrencyCode = 'USD'): ExpenseFormData => ({
  ownerId,
  name: '',
  amount: '',
  currency,
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  description: '',
  transactionAt: toDatetimeLocalValue(Date.now()),
});

export function ExpensesPage() {
  const { profile, isAdmin } = useAuth();
  const { filter } = useFilter();
  const { displayCurrency, rates } = useCurrency();
  const { expenses, addExpense, updateExpense, deleteExpense, loading } =
    useOwnerExpenses();
  const { users, projectOwners } = useUsers();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editing, setEditing] = useState<OwnerExpenseRecord | null>(null);
  const [deleting, setDeleting] = useState<OwnerExpenseRecord | null>(null);
  const [form, setForm] = useState<ExpenseFormData>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  const visibleExpenses = isAdmin
    ? filterOwnerExpenses(expenses, filter)
    : filterOwnerExpenses(
        expenses.filter((expense) => expense.ownerId === profile?.uid),
        filter,
      );

  const defaultOwnerId = isAdmin
    ? (projectOwners[0]?.uid ?? '')
    : (profile?.uid ?? '');

  const getOwnerNameForId = (ownerId: string) =>
    resolveUserName(ownerId, users);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(defaultOwnerId, displayCurrency));
    setModalOpen(true);
  };

  const openEdit = (record: OwnerExpenseRecord) => {
    setEditing(record);
    setForm({
      ownerId: record.ownerId,
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

  const handleOwnerChange = (ownerId: string) => {
    setForm((current) => ({
      ...current,
      ownerId,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;

    const ownerId = isAdmin ? form.ownerId : profile.uid;
    if (!ownerId) return;

    const ownerName = isAdmin
      ? getOwnerNameForId(ownerId)
      : profile.displayName;

    setSubmitting(true);
    try {
      const transactionAt = fromDatetimeLocalValue(form.transactionAt);
      const payload = {
        ownerId,
        ownerName,
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

  const canModify = (record: OwnerExpenseRecord) =>
    isAdmin || record.ownerId === profile?.uid;

  const formOwnerName = isAdmin
    ? getOwnerNameForId(form.ownerId)
    : (profile?.displayName ?? '');

  const handleExportPdf = () => {
    if (visibleExpenses.length === 0) {
      window.alert('No expense records to export for the selected period.');
      return;
    }
    buildOwnerExpensesPdf(
      visibleExpenses,
      users,
      filter,
      displayCurrency,
      rates,
    );
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page">
      <FilterBar />

      <Card>
        <CardHeader
          title="My Expense Records"
          subtitle="Track your personal project-related expenses"
          action={
            <div className="card-header-actions">
              <Button variant="secondary" onClick={handleExportPdf}>
                <FileDown size={18} />
                Export PDF
              </Button>
              <Button
                onClick={openCreate}
                disabled={isAdmin && projectOwners.length === 0}
              >
                <Plus size={18} />
                Add Expense
              </Button>
            </div>
          }
        />

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project Owner</th>
                <th>Expense Name</th>
                <th>Description</th>
                <th>Date & Time</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    No expense records found
                  </td>
                </tr>
              ) : (
                visibleExpenses.map((record) => (
                  <tr key={record.id}>
                    <td>
                      {resolveUserName(record.ownerId, users, record.ownerName)}
                    </td>
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
                    <td>
                      {canModify(record) && (
                        <div className="table-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => openEdit(record)}
                          >
                            <Pencil size={16} />
                          </button>
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
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Expense' : 'Add Expense'}
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
          {isAdmin ? (
            <Select
              label="Project Owner"
              options={projectOwners.map((owner) => ({
                value: owner.uid,
                label: owner.displayName,
              }))}
              value={form.ownerId}
              onChange={(event) => handleOwnerChange(event.target.value)}
              required
            />
          ) : null}
          <Input
            label="Project Owner Name"
            value={formOwnerName}
            readOnly
            disabled
          />
          <Input
            label="Expense Name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
            placeholder="e.g. Adobe Subscription"
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
            placeholder="Additional details about this expense"
          />
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense record?"
        loading={submitting}
      />
    </div>
  );
}
