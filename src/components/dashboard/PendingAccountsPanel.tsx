import { useMemo, useState } from 'react';
import { CheckCircle2, UserCheck, XCircle } from 'lucide-react';
import { useEmployees } from '../../hooks/useEmployees';
import { useUsers } from '../../hooks/useUsers';
import { USER_ROLES } from '../../lib/constants';
import { getAccountStatusLabel, getRoleLabel } from '../../lib/permissions';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { DataErrorBanner } from '../ui/DataErrorBanner';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { UserAvatar } from '../ui/UserAvatar';
import type { UserRole } from '../../types';

const TEAM_ROLE_OPTIONS = USER_ROLES.filter((item) => item.value !== 'employee');

export function PendingAccountsPanel() {
  const { users, approveTeam, verifyEmployee, rejectPending } = useUsers();
  const { employees, loading, error } = useEmployees();
  const [selectedEmployeeByUser, setSelectedEmployeeByUser] = useState<Record<string, string>>({});
  const [selectedRoleByUser, setSelectedRoleByUser] = useState<Record<string, UserRole>>({});
  const [submittingUid, setSubmittingUid] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const pendingAccounts = useMemo(
    () => users.filter((user) => user.accountStatus === 'pending'),
    [users],
  );

  const availableEmployees = useMemo(
    () => employees.filter((employee) => employee.active && !employee.userId),
    [employees],
  );

  const employeeOptions = availableEmployees.map((employee) => ({
    value: employee.id,
    label: employee.title ? `${employee.name} · ${employee.title}` : employee.name,
  }));

  const handleApproveEmployee = async (uid: string) => {
    const employeeId = selectedEmployeeByUser[uid];
    if (!employeeId) {
      setActionError('Select an employee record before verifying.');
      return;
    }

    setSubmittingUid(uid);
    setActionError('');
    try {
      await verifyEmployee(uid, employeeId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setSubmittingUid(null);
    }
  };

  const handleApproveTeam = async (uid: string, currentRole: UserRole) => {
    const role = selectedRoleByUser[uid] ?? currentRole;
    if (role === 'employee') {
      setActionError('Choose a team role or use employee linking for payroll access.');
      return;
    }

    setSubmittingUid(uid);
    setActionError('');
    try {
      await approveTeam(uid, role);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approval failed.');
    } finally {
      setSubmittingUid(null);
    }
  };

  const handleReject = async (uid: string) => {
    setSubmittingUid(uid);
    setActionError('');
    try {
      await rejectPending(uid);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reject request.');
    } finally {
      setSubmittingUid(null);
    }
  };

  if (loading) {
    return (
      <Card className="employee-verify-card">
        <div className="office-panel-loading">
          <div className="spinner" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="employee-verify-card">
      <CardHeader
        title="Pending registrations"
        subtitle="Review external sign-ups, assign roles, and approve access"
      />

      {error && <DataErrorBanner message={error} />}
      {actionError && <p className="form-error employee-verify-error">{actionError}</p>}

      {pendingAccounts.length === 0 ? (
        <p className="employee-verify-empty">No accounts waiting for administrator approval.</p>
      ) : (
        <ul className="employee-verify-list">
          {pendingAccounts.map((user) => {
            const isEmployeeRequest = user.role === 'employee';

            return (
              <li key={user.uid} className="employee-verify-item">
                <div className="employee-verify-user">
                  <UserAvatar user={user} size="md" />
                  <div>
                    <p className="employee-verify-name">{user.displayName}</p>
                    <p className="employee-verify-email">{user.email}</p>
                    <div className="employee-verify-badges">
                      <Badge variant="warning">{getAccountStatusLabel(user.accountStatus)}</Badge>
                      <Badge variant="default">
                        {isEmployeeRequest ? 'Employee request' : getRoleLabel(user.role)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="employee-verify-actions">
                  {isEmployeeRequest ? (
                    <Select
                      label="Link to employee"
                      value={selectedEmployeeByUser[user.uid] ?? ''}
                      onChange={(event) =>
                        setSelectedEmployeeByUser((current) => ({
                          ...current,
                          [user.uid]: event.target.value,
                        }))
                      }
                      options={[
                        { value: '', label: 'Select employee record' },
                        ...employeeOptions,
                      ]}
                    />
                  ) : (
                    <Select
                      label="Assign role"
                      value={selectedRoleByUser[user.uid] ?? user.role}
                      onChange={(event) =>
                        setSelectedRoleByUser((current) => ({
                          ...current,
                          [user.uid]: event.target.value as UserRole,
                        }))
                      }
                      options={TEAM_ROLE_OPTIONS.map((item) => ({
                        value: item.value,
                        label: item.label,
                      }))}
                    />
                  )}

                  <div className="employee-verify-buttons">
                    <Button
                      size="sm"
                      onClick={() =>
                        isEmployeeRequest
                          ? handleApproveEmployee(user.uid)
                          : handleApproveTeam(user.uid, user.role)
                      }
                      disabled={submittingUid === user.uid}
                    >
                      <UserCheck size={15} />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReject(user.uid)}
                      disabled={submittingUid === user.uid}
                    >
                      <XCircle size={15} />
                      Reject
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {availableEmployees.length === 0 &&
        pendingAccounts.some((user) => user.role === 'employee') && (
          <p className="employee-verify-hint">
            <CheckCircle2 size={15} />
            Add employees on the Office page if no unlinked payroll records are available.
          </p>
        )}
    </Card>
  );
}
