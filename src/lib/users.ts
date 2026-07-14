import { resolveAccountStatus } from './account-status';
import type { UserProfile, UserRole } from '../types';

const VALID_ROLES: UserRole[] = ['admin', 'project_owner', 'viewer', 'employee'];

export function sanitizeUserProfile(
  key: string,
  user: Partial<UserProfile> | null | undefined,
): UserProfile | null {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const uid = user.uid || key;
  if (!uid) {
    return null;
  }

  const email = user.email?.trim() ?? '';
  const displayName =
    user.displayName?.trim() ||
    email.split('@')[0] ||
    'Team member';

  const role = VALID_ROLES.includes(user.role as UserRole)
    ? (user.role as UserRole)
    : 'viewer';

  const accountStatus = resolveAccountStatus(role, user.accountStatus);

  const employeeId = user.employeeId?.trim() || undefined;
  const photoURL = user.photoURL?.trim() || undefined;

  return {
    uid,
    email,
    displayName,
    photoURL,
    role,
    accountStatus,
    employeeId,
    createdAt: user.createdAt ?? Date.now(),
    updatedAt: user.updatedAt,
  };
}

export function normalizeUsers(
  data: Record<string, UserProfile>,
): UserProfile[] {
  return Object.entries(data)
    .map(([key, user]) => sanitizeUserProfile(key, user))
    .filter((user): user is UserProfile => user !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function buildUserNameMap(users: UserProfile[]): Map<string, string> {
  return new Map(users.map((user) => [user.uid, user.displayName]));
}

export function resolveUserName(
  ownerId: string,
  users: UserProfile[],
  storedName?: string,
): string {
  return buildUserNameMap(users).get(ownerId) ?? storedName ?? 'Unknown';
}

export function getInitials(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return 'U';
  return trimmed.charAt(0).toUpperCase();
}

export function getPlaceholderAvatarUrl(
  uid: string,
  displayName: string,
  size = 128,
): string {
  const seed = encodeURIComponent(displayName.trim() || uid);
  return `https://ui-avatars.com/api/?name=${seed}&background=145A45&color=fff&size=${size}&bold=true`;
}

export function getUserAvatarUrl(
  user: Pick<UserProfile, 'uid' | 'displayName' | 'photoURL'>,
  size = 128,
): string {
  if (user.photoURL?.trim()) {
    return user.photoURL.trim();
  }
  return getPlaceholderAvatarUrl(user.uid, user.displayName, size);
}

export function resolveAuthPhotoUrl(photoURL?: string | null): string | undefined {
  const trimmed = photoURL?.trim();
  return trimmed || undefined;
}

export function isCustomProfilePhoto(photoURL?: string | null): boolean {
  return Boolean(photoURL?.trim().startsWith('data:image/'));
}

export function serializeUserForDatabase(
  user: UserProfile,
): Record<string, string | number> {
  const payload: Record<string, string | number> = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  };

  if (user.photoURL) {
    payload.photoURL = user.photoURL;
  }

  if (user.accountStatus) {
    payload.accountStatus = user.accountStatus;
  }

  if (user.employeeId) {
    payload.employeeId = user.employeeId;
  }

  if (user.updatedAt != null) {
    payload.updatedAt = user.updatedAt;
  }

  return payload;
}
