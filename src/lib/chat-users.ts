import type { UserProfile } from '../types';
import { canAccessChat as canRoleAccessChat } from './permissions';

export function canUserChat(profile: UserProfile): boolean {
  return canRoleAccessChat(profile.role, profile.accountStatus);
}

export function getChatEligibleUsers(
  users: UserProfile[],
  myUid: string | undefined,
): UserProfile[] {
  return users
    .filter((user) => user.uid !== myUid && canUserChat(user))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
