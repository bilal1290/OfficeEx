import { get, ref, remove, set } from 'firebase/database';
import { db } from './firebase';
import { serializeUserForDatabase } from './users';
import type { UserProfile } from '../types';

function assertDb() {
  if (!db) {
    throw new Error('Database is not configured');
  }
  return db;
}

export async function countAdmins(users: UserProfile[]): Promise<number> {
  return users.filter((user) => user.role === 'admin').length;
}

export async function disableUserAccount(
  uid: string,
  users: UserProfile[],
  actingAdminUid: string,
): Promise<void> {
  const database = assertDb();

  if (uid === actingAdminUid) {
    throw new Error('You cannot disable your own account.');
  }

  const target = users.find((user) => user.uid === uid);
  if (!target) {
    throw new Error('User not found.');
  }

  if (target.role === 'admin') {
    const adminCount = await countAdmins(users);
    if (adminCount <= 1) {
      throw new Error('Cannot disable the only administrator.');
    }
  }

  const updated: UserProfile = {
    ...target,
    accountStatus: 'rejected',
    updatedAt: Date.now(),
  };

  await set(ref(database, `users/${uid}`), serializeUserForDatabase(updated));
}

export async function enableUserAccount(
  uid: string,
  users: UserProfile[],
): Promise<void> {
  const database = assertDb();

  const target = users.find((user) => user.uid === uid);
  if (!target) {
    throw new Error('User not found.');
  }

  if (
    target.role === 'employee' &&
    target.accountStatus === 'rejected' &&
    !target.employeeId
  ) {
    throw new Error(
      'Link this employee to a payroll record before re-enabling access.',
    );
  }

  const updated: UserProfile = {
    ...target,
    accountStatus: 'verified',
    updatedAt: Date.now(),
  };

  await set(ref(database, `users/${uid}`), serializeUserForDatabase(updated));
}

export async function deleteUserAccount(
  uid: string,
  users: UserProfile[],
  actingAdminUid: string,
): Promise<void> {
  const database = assertDb();

  if (uid === actingAdminUid) {
    throw new Error('You cannot delete your own account.');
  }

  const target = users.find((user) => user.uid === uid);
  if (!target) {
    throw new Error('User not found.');
  }

  if (target.role === 'admin') {
    const adminCount = await countAdmins(users);
    if (adminCount <= 1) {
      throw new Error('Cannot delete the only administrator.');
    }
  }

  if (target.employeeId) {
    const employeeRef = ref(database, `employees/${target.employeeId}/userId`);
    const linkedSnapshot = await get(employeeRef);
    if (linkedSnapshot.exists() && linkedSnapshot.val() === uid) {
      await remove(employeeRef);
      await set(ref(database, `employees/${target.employeeId}/updatedAt`), Date.now());
    }
  }

  await set(ref(database, `settings/revokedUsers/${uid}`), {
    email: target.email,
    displayName: target.displayName,
    removedAt: Date.now(),
    removedBy: actingAdminUid,
  });

  await remove(ref(database, `users/${uid}`));
}

export async function isUserRevoked(uid: string): Promise<boolean> {
  if (!db) return false;
  const snapshot = await get(ref(db, `settings/revokedUsers/${uid}`));
  return snapshot.exists();
}
