import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, KeyRound, Pencil, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEmployees } from '../../hooks/useEmployees';
import { AttendancePanel } from '../employee/AttendancePanel';
import { getEmployeeLabel } from '../../lib/employees';
import { allotEmployeeCredentials } from '../../lib/auth-api';
import { parseAmount } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { DataErrorBanner } from '../ui/DataErrorBanner';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { CurrencySelect } from '../ui/CurrencySelect';
import { useCurrency } from '../../context/CurrencyContext';
import type { CurrencyCode, Employee } from '../../types';

export function EmployeeManagementPanel() {
  const { permissions } = useAuth();
  const { displayCurrency } = useCurrency();
  const { employees, loading, error, addEmployee, updateEmployee } = useEmployees();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState({
    name: '',
    title: '',
    email: '',
    monthlySalary: '',
    currency: displayCurrency as CurrencyCode,
    active: true,
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [credentialEmployee, setCredentialEmployee] = useState<Employee | null>(null);
  const [credentialForm, setCredentialForm] = useState({
    email: '',
    password: '',
    displayName: '',
  });
  const [credentialError, setCredentialError] = useState('');
  const [credentialSuccess, setCredentialSuccess] = useState('');
  const [credentialSubmitting, setCredentialSubmitting] = useState(false);

  const sortedEmployees = useMemo(
    () =>
      [...employees].sort((left, right) => {
        if (left.active !== right.active) return left.active ? -1 : 1;
        return left.name.localeCompare(right.name);
      }),
    [employees],
  );

  const resetForm = () => {
    setForm({
      name: '',
      title: '',
      email: '',
      monthlySalary: '',
      currency: displayCurrency,
      active: true,
    });
    setFormError('');
    setEditingEmployee(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setForm({
      name: employee.name,
      title: employee.title ?? '',
      email: employee.email ?? '',
      monthlySalary: String(employee.monthlySalary),
      currency: employee.currency ?? displayCurrency,
      active: employee.active,
    });
    setFormError('');
    setModalOpen(true);
  };

  const openAllotCredentials = (employee: Employee) => {
    setCredentialEmployee(employee);
    setCredentialForm({
      email: employee.email ?? '',
      password: '',
      displayName: employee.name,
    });
    setCredentialError('');
    setCredentialSuccess('');
    setCredentialsModalOpen(true);
  };

  const handleAllotCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!credentialEmployee) return;

    setCredentialSubmitting(true);
    setCredentialError('');
    setCredentialSuccess('');

    try {
      await allotEmployeeCredentials(
        credentialEmployee.id,
        credentialForm.email,
        credentialForm.password,
        credentialForm.displayName,
      );
      setCredentialSuccess(
        `Login created for ${credentialForm.email}. Share the email and temporary password with the employee.`,
      );
      setCredentialForm((current) => ({ ...current, password: '' }));
    } catch (err) {
      setCredentialError(
        err instanceof Error ? err.message : 'Could not allot employee credentials.',
      );
    } finally {
      setCredentialSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!permissions.canManageEmployees) return;

    const amount = parseAmount(form.monthlySalary);
    if (!form.name.trim()) {
      setFormError('Employee name is required.');
      return;
    }
    if (amount === null) {
      setFormError('Enter a valid monthly salary.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, {
          name: form.name,
          title: form.title,
          email: form.email,
          monthlySalary: amount,
          currency: form.currency,
          active: form.active,
        });
      } else {
        await addEmployee({
          name: form.name,
          title: form.title,
          email: form.email,
          monthlySalary: amount,
          currency: form.currency,
        });
      }
      setModalOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save employee.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!permissions.canManageEmployees && !permissions.canViewEmployees) {
    return null;
  }

  if (loading) {
    return (
      <Card className="employee-mgmt-card">
        <div className="office-panel-loading">
          <div className="spinner" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="employee-mgmt-card">
        <CardHeader
          title="Employee management"
          subtitle="Payroll roster, details, and attendance — admin controlled"
          action={
            permissions.canManageEmployees ? (
              <Button onClick={openCreate}>
                <UserPlus size={16} />
                Add employee
              </Button>
            ) : undefined
          }
        />

        {error && <DataErrorBanner message={error} />}

        {sortedEmployees.length === 0 ? (
          <p className="employee-mgmt-empty">No employees on the payroll roster yet.</p>
        ) : (
          <ul className="employee-mgmt-list">
            {sortedEmployees.map((employee) => {
              const expanded = expandedId === employee.id;

              return (
                <li key={employee.id} className="employee-mgmt-item">
                  <div className="employee-mgmt-row">
                    <div className="employee-mgmt-info">
                      <p className="employee-mgmt-name">{getEmployeeLabel(employee)}</p>
                      <p className="employee-mgmt-meta">
                        {employee.email || 'No email'} · {employee.monthlySalary}{' '}
                        {employee.currency ?? displayCurrency}
                      </p>
                      <div className="employee-mgmt-badges">
                        <Badge variant={employee.active ? 'success' : 'default'}>
                          {employee.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant={employee.userId ? 'info' : 'warning'}>
                          {employee.userId ? 'Account linked' : 'No linked account'}
                        </Badge>
                      </div>
                    </div>

                    <div className="employee-mgmt-actions">
                      {permissions.canManageEmployees && !employee.userId && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openAllotCredentials(employee)}
                        >
                          <KeyRound size={15} />
                          Allot login
                        </Button>
                      )}
                      {permissions.canManageEmployees && (
                        <Button variant="secondary" size="sm" onClick={() => openEdit(employee)}>
                          <Pencil size={15} />
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expanded ? null : employee.id)}
                      >
                        Attendance
                        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="employee-mgmt-attendance">
                      <AttendancePanel employeeId={employee.id} readOnly={!permissions.canManageEmployees} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEmployee ? 'Edit employee' : 'Add employee'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : editingEmployee ? 'Save changes' : 'Add employee'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="form-grid">
          <Input
            label="Full name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <Input
            label="Job title"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <Input
            label="Monthly salary"
            value={form.monthlySalary}
            onChange={(event) => setForm({ ...form, monthlySalary: event.target.value })}
            required
          />
          <CurrencySelect
            label="Currency"
            value={form.currency}
            onChange={(value) => setForm({ ...form, currency: value })}
          />
          {editingEmployee && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              <span>Active on payroll</span>
            </label>
          )}
          {formError && <p className="form-error">{formError}</p>}
        </form>
      </Modal>

      <Modal
        isOpen={credentialsModalOpen}
        onClose={() => setCredentialsModalOpen(false)}
        title="Allot employee login"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCredentialsModalOpen(false)}>
              Close
            </Button>
            <Button onClick={handleAllotCredentials} disabled={credentialSubmitting}>
              {credentialSubmitting ? 'Creating...' : 'Create login'}
            </Button>
          </>
        }
      >
        {credentialEmployee && (
          <form onSubmit={handleAllotCredentials} className="form-grid">
            <p className="form-hint">
              Creates a verified employee account linked to{' '}
              <strong>{getEmployeeLabel(credentialEmployee)}</strong>. The employee can sign
              in immediately with these credentials.
            </p>
            <Input
              label="Display name"
              value={credentialForm.displayName}
              onChange={(event) =>
                setCredentialForm({ ...credentialForm, displayName: event.target.value })
              }
              required
            />
            <Input
              label="Login email"
              type="email"
              value={credentialForm.email}
              onChange={(event) =>
                setCredentialForm({ ...credentialForm, email: event.target.value })
              }
              required
            />
            <Input
              label="Temporary password"
              type="password"
              value={credentialForm.password}
              onChange={(event) =>
                setCredentialForm({ ...credentialForm, password: event.target.value })
              }
              required
              minLength={6}
              autoComplete="new-password"
            />
            {credentialError && <p className="form-error">{credentialError}</p>}
            {credentialSuccess && <p className="form-success">{credentialSuccess}</p>}
          </form>
        )}
      </Modal>
    </>
  );
}
