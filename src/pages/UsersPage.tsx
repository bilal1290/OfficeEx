import { useMemo, useState } from 'react';
import { Link2, Pencil, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUsers } from '../hooks/useUsers';
import { USER_ROLES } from '../lib/constants';
import { getRoleLabel, getAccountStatusLabel } from '../lib/permissions';
import { PendingAccountsPanel } from '../components/dashboard/PendingAccountsPanel';
import { EmployeeManagementPanel } from '../components/admin/EmployeeManagementPanel';
import { LeaveRequestsPanel } from '../components/admin/LeaveRequestsPanel';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { DataErrorBanner } from '../components/ui/DataErrorBanner';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { UserAvatar } from '../components/ui/UserAvatar';
import { formatDateTime } from '../lib/datetime';
import { clsx } from '../lib/utils';
import type { AccountStatus, UserProfile, UserRole } from '../types';

type RoleFilter = 'all' | UserRole;
type CreateMode = 'create' | 'link-email' | 'link-uid';

const roleBadgeVariant = (role: UserRole) => {
  if (role === 'admin') return 'info';
  if (role === 'viewer') return 'warning';
  if (role === 'employee') return 'success';
  return 'default';
};

const FILTER_OPTIONS: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'admin', label: 'Administrators' },
  { value: 'project_owner', label: 'Project Owners' },
  { value: 'viewer', label: 'Expense Viewers' },
  { value: 'employee', label: 'Employees' },
];

export function UsersPage() {
  const { profile } = useAuth();
  const { users, loading, error, updateUser, addUser, linkUserByEmail, linkUserByUid } =
    useUsers();

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [createMode, setCreateMode] = useState<CreateMode>('create');

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [uid, setUid] = useState('');
  const [role, setRole] = useState<UserRole>('project_owner');
  const [accountStatus, setAccountStatus] = useState<AccountStatus>('verified');

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const roleCounts = useMemo(
    () => ({
      all: users.length,
      admin: users.filter((user) => user.role === 'admin').length,
      project_owner: users.filter((user) => user.role === 'project_owner').length,
      viewer: users.filter((user) => user.role === 'viewer').length,
      employee: users.filter((user) => user.role === 'employee').length,
    }),
    [users],
  );

  const filteredUsers = useMemo(() => {
    if (roleFilter === 'all') return users;
    return users.filter((user) => user.role === roleFilter);
  }, [users, roleFilter]);

  const resetCreateForm = () => {
    setDisplayName('');
    setEmail('');
    setPassword('');
    setUid('');
    setRole('project_owner');
    setFormError('');
    setCreateMode('create');
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateModalOpen(true);
  };

  const openEdit = (user: UserProfile) => {
    setEditingUser(user);
    setDisplayName(user.displayName);
    setEmail(user.email);
    setRole(user.role);
    setAccountStatus(user.accountStatus ?? 'verified');
    setFormError('');
    setEditModalOpen(true);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (createMode === 'create') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await addUser(displayName, email, password, role);
      } else if (createMode === 'link-email') {
        await linkUserByEmail(email, displayName, role);
      } else {
        if (!uid.trim()) {
          throw new Error('Firebase UID is required.');
        }
        await linkUserByUid(uid.trim(), email, displayName, role);
      }
      setCreateModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;

    setFormError('');
    setSubmitting(true);

    try {
      await updateUser(editingUser.uid, {
        displayName,
        email,
        role,
        accountStatus,
      });
      setEditModalOpen(false);
      setEditingUser(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update user.');
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
    <div className="page">
      {error && <DataErrorBanner message={error} />}
      <PendingAccountsPanel />
      <LeaveRequestsPanel />
      <EmployeeManagementPanel />
      <Card className="team-card" padding={false}>
        <div className="team-card-head">
          <CardHeader
            title="Team"
            subtitle={`${users.length} member${users.length === 1 ? '' : 's'} · roles and access`}
            action={
              <div className="card-header-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    resetCreateForm();
                    setCreateMode('link-email');
                    setCreateModalOpen(true);
                  }}
                >
                  <Link2 size={18} />
                  Link Existing
                </Button>
                <Button onClick={openCreate}>
                  <UserPlus size={18} />
                  Add User
                </Button>
              </div>
            }
          />

          <div className="team-filters">
            {FILTER_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={clsx(
                  'team-filter-pill',
                  roleFilter === value && 'team-filter-pill-active',
                )}
                onClick={() => setRoleFilter(value)}
              >
                <span>{label}</span>
                <span className="team-filter-count">{roleCounts[value]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="team-list">
          {filteredUsers.length === 0 ? (
            <p className="team-empty">No users found for this role.</p>
          ) : (
            filteredUsers.map((user) => (
              <article key={user.uid} className="team-member">
                <div className="team-member-main">
                  <UserAvatar user={user} size="md" />
                  <div className="team-member-info">
                    <p className="team-member-name">{user.displayName}</p>
                    <p className="team-member-email">{user.email}</p>
                  </div>
                </div>

                <div className="team-member-meta">
                  <Badge variant={roleBadgeVariant(user.role)}>
                    {getRoleLabel(user.role)}
                  </Badge>
                  {user.accountStatus && user.accountStatus !== 'verified' && (
                    <Badge variant={user.accountStatus === 'rejected' ? 'default' : 'warning'}>
                      {getAccountStatusLabel(user.accountStatus)}
                    </Badge>
                  )}
                  <span className="team-member-joined">
                    Joined {formatDateTime(user.createdAt)}
                  </span>
                </div>

                <button
                  type="button"
                  className="team-member-edit"
                  onClick={() => openEdit(user)}
                  aria-label={`Edit ${user.displayName}`}
                >
                  <Pencil size={16} />
                </button>
              </article>
            ))
          )}
        </div>
      </Card>

      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={
          createMode === 'create'
            ? 'Add User'
            : createMode === 'link-email'
              ? 'Link Existing Account'
              : 'Link by Firebase UID'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting
                ? 'Saving...'
                : createMode === 'create'
                  ? 'Create User'
                  : 'Link to Team'}
            </Button>
          </>
        }
      >
        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab ${createMode === 'create' ? 'active' : ''}`}
            onClick={() => setCreateMode('create')}
          >
            Create new
          </button>
          <button
            type="button"
            className={`modal-tab ${createMode === 'link-email' ? 'active' : ''}`}
            onClick={() => setCreateMode('link-email')}
          >
            Link by email
          </button>
          <button
            type="button"
            className={`modal-tab ${createMode === 'link-uid' ? 'active' : ''}`}
            onClick={() => setCreateMode('link-uid')}
          >
            Link by UID
          </button>
        </div>

        <form onSubmit={handleCreate} className="form-grid">
          <Input
            label="Full Name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {createMode === 'create' && (
            <Input
              label="Temporary Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          )}
          {createMode === 'link-uid' && (
            <Input
              label="Firebase UID"
              value={uid}
              onChange={(event) => setUid(event.target.value)}
              required
              placeholder="Copy from Firebase Console → Authentication"
            />
          )}
          <Select
            label="Role"
            options={USER_ROLES.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          />
          <p className="form-hint">
            {createMode === 'create'
              ? USER_ROLES.find((item) => item.value === role)?.description
              : createMode === 'link-email'
                ? 'Looks up the Firebase Auth account by email and adds a team profile.'
                : 'Paste the UID from Firebase Console when email lookup is unavailable.'}
          </p>
          {formError && <p className="auth-error">{formError}</p>}
        </form>
      </Modal>

      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit User"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        {editingUser && (
          <div className="team-edit-preview">
            <UserAvatar user={editingUser} size="lg" />
            <div>
              <p className="team-edit-preview-name">{editingUser.displayName}</p>
              <p className="team-edit-preview-email">{editingUser.email}</p>
            </div>
          </div>
        )}
        <form onSubmit={handleUpdate} className="form-grid">
          <Input
            label="Full Name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Select
            label="Role"
            options={USER_ROLES.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            disabled={editingUser?.uid === profile?.uid}
          />
          {editingUser?.uid !== profile?.uid && (
            <Select
              label="Account status"
              value={accountStatus}
              onChange={(event) => setAccountStatus(event.target.value as AccountStatus)}
              options={[
                { value: 'verified', label: 'Verified' },
                { value: 'pending', label: 'Pending approval' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
          )}
          {editingUser?.uid === profile?.uid && (
            <p className="form-hint">
              You cannot change your own role. Ask another admin if needed.
            </p>
          )}
          {formError && <p className="auth-error">{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}
