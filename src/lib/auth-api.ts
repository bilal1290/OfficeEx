import { ref, get, set, runTransaction } from 'firebase/database';
import { db, firebaseConfig } from './firebase';
import { sanitizeUserProfile, serializeUserForDatabase } from './users';
import type { UserProfile, UserRole } from '../types';

interface CreateAuthUserResponse {
  localId: string;
  idToken: string;
}

interface LookupUserResponse {
  localId: string;
  email?: string;
}

interface AuthErrorResponse {
  error?: { message?: string };
}

function parseAuthError(payload: AuthErrorResponse, fallback: string): string {
  const message = payload.error?.message ?? fallback;
  if (message.includes('EMAIL_NOT_FOUND')) {
    return 'No Firebase account exists for this email. Create the account in Firebase Console first, or use Create Account.';
  }
  if (message.includes('EMAIL_EXISTS')) {
    return 'An account with this email already exists.';
  }
  return message;
}

export async function lookupUserByEmail(
  email: string,
): Promise<{ uid: string; email: string } | null> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: [email.trim()] }),
    },
  );

  const payload = (await response.json()) as
    | { users?: LookupUserResponse[] }
    | AuthErrorResponse;

  if (!response.ok || !('users' in payload) || !payload.users?.[0]) {
    return null;
  }

  const user = payload.users[0];
  return {
    uid: user.localId,
    email: user.email ?? email.trim(),
  };
}

export async function linkExistingUserProfile(
  uid: string,
  email: string,
  displayName: string,
  role: UserRole,
): Promise<UserProfile> {
  if (!db) {
    throw new Error('Database is not configured');
  }

  const trimmedUid = uid.trim();
  if (!trimmedUid) {
    throw new Error('Firebase UID is required.');
  }

  const existingSnapshot = await get(ref(db, `users/${trimmedUid}`));
  if (existingSnapshot.exists()) {
    throw new Error('This user is already on the team.');
  }

  const profile: UserProfile = {
    uid: trimmedUid,
    email: email.trim(),
    displayName: displayName.trim(),
    role,
    accountStatus: 'verified',
    createdAt: Date.now(),
  };

  await set(ref(db, `users/${trimmedUid}`), serializeUserForDatabase(profile));
  return profile;
}

export async function linkExistingUserByEmail(
  email: string,
  displayName: string,
  role: UserRole,
): Promise<UserProfile> {
  const authUser = await lookupUserByEmail(email);
  if (!authUser) {
    throw new Error(
      'Could not find a Firebase Auth account for this email. Add the user in Firebase Console, then link them here.',
    );
  }

  return linkExistingUserProfile(
    authUser.uid,
    authUser.email,
    displayName,
    role,
  );
}

export async function createUserAccount(
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
): Promise<UserProfile> {
  if (!db) {
    throw new Error('Database is not configured');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );

  const payload = (await response.json()) as
    | CreateAuthUserResponse
    | AuthErrorResponse;

  if (!response.ok) {
    throw new Error(parseAuthError(payload as AuthErrorResponse, 'Failed to create user'));
  }

  const authData = payload as CreateAuthUserResponse;
  const profile: UserProfile = {
    uid: authData.localId,
    email,
    displayName,
    role,
    accountStatus: 'verified',
    createdAt: Date.now(),
  };

  await set(ref(db, `users/${authData.localId}`), serializeUserForDatabase(profile));
  return profile;
}

export async function verifyEmployeeAccount(
  uid: string,
  employeeId: string,
): Promise<UserProfile> {
  if (!db) {
    throw new Error('Database is not configured');
  }

  const userSnapshot = await get(ref(db, `users/${uid}`));
  if (!userSnapshot.exists()) {
    throw new Error('User profile not found.');
  }

  const employeeSnapshot = await get(ref(db, `employees/${employeeId}`));
  if (!employeeSnapshot.exists()) {
    throw new Error('Employee record not found.');
  }

  const existingUser = sanitizeUserProfile(uid, userSnapshot.val() as UserProfile);
  if (!existingUser) {
    throw new Error('Invalid user profile.');
  }

  if (existingUser.role !== 'employee') {
    throw new Error('Only employee accounts can be verified here.');
  }

  if (existingUser.accountStatus !== 'pending') {
    throw new Error('This employee account is not waiting for approval.');
  }

  const linkedUserSnapshot = await get(ref(db, `employees/${employeeId}/userId`));
  if (linkedUserSnapshot.exists() && linkedUserSnapshot.val() !== uid) {
    throw new Error('This employee is already linked to another account.');
  }

  const updatedUser: UserProfile = {
    ...existingUser,
    accountStatus: 'verified',
    employeeId,
    updatedAt: Date.now(),
  };

  await set(ref(db, `users/${uid}`), serializeUserForDatabase(updatedUser));
  await set(ref(db, `employees/${employeeId}/userId`), uid);
  await set(ref(db, `employees/${employeeId}/updatedAt`), Date.now());

  return updatedUser;
}

export async function approveTeamAccount(
  uid: string,
  role: UserRole,
): Promise<UserProfile> {
  if (!db) {
    throw new Error('Database is not configured');
  }

  if (role === 'employee') {
    throw new Error('Use employee verification to approve employee accounts.');
  }

  const userSnapshot = await get(ref(db, `users/${uid}`));
  if (!userSnapshot.exists()) {
    throw new Error('User profile not found.');
  }

  const existingUser = sanitizeUserProfile(uid, userSnapshot.val() as UserProfile);
  if (!existingUser) {
    throw new Error('Invalid user profile.');
  }

  if (existingUser.accountStatus !== 'pending') {
    throw new Error('This account is not waiting for approval.');
  }

  const updatedUser: UserProfile = {
    ...existingUser,
    role,
    accountStatus: 'verified',
    updatedAt: Date.now(),
  };

  await set(ref(db, `users/${uid}`), serializeUserForDatabase(updatedUser));
  return updatedUser;
}

export async function rejectPendingAccount(uid: string): Promise<UserProfile> {
  if (!db) {
    throw new Error('Database is not configured');
  }

  const userSnapshot = await get(ref(db, `users/${uid}`));
  if (!userSnapshot.exists()) {
    throw new Error('User profile not found.');
  }

  const existingUser = sanitizeUserProfile(uid, userSnapshot.val() as UserProfile);
  if (!existingUser) {
    throw new Error('Invalid user profile.');
  }

  const updatedUser: UserProfile = {
    ...existingUser,
    accountStatus: 'rejected',
    updatedAt: Date.now(),
  };
  delete updatedUser.employeeId;

  await set(ref(db, `users/${uid}`), serializeUserForDatabase(updatedUser));
  return updatedUser;
}

export async function createEmployeeProfile(
  uid: string,
  email: string,
  displayName: string,
): Promise<UserProfile> {
  if (!db) {
    throw new Error('Database is not configured');
  }

  const profile: UserProfile = {
    uid,
    email,
    displayName,
    role: 'employee',
    accountStatus: 'pending',
    createdAt: Date.now(),
  };

  await set(ref(db, `users/${uid}`), serializeUserForDatabase(profile));
  return profile;
}

export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string,
  isFirstUser: boolean,
  photoURL?: string,
): Promise<UserProfile> {
  if (!db) {
    throw new Error('Database is not configured');
  }

  const userRef = ref(db, `users/${uid}`);
  const profile: UserProfile = {
    uid,
    email,
    displayName,
    photoURL,
    role: isFirstUser ? 'admin' : 'project_owner',
    accountStatus: isFirstUser ? 'verified' : 'pending',
    createdAt: Date.now(),
  };

  const result = await runTransaction(userRef, (current) => {
    if (current) {
      return current;
    }
    return serializeUserForDatabase(profile);
  });

  const saved = sanitizeUserProfile(uid, result.snapshot.val() as UserProfile);
  if (!saved) {
    throw new Error('Failed to save user profile.');
  }
  return saved;
}

export async function allotEmployeeCredentials(
  employeeId: string,
  email: string,
  password: string,
  displayName: string,
): Promise<UserProfile> {
  if (!db) {
    throw new Error('Database is not configured');
  }

  const trimmedEmail = email.trim();
  const trimmedName = displayName.trim();
  if (!trimmedEmail || !trimmedName) {
    throw new Error('Email and display name are required.');
  }

  const employeeSnapshot = await get(ref(db, `employees/${employeeId}`));
  if (!employeeSnapshot.exists()) {
    throw new Error('Employee record not found.');
  }

  const employee = employeeSnapshot.val() as {
    userId?: string;
    email?: string;
  };

  if (employee.userId) {
    throw new Error('This employee already has login credentials linked.');
  }

  const linkedUserSnapshot = await get(ref(db, `employees/${employeeId}/userId`));
  if (linkedUserSnapshot.exists()) {
    throw new Error('This employee already has login credentials linked.');
  }

  const existingAuth = await lookupUserByEmail(trimmedEmail);
  if (!existingAuth && password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  let uid: string;

  if (existingAuth) {
    const profileSnapshot = await get(ref(db, `users/${existingAuth.uid}`));
    if (profileSnapshot.exists()) {
      throw new Error('This email is already linked to another team profile.');
    }
    uid = existingAuth.uid;
  } else {
    const created = await createUserAccount(
      trimmedEmail,
      password,
      trimmedName,
      'employee',
    );
    uid = created.uid;
  }

  const userProfile: UserProfile = {
    uid,
    email: trimmedEmail,
    displayName: trimmedName,
    role: 'employee',
    accountStatus: 'verified',
    employeeId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await set(ref(db, `users/${uid}`), serializeUserForDatabase(userProfile));
  await set(ref(db, `employees/${employeeId}/userId`), uid);
  await set(ref(db, `employees/${employeeId}/updatedAt`), Date.now());

  if (!employee.email?.trim()) {
    await set(ref(db, `employees/${employeeId}/email`), trimmedEmail);
  }

  return userProfile;
}
