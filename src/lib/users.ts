import type { UserProfile, UserRole } from '../types';

const VALID_ROLES: UserRole[] = ['admin', 'project_owner', 'viewer'];

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

  return {
    uid,
    email,
    displayName,
    role,
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
