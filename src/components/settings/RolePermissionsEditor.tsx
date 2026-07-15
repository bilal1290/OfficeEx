import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { useRolePermissions } from '../../context/RolePermissionsContext';
import {
  CONFIGURABLE_ROLES,
  PERMISSION_GROUPS,
  type ConfigurableRole,
  type PermissionKey,
} from '../../lib/role-permissions-config';
import { getRoleLabel, type Permissions } from '../../lib/permissions';
import { Button } from '../ui/Button';
import { clsx } from '../../lib/utils';

const ADMIN_ONLY_KEYS: PermissionKey[] = ['canManageUsers', 'canVerifyEmployees'];

function permissionsEqual(a: Permissions, b: Permissions): boolean {
  return (Object.keys(a) as PermissionKey[]).every((key) => a[key] === b[key]);
}

export function RolePermissionsEditor() {
  const { config, loading, savingRole, saveRolePermissions, resetRoleToDefaults } =
    useRolePermissions();
  const [activeRole, setActiveRole] = useState<ConfigurableRole>('project_owner');
  const [draft, setDraft] = useState<Permissions>(config.project_owner);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(config[activeRole]);
    setSaved(false);
    setError('');
  }, [activeRole, config]);

  const savedPermissions = config[activeRole];
  const isDirty = useMemo(
    () => !permissionsEqual(draft, savedPermissions),
    [draft, savedPermissions],
  );
  const isSaving = savingRole === activeRole;

  const togglePermission = (key: PermissionKey) => {
    setDraft((current) => ({
      ...current,
      [key]: !current[key],
    }));
    setSaved(false);
    setError('');
  };

  const handleSave = async () => {
    setError('');
    try {
      await saveRolePermissions(activeRole, draft);
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save role permissions.',
      );
    }
  };

  const handleReset = async () => {
    setError('');
    try {
      await resetRoleToDefaults(activeRole);
      setSaved(false);
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : 'Could not reset role permissions.',
      );
    }
  };

  if (loading) {
    return <p className="settings-block-desc">Loading role access settings…</p>;
  }

  return (
    <div className="role-permissions-editor">
      <div className="settings-block">
        <h4 className="settings-block-title">Role access</h4>
        <p className="settings-block-desc">
          Choose which pages and actions each role can use. Changes apply to all
          users with that role. Administrators always have full access.
        </p>
      </div>

      <div className="role-permissions-tabs" role="tablist" aria-label="Roles">
        {CONFIGURABLE_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            role="tab"
            aria-selected={activeRole === role}
            className={clsx(
              'role-permissions-tab',
              activeRole === role && 'role-permissions-tab-active',
            )}
            onClick={() => setActiveRole(role)}
          >
            {getRoleLabel(role)}
          </button>
        ))}
      </div>

      {activeRole === 'employee' && (
        <p className="role-permissions-note">
          Employee portal permissions apply only after an admin verifies the account
          and links an employee record.
        </p>
      )}

      {PERMISSION_GROUPS.map((group) => {
        const items = group.items.filter(
          (item) => !ADMIN_ONLY_KEYS.includes(item.key),
        );
        if (items.length === 0) return null;

        return (
          <section key={group.id} className="role-permissions-group">
            <h5 className="role-permissions-group-title">{group.label}</h5>
            <ul className="role-permissions-list">
              {items.map((item) => (
                <li key={item.key} className="role-permissions-item">
                  <label className="role-permissions-label">
                    <input
                      type="checkbox"
                      checked={draft[item.key]}
                      onChange={() => togglePermission(item.key)}
                      disabled={isSaving}
                    />
                    <span className="role-permissions-copy">
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="role-permissions-actions">
        <Button onClick={handleSave} disabled={!isDirty || isSaving}>
          <Save size={16} />
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={isSaving}
        >
          <RotateCcw size={16} />
          Reset to defaults
        </Button>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {saved && !isDirty && (
        <p className="settings-saved-msg">Role access saved.</p>
      )}
    </div>
  );
}
