import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Save, Square, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFilter } from '../../context/FilterContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useEmployees } from '../../hooks/useEmployees';
import { useUsers } from '../../hooks/useUsers';
import {
  getFixedExpenseId,
  useFixedExpenses,
} from '../../hooks/useFixedExpenses';
import { getEmployeeLabel } from '../../lib/employees';
import { emailPaidPayslips } from '../../lib/payslip-email';
import { resolvePayslipEmailTargets } from '../../lib/payslip-email-targets';
import {
  buildSalaryEntries,
  computeLeaveDeduction,
  computeNetSalary,
  countPaidSalaries,
  sumAllSalaries,
  sumPaidSalaries,
} from '../../lib/salaries';
import { MONTHS } from '../../lib/constants';
import { parseAmount } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { CurrencySelect } from '../ui/CurrencySelect';
import { DataErrorBanner } from '../ui/DataErrorBanner';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import type { CurrencyCode, MonthlySalaryEntry } from '../../types';

export function SalarySection() {
  const { profile, permissions } = useAuth();
  const { filter } = useFilter();
  const { formatNative, formatDisplay, convertToDisplay, displayCurrency } =
    useCurrency();
  const { activeEmployees, employees, loading: employeesLoading, error: employeesError, addEmployee } =
    useEmployees();
  const { users } = useUsers();
  const { records, loading: fixedLoading, saveSalaryEntries } = useFixedExpenses();

  const month = filter.month === 'all' ? new Date().getMonth() + 1 : filter.month;
  const year = filter.year;
  const periodLabel = `${MONTHS.find((item) => item.value === month)?.label} ${year}`;

  const fixedRecord = records.find(
    (record) => record.id === getFixedExpenseId(year, month),
  );

  const [entries, setEntries] = useState<MonthlySalaryEntry[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode>(displayCurrency);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    title: '',
    email: '',
    monthlySalary: '',
    currency: displayCurrency as CurrencyCode,
  });
  const [employeeError, setEmployeeError] = useState('');
  const [emailOnSave, setEmailOnSave] = useState(true);
  const [emailStatus, setEmailStatus] = useState('');

  useEffect(() => {
    setEntries(buildSalaryEntries(activeEmployees, fixedRecord?.salaryEntries, month, year));
    setCurrency(fixedRecord?.currency ?? displayCurrency);
    setSaved(false);
  }, [activeEmployees, fixedRecord, displayCurrency, month, year]);

  const paidTotal = useMemo(() => sumPaidSalaries(entries), [entries]);
  const payrollTotal = useMemo(() => sumAllSalaries(entries), [entries]);
  const paidCount = useMemo(() => countPaidSalaries(entries), [entries]);
  const paidTotalDisplay = convertToDisplay(paidTotal, currency);
  const payrollTotalDisplay = convertToDisplay(payrollTotal, currency);

  const togglePaid = (employeeId: string) => {
    if (!permissions.canUpdateFixedExpenses) return;
    setEntries((current) =>
      current.map((entry) =>
        entry.employeeId === employeeId
          ? { ...entry, paid: !entry.paid }
          : entry,
      ),
    );
    setSaved(false);
  };

  const updateAmount = (employeeId: string, value: string) => {
    if (!permissions.canUpdateFixedExpenses) return;
    const amount = value === '' ? 0 : parseFloat(value);
    setEntries((current) =>
      current.map((entry) =>
        entry.employeeId === employeeId
          ? {
              ...entry,
              baseSalary: Number.isFinite(amount) ? amount : 0,
              amount: computeNetSalary(
                {
                  ...entry,
                  baseSalary: Number.isFinite(amount) ? amount : 0,
                },
                month,
                year,
              ),
            }
          : entry,
      ),
    );
    setSaved(false);
  };

  const updateLeaveDays = (employeeId: string, value: string) => {
    if (!permissions.canUpdateFixedExpenses) return;
    const leaveDays = value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0);
    setEntries((current) =>
      current.map((entry) => {
        if (entry.employeeId !== employeeId) return entry;
        const leaveDeduction = computeLeaveDeduction(
          entry.baseSalary,
          leaveDays,
          month,
          year,
        );
        const next = { ...entry, leaveDays, leaveDeduction };
        return {
          ...next,
          amount: computeNetSalary(next, month, year),
        };
      }),
    );
    setSaved(false);
  };

  const updateBonus = (employeeId: string, value: string) => {
    if (!permissions.canUpdateFixedExpenses) return;
    const bonus = value === '' ? 0 : parseFloat(value);
    setEntries((current) =>
      current.map((entry) => {
        if (entry.employeeId !== employeeId) return entry;
        const next = {
          ...entry,
          bonus: Number.isFinite(bonus) ? bonus : 0,
        };
        return {
          ...next,
          amount: computeNetSalary(next, month, year),
        };
      }),
    );
    setSaved(false);
  };

  const updateOtherDeductions = (employeeId: string, value: string) => {
    if (!permissions.canUpdateFixedExpenses) return;
    const otherDeductions = value === '' ? 0 : parseFloat(value);
    setEntries((current) =>
      current.map((entry) => {
        if (entry.employeeId !== employeeId) return entry;
        const next = {
          ...entry,
          otherDeductions: Number.isFinite(otherDeductions) ? otherDeductions : 0,
        };
        return {
          ...next,
          amount: computeNetSalary(next, month, year),
        };
      }),
    );
    setSaved(false);
  };

  const updateNote = (employeeId: string, note: string) => {
    if (!permissions.canUpdateFixedExpenses) return;
    setEntries((current) =>
      current.map((entry) =>
        entry.employeeId === employeeId ? { ...entry, note } : entry,
      ),
    );
    setSaved(false);
  };

  const handleSave = async () => {
    if (!profile || !permissions.canUpdateFixedExpenses) return;

    setSubmitting(true);
    setEmailStatus('');
    try {
      const previousEntries = fixedRecord?.salaryEntries ?? [];
      await saveSalaryEntries(year, month, entries, profile.uid, currency);
      setSaved(true);

      if (emailOnSave) {
        const targets = await resolvePayslipEmailTargets(
          year,
          month,
          entries,
          previousEntries,
        );

        if (targets.size > 0) {
          const result = await emailPaidPayslips({
            entries,
            employees,
            users,
            year,
            month,
            currency,
            onlyEmployeeIds: targets,
          });

          const parts: string[] = [];
          if (result.sent.length > 0) {
            parts.push(`Emailed ${result.sent.length} payslip${result.sent.length === 1 ? '' : 's'}`);
          }
          if (result.skipped.length > 0) {
            parts.push(`${result.skipped.length} skipped (no email)`);
          }
          if (result.failed.length > 0) {
            parts.push(`${result.failed.length} failed`);
          }
          setEmailStatus(parts.join(' · '));
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmployeeError('');

    const amount = parseAmount(employeeForm.monthlySalary);
    if (!employeeForm.name.trim()) {
      setEmployeeError('Employee name is required.');
      return;
    }
    if (amount === null) {
      setEmployeeError('Enter a valid monthly salary.');
      return;
    }

    setSubmitting(true);
    try {
      await addEmployee({
        name: employeeForm.name,
        title: employeeForm.title,
        email: employeeForm.email,
        monthlySalary: amount,
        currency: employeeForm.currency,
      });
      setEmployeeForm({
        name: '',
        title: '',
        email: '',
        monthlySalary: '',
        currency: displayCurrency,
      });
      setEmployeeModalOpen(false);
    } catch {
      setEmployeeError('Could not add employee. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (employeesLoading || fixedLoading) {
    return (
      <Card className="salary-section-card">
        <div className="office-panel-loading">
          <div className="spinner" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="salary-section-card">
        <CardHeader
          title="Employee Salaries"
          subtitle={`${periodLabel} · check employees when paid`}
          action={
            <div className="card-header-actions">
              {permissions.canManageEmployees && (
                <Button variant="secondary" onClick={() => setEmployeeModalOpen(true)}>
                  <UserPlus size={16} />
                  Add Employee
                </Button>
              )}
              {permissions.canUpdateFixedExpenses && (
                <Button onClick={handleSave} disabled={submitting}>
                  <Save size={16} />
                  {submitting ? 'Saving...' : 'Save Salaries'}
                </Button>
              )}
            </div>
          }
        />

        {employeesError && <DataErrorBanner message={employeesError} />}

        <p className="salary-section-hint">
          Set base salary, leave days, bonuses, and deductions. Net amount is calculated
          automatically and only checked (paid) salaries count toward payroll totals.
        </p>

        <div className="salary-section-toolbar">
          <div className="salary-section-summary-pill">
            Paid: {paidCount}/{entries.length}
          </div>
          <div className="salary-section-summary-pill">
            Paid total: {formatNative(paidTotal, currency)}
            {currency !== displayCurrency && (
              <span> ≈ {formatDisplay(paidTotalDisplay)}</span>
            )}
          </div>
          <div className="salary-section-summary-pill">
            Payroll: {formatNative(payrollTotal, currency)}
            {currency !== displayCurrency && (
              <span> ≈ {formatDisplay(payrollTotalDisplay)}</span>
            )}
          </div>
          {permissions.canUpdateFixedExpenses && (
            <CurrencySelect
              label="Salary currency"
              value={currency}
              onChange={setCurrency}
            />
          )}
          {permissions.canUpdateFixedExpenses && (
            <label className="salary-email-toggle">
              <input
                type="checkbox"
                checked={emailOnSave}
                onChange={(event) => setEmailOnSave(event.target.checked)}
              />
              <span>Email paid invoices to employees</span>
            </label>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="salary-section-empty">
            <Users size={32} strokeWidth={1.5} />
            <p>No active employees on the payroll roster.</p>
            {permissions.canManageEmployees ? (
              <Button variant="secondary" onClick={() => setEmployeeModalOpen(true)}>
                Add first employee
              </Button>
            ) : (
              <p>Ask an administrator to add employees.</p>
            )}
          </div>
        ) : (
          <div className="salary-checklist">
            {entries.map((entry) => {
              const employee = activeEmployees.find(
                (item) => item.id === entry.employeeId,
              );
              const label = employee
                ? getEmployeeLabel(employee)
                : entry.employeeName;

              return (
                <div
                  key={entry.employeeId}
                  className={`salary-checklist-row ${entry.paid ? 'salary-checklist-row-paid' : ''}`}
                >
                  <button
                    type="button"
                    className="salary-check-btn"
                    onClick={() => togglePaid(entry.employeeId)}
                    disabled={!permissions.canUpdateFixedExpenses}
                    aria-label={`Mark ${entry.employeeName} as ${entry.paid ? 'unpaid' : 'paid'}`}
                    aria-pressed={entry.paid}
                  >
                    {entry.paid ? (
                      <CheckSquare size={22} className="salary-check-icon paid" />
                    ) : (
                      <Square size={22} className="salary-check-icon" />
                    )}
                  </button>

                  <div className="salary-checklist-main">
                    <p className="salary-checklist-name">{label}</p>
                    {permissions.canUpdateFixedExpenses ? (
                      <Input
                        label="Note"
                        value={entry.note ?? ''}
                        onChange={(event) =>
                          updateNote(entry.employeeId, event.target.value)
                        }
                        placeholder="Optional payment note"
                      />
                    ) : (
                      entry.note && (
                        <p className="salary-checklist-note">{entry.note}</p>
                      )
                    )}
                  </div>

                  <div className="salary-checklist-breakdown">
                    {permissions.canUpdateFixedExpenses ? (
                      <>
                        <Input
                          label="Base salary"
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.baseSalary || ''}
                          onChange={(event) =>
                            updateAmount(entry.employeeId, event.target.value)
                          }
                        />
                        <Input
                          label="Leave days"
                          type="number"
                          min="0"
                          step="1"
                          value={entry.leaveDays || ''}
                          onChange={(event) =>
                            updateLeaveDays(entry.employeeId, event.target.value)
                          }
                        />
                        <Input
                          label="Bonus"
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.bonus || ''}
                          onChange={(event) =>
                            updateBonus(entry.employeeId, event.target.value)
                          }
                        />
                        <Input
                          label="Other deductions"
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.otherDeductions || ''}
                          onChange={(event) =>
                            updateOtherDeductions(entry.employeeId, event.target.value)
                          }
                        />
                      </>
                    ) : (
                      <div className="salary-readonly-grid">
                        <span>Base: {formatNative(entry.baseSalary, currency)}</span>
                        <span>Leave: {entry.leaveDays}d (−{formatNative(entry.leaveDeduction, currency)})</span>
                        <span>Bonus: {formatNative(entry.bonus, currency)}</span>
                        <span>Deductions: {formatNative(entry.otherDeductions, currency)}</span>
                      </div>
                    )}
                  </div>

                  <div className="salary-checklist-amount">
                    {permissions.canUpdateFixedExpenses ? (
                      <div className="salary-net-preview">
                        <span className="salary-amount-label">Net payable</span>
                        <strong>{formatNative(entry.amount, currency)}</strong>
                      </div>
                    ) : (
                      <>
                        <span className="salary-amount-label">Net payable</span>
                        <strong>{formatNative(entry.amount, currency)}</strong>
                      </>
                    )}
                  </div>

                  <div className="salary-checklist-status">
                    <span
                      className={`salary-status-badge ${entry.paid ? 'salary-status-paid' : 'salary-status-unpaid'}`}
                    >
                      {entry.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {saved && (
          <p className="fixed-expenses-saved">Salary checklist saved for {periodLabel}</p>
        )}
        {emailStatus && <p className="salary-email-status">{emailStatus}</p>}
      </Card>

      <Modal
        isOpen={employeeModalOpen}
        onClose={() => setEmployeeModalOpen(false)}
        title="Add Employee"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEmployeeModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEmployee} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Employee'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddEmployee} className="form-grid">
          {employeeError && <p className="form-error">{employeeError}</p>}
          <Input
            label="Full name"
            value={employeeForm.name}
            onChange={(event) =>
              setEmployeeForm({ ...employeeForm, name: event.target.value })
            }
            required
            placeholder="e.g. Sara Ahmed"
          />
          <Input
            label="Role / title"
            value={employeeForm.title}
            onChange={(event) =>
              setEmployeeForm({ ...employeeForm, title: event.target.value })
            }
            placeholder="e.g. Developer"
          />
          <Input
            label="Email"
            type="email"
            value={employeeForm.email}
            onChange={(event) =>
              setEmployeeForm({ ...employeeForm, email: event.target.value })
            }
            placeholder="payslip@company.com"
          />
          <CurrencySelect
            value={employeeForm.currency}
            onChange={(value) =>
              setEmployeeForm({ ...employeeForm, currency: value })
            }
          />
          <Input
            label="Monthly salary"
            type="number"
            min="0"
            step="0.01"
            value={employeeForm.monthlySalary}
            onChange={(event) =>
              setEmployeeForm({
                ...employeeForm,
                monthlySalary: event.target.value,
              })
            }
            required
            placeholder="0.00"
          />
        </form>
      </Modal>
    </>
  );
}
