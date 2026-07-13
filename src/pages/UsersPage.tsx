import { useMemo, useState } from 'react';
import { Pencil, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUsers } from '../hooks/useUsers';
import { USER_ROLES } from '../lib/constants';
import { getRoleLabel } from '../lib/permissions';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { formatDateTime } from '../lib/datetime';
import type { UserProfile, UserRole } from '../types';

type RoleFilter = 'all' | UserRole;

const roleBadgeVariant = (role: UserRole) => {
  if (role === 'admin') return 'info';
  if (role === 'viewer') return 'warning';
  return 'default';
};

export function UsersPage() {
  const { profile } = useAuth();
  const { users, loading, updateUser, addUser } = useUsers();

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('project_owner');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredUsers = useMemo(() => {
    if (roleFilter === 'all') return users;
    return users.filter((user) => user.role === roleFilter);
  }, [users, roleFilter]);

  const resetCreateForm = () => {
    setDisplayName('');
    setEmail('');
    setPassword('');
    setRole('project_owner');
    setError('');
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
    setError('');
    setEditModalOpen(true);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }
      await addUser(displayName, email, password, role);
      setCreateModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;

    setError('');
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
      setError(err instanceof Error ? err.message : 'Failed to update user.');
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
      <Card>
        <CardHeader
          title="User Management"
          subtitle="Manage administrators, project owners, and expense viewers in one place"
          action={
            <Button onClick={openCreate}>
              <UserPlus size={18} />
              Add User
            </Button>
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
        title="Add User"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create User'}
            </Button>
          </>
        }
      >
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
          <Input
            label="Temporary Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
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
            {USER_ROLES.find((item) => item.value === role)?.description}
          </p>
          {error && <p className="auth-error">{error}</p>}
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
          {error && <p className="auth-error">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
