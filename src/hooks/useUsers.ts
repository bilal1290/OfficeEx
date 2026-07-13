import { useEffect, useState } from 'react';
import { onValue, ref, set } from 'firebase/database';
import { createUserAccount } from '../lib/auth-api';
import { db } from '../lib/firebase';
import { normalizeUsers } from '../lib/users';
import type { UserProfile, UserRole } from '../types';

export function useUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() as Record<string, UserProfile>;
          setUsers(normalizeUsers(data));
        } else {
          setUsers([]);
        }
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Users listener error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const projectOwners = users.filter((user) => user.role === 'project_owner');
  const viewers = users.filter((user) => user.role === 'viewer');
  const admins = users.filter((user) => user.role === 'admin');

  const updateUser = async (
    uid: string,
    data: Partial<Pick<UserProfile, 'displayName' | 'email' | 'role'>>,
  ) => {
    if (!db) throw new Error('Database is not configured');
    const existing = users.find((user) => user.uid === uid);
    if (!existing) throw new Error('User not found');

    const updated: UserProfile = {
      ...existing,
      ...data,
      updatedAt: Date.now(),
    };

    await set(ref(db, `users/${uid}`), updated);
    return updated;
  };

  const addUser = async (
    displayName: string,
    email: string,
    password: string,
    role: UserRole,
  ) => createUserAccount(email, password, displayName, role);

  return {
    users,
    projectOwners,
    viewers,
    admins,
    loading,
    error,
    updateUser,
    addUser,
  };
}
