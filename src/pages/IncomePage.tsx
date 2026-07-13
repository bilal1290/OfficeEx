import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIncomes } from '../hooks/useIncomes';
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
import { filterIncomes, computeOwnerPayables } from '../lib/calculations';
import { MONTHS, COMPANY_SHARE_RATE } from '../lib/constants';
import {
  deriveMonthYear,
  formatDateTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '../lib/datetime';
import { resolveUserName } from '../lib/users';
import {
  calculateCompanyShare,
  getYearOptions,
} from '../lib/utils';
import type { CurrencyCode, IncomeRecord } from '../types';

interface IncomeFormData {
  ownerId: string;
  amount: string;
  currency: CurrencyCode;
  month: number;
  year: number;
  description: string;
  transactionAt: string;
}

const emptyForm = (ownerId = '', currency: CurrencyCode = 'USD'): IncomeFormData => ({
  ownerId,
  amount: '',
  currency,
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  description: '',
  transactionAt: toDatetimeLocalValue(Date.now()),
});

export function IncomePage() {
  const { profile, isAdmin } = useAuth();
  const { filter } = useFilter();
  const { displayCurrency, rates, formatDisplay, formatNative } = useCurrency();
  const conversion = { displayCurrency, rates };
  const { incomes, addIncome, updateIncome, deleteIncome, loading } = useIncomes();
  const { expenses: ownerExpenses } = useOwnerExpenses();
  const { users, projectOwners } = useUsers();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeRecord | null>(null);
  const [deleting, setDeleting] = useState<IncomeRecord | null>(null);
  const [form, setForm] = useState<IncomeFormData>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  const visibleIncomes = isAdmin
    ? filterIncomes(incomes, filter)
    : filterIncomes(
        incomes.filter((income) => income.ownerId === profile?.uid),
        filter,
      );

  const defaultOwnerId = isAdmin
    ? (projectOwners[0]?.uid ?? '')
    : (profile?.uid ?? '');

  const getOwnerName = (ownerId: string, storedName?: string) =>
    resolveUserName(ownerId, users, storedName);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(defaultOwnerId, displayCurrency));
    setModalOpen(true);
  };

  const openEdit = (record: IncomeRecord) => {
    setEditing(record);
    setForm({
      ownerId: record.ownerId,
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
    if (!profile) return;

    const ownerId = isAdmin ? form.ownerId : profile.uid;
    if (!ownerId) return;

    const ownerName = getOwnerName(
      ownerId,
      isAdmin ? undefined : profile.displayName,
    );

    setSubmitting(true);
    try {
      const transactionAt = fromDatetimeLocalValue(form.transactionAt);
      const payload = {
        ownerId,
        ownerName,
        amount: parseFloat(form.amount),
        currency: form.currency,
        month: form.month,
        year: form.year,
        description: form.description,
        transactionAt,
      };

      if (editing) {
        await updateIncome(editing.id, payload);
      } else {
        await addIncome(payload);
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
      await deleteIncome(deleting.id);
      setDeleteModalOpen(false);
      setDeleting(null);
    } finally {
      setSubmitting(false);
    }
  };

  const canModify = (record: IncomeRecord) =>
    isAdmin || record.ownerId === profile?.uid;

  const previewShare = form.amount
    ? calculateCompanyShare(parseFloat(form.amount))
    : 0;

  const selectedOwnerName = form.ownerId
    ? getOwnerName(form.ownerId)
    : '';

  const myPayable = !isAdmin && profile
    ? computeOwnerPayables(incomes, ownerExpenses, users, {
        ...filter,
        ownerId: profile.uid,
      }, conversion)[0]
    : null;

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

      {myPayable && (
        <div className="payable-banner">
          <div className="payable-banner-main">
            <p className="payable-banner-label">Your net payable to company</p>
            <p
              className={`payable-banner-amount ${
                myPayable.netPayableToCompany > 0 ? 'due' : 'credit'
              }`}
            >
              {formatDisplay(myPayable.netPayableToCompany)}
            </p>
          </div>
          <div className="payable-banner-breakdown">
            <span>
              Gross income: <strong>{formatDisplay(myPayable.grossIncome)}</strong>
            </span>
            <span>
              Company share ({COMPANY_SHARE_RATE * 100}%):{' '}
              <strong>{formatDisplay(myPayable.companyShareDue)}</strong>
            </span>
            <span>
              Your expenses: <strong>{formatDisplay(myPayable.ownerExpenses)}</strong>
            </span>
          </div>
          <p className="payable-banner-formula">
            Net = {COMPANY_SHARE_RATE * 100}% share − your expenses · shown in {displayCurrency}
          </p>
        </div>
      )}

      <Card>
        <CardHeader
          title="Project Income Records"
          subtitle={`Company receives ${COMPANY_SHARE_RATE * 100}% automatically`}
          action={
            <Button onClick={openCreate} disabled={isAdmin && projectOwners.length === 0}>
              <Plus size={18} />
              Add Income
            </Button>
          }
        />

        {isAdmin && projectOwners.length === 0 && (
          <p className="form-hint table-hint">
            Add project owners from the Users page before assigning income.
          </p>
        )}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project Owner</th>
                <th>Description</th>
                <th>Date & Time</th>
                <th>Period</th>
                <th>Project Income</th>
                <th>Currency</th>
                <th>Company Share</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleIncomes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    No income records found
                  </td>
                </tr>
              ) : (
                visibleIncomes.map((record) => (
                  <tr key={record.id}>
                    <td>
                      {resolveUserName(record.ownerId, users, record.ownerName)}
                    </td>
                    <td>{record.description}</td>
                    <td>
                      {formatDateTime(record.transactionAt ?? record.createdAt)}
                    </td>
                    <td>
                      {MONTHS.find((month) => month.value === record.month)?.label}{' '}
                      {record.year}
                    </td>
                    <td>
                      <AmountDisplay amount={record.amount} currency={record.currency} />
                    </td>
                    <td>{record.currency ?? 'USD'}</td>
                    <td className="text-success">
                      {formatNative(record.companyShare, record.currency)}
                    </td>
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
        title={editing ? 'Edit Income' : 'Add Project Income'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : editing ? 'Update' : 'Add Income'}
            </Button>
          </>
        }
      >
        <form id="income-form" onSubmit={handleSubmit} className="form-grid">
          {isAdmin ? (
            <Select
              label="Project Owner"
              options={projectOwners.map((owner) => ({
                value: owner.uid,
                label: owner.displayName,
              }))}
              value={form.ownerId}
              onChange={(event) =>
                setForm({ ...form, ownerId: event.target.value })
              }
              required
            />
          ) : (
            <Input
              label="Project Owner"
              value={profile?.displayName ?? ''}
              readOnly
              disabled
            />
          )}
          {isAdmin && selectedOwnerName && (
            <p className="form-hint">Selected owner: {selectedOwnerName}</p>
          )}
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
            placeholder="e.g. Client project payment"
          />
          {form.amount && (
            <p className="form-hint">
              Company share ({COMPANY_SHARE_RATE * 100}%):{' '}
              <strong>
                {formatNative(
                  previewShare,
                  form.currency,
                )}
              </strong>
            </p>
          )}
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Income"
        message="Are you sure you want to delete this income record? This action cannot be undone."
        loading={submitting}
      />
    </div>
  );
}
