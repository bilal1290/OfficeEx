import type { UserProfile } from '../types';
import { getDefaultRolePermissions } from './role-permissions-config';
import { getPermissions } from './permissions';
import type { RolePermissionsConfig } from './role-permissions-config';

export function canUserChat(
  profile: UserProfile,
  config: RolePermissionsConfig = getDefaultRolePermissions(),
): boolean {
  return getPermissions(
    profile.role,
    profile.accountStatus,
    profile.employeeId,
    config,
  ).canAccessChat;
}

export function getChatEligibleUsers(
  users: UserProfile[],
  myUid: string | undefined,
  config: RolePermissionsConfig = getDefaultRolePermissions(),
): UserProfile[] {
  return users
    .filter((user) => user.uid !== myUid && canUserChat(user, config))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
