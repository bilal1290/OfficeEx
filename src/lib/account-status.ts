import type { AccountStatus, UserProfile } from '../types';

export type RegistrationKind = 'team' | 'employee';

const VALID_ACCOUNT_STATUSES: AccountStatus[] = ['pending', 'verified', 'rejected'];

export function isLegacyVerifiedUser(profile: Pick<UserProfile, 'role' | 'accountStatus'>): boolean {
  return !profile.accountStatus && profile.role !== 'employee';
}

export function isAccountPending(profile: Pick<UserProfile, 'accountStatus'>): boolean {
  return profile.accountStatus === 'pending';
}

export function isAccountRejected(profile: Pick<UserProfile, 'accountStatus'>): boolean {
  return profile.accountStatus === 'rejected';
}

export function needsAdminApproval(
  profile: Pick<UserProfile, 'role' | 'accountStatus'>,
): boolean {
  if (profile.role === 'admin') return false;
  if (profile.accountStatus === 'verified') return false;
  if (isLegacyVerifiedUser(profile)) return false;
  return profile.accountStatus === 'pending' || profile.accountStatus === 'rejected';
}

export function isAccountApproved(
  profile: Pick<UserProfile, 'role' | 'accountStatus'>,
): boolean {
  if (profile.role === 'admin') return true;
  if (profile.accountStatus === 'verified') return true;
  return isLegacyVerifiedUser(profile);
}

export function resolveAccountStatus(
  role: UserProfile['role'],
  accountStatus?: AccountStatus,
): AccountStatus | undefined {
  if (accountStatus && VALID_ACCOUNT_STATUSES.includes(accountStatus)) {
    return accountStatus;
  }
  if (role === 'employee') return 'pending';
  return undefined;
}

