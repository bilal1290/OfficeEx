import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onValue, ref, set } from 'firebase/database';
import { db } from '../lib/firebase';
import {
  cloneRolePermissionsConfig,
  getDefaultRolePermissions,
  parseRolePermissionsConfig,
  type ConfigurableRole,
  type RolePermissionsConfig,
} from '../lib/role-permissions-config';
import type { Permissions } from '../lib/permissions';

interface RolePermissionsContextValue {
  config: RolePermissionsConfig;
  loading: boolean;
  savingRole: ConfigurableRole | null;
  saveRolePermissions: (role: ConfigurableRole, permissions: Permissions) => Promise<void>;
  resetRoleToDefaults: (role: ConfigurableRole) => Promise<void>;
}

const RolePermissionsContext = createContext<RolePermissionsContextValue | null>(null);

export function RolePermissionsProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<RolePermissionsConfig>(getDefaultRolePermissions);
  const [loading, setLoading] = useState(Boolean(db));
  const [savingRole, setSavingRole] = useState<ConfigurableRole | null>(null);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const configRef = ref(db, 'settings/rolePermissions');
    const unsubscribe = onValue(
      configRef,
      (snapshot) => {
        setConfig(parseRolePermissionsConfig(snapshot.val()));
        setLoading(false);
      },
      () => setLoading(false),
    );

    return () => unsubscribe();
  }, []);

  const persistConfig = useCallback(async (next: RolePermissionsConfig) => {
    if (!db) throw new Error('Database is not configured');
    await set(ref(db, 'settings/rolePermissions'), next);
    setConfig(next);
  }, []);

  const saveRolePermissions = useCallback(
    async (role: ConfigurableRole, permissions: Permissions) => {
      setSavingRole(role);
      try {
        const next = cloneRolePermissionsConfig(config);
        next[role] = { ...permissions };
        await persistConfig(next);
      } finally {
        setSavingRole(null);
      }
    },
    [config, persistConfig],
  );

  const resetRoleToDefaults = useCallback(
    async (role: ConfigurableRole) => {
      setSavingRole(role);
      try {
        const defaults = getDefaultRolePermissions();
        const next = cloneRolePermissionsConfig(config);
        next[role] = { ...defaults[role] };
        await persistConfig(next);
      } finally {
        setSavingRole(null);
      }
    },
    [config, persistConfig],
  );

  const value = useMemo(
    () => ({
      config,
      loading,
      savingRole,
      saveRolePermissions,
      resetRoleToDefaults,
    }),
    [config, loading, savingRole, saveRolePermissions, resetRoleToDefaults],
  );

  return (
    <RolePermissionsContext.Provider value={value}>
      {children}
    </RolePermissionsContext.Provider>
  );
}

export function useRolePermissions() {
  const context = useContext(RolePermissionsContext);
  if (!context) {
    throw new Error('useRolePermissions must be used within RolePermissionsProvider');
  }
  return context;
}
