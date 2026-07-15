import { ref, runTransaction } from 'firebase/database';
import { db } from './firebase';
import type { AccountStatus, UserRole } from '../types';

export interface BootstrapRole {
  role: UserRole;
  accountStatus: AccountStatus;
}

/** Atomically claim the first admin slot for a new workspace. */
export async function claimBootstrapAdmin(uid: string): Promise<boolean> {
  if (!db) return false;

  const bootstrapRef = ref(db, 'settings/bootstrap');
  const result = await runTransaction(bootstrapRef, (current) => {
    const existingUid =
      current && typeof current === 'object' && 'adminUid' in current
        ? String((current as { adminUid?: string }).adminUid ?? '')
        : '';

    if (existingUid) {
      return current;
    }

    return { adminUid: uid, claimedAt: Date.now() };
  });

  const adminUid =
    result.snapshot.exists() &&
    typeof result.snapshot.val() === 'object' &&
    result.snapshot.val()?.adminUid
      ? String(result.snapshot.val().adminUid)
      : '';

  return adminUid === uid;
}

export async function resolveBootstrapRole(uid: string): Promise<BootstrapRole> {
  const isAdmin = await claimBootstrapAdmin(uid);
  if (isAdmin) {
    return { role: 'admin', accountStatus: 'verified' };
  }
  return { role: 'project_owner', accountStatus: 'pending' };
}
