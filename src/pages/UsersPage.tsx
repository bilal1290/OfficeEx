import { useMemo, useState } from 'react';
import { Link2, Pencil, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUsers } from '../hooks/useUsers';
import { USER_ROLES } from '../lib/constants';
import { getRoleLabel } from '../lib/permissions';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { DataErrorBanner } from '../components/ui/DataErrorBanner';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { formatDateTime } from '../lib/datetime';
import type { UserProfile, UserRole } from '../types';

type RoleFilter = 'all' | UserRole;
type CreateMode = 'create' | 'link-email' | 'link-uid';

const roleBadgeVariant = (role: UserRole) => {
  if (role === 'admin') return 'info';
  if (role === 'viewer') return 'warning';
  return 'default';
};

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

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      <Card>
        <CardHeader
          title="Team"
          subtitle={`${users.length} member${users.length === 1 ? '' : 's'} · manage roles and access`}
          action={
            <div className="card-header-actions">
              <Button variant="secondary" onClick={() => { resetCreateForm(); setCreateMode('link-email'); setCreateModalOpen(true); }}>
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

        <div className="role-filter-tabs">
          {(['all', 'admin', 'project_owner', 'viewer'] as RoleFilter[]).map(
            (filterValue) => (
              <button
                key={filterValue}
                type="button"
                className={`role-filter-tab ${roleFilter === filterValue ? 'active' : ''}`}
                onClick={() => setRoleFilter(filterValue)}
              >
                {filterValue === 'all' ? 'All Users' : getRoleLabel(filterValue)}
              </button>
            ),
          )}
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No users found for this role.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.uid}>
                    <td>{user.displayName}</td>
                    <td>{user.email}</td>
                    <td>
                      <Badge variant={roleBadgeVariant(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </td>
                    <td>{formatDateTime(user.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => openEdit(user)}
                        aria-label={`Edit ${user.displayName}`}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                ? 'Looks up the Firebase Auth account by email and adds a team profile so they appear in this list.'
                : 'Use when email lookup is unavailable. Paste the UID from Firebase Console.'}
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
