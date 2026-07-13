import type { UserProfile } from '../types';

export function normalizeUsers(
  data: Record<string, UserProfile>,
): UserProfile[] {
  return Object.entries(data).map(([key, user]) => ({
    ...user,
    uid: user.uid || key,
  }));
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
