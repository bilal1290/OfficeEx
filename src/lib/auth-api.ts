import { ref, get, set, runTransaction } from 'firebase/database';
import { db, firebaseConfig } from './firebase';
import { sanitizeUserProfile } from './users';
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
    createdAt: Date.now(),
  };

  await set(ref(db, `users/${trimmedUid}`), profile);
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
    createdAt: Date.now(),
  };

  await set(ref(db, `users/${authData.localId}`), profile);
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
    role: isFirstUser ? 'admin' : 'viewer',
    createdAt: Date.now(),
  };

  const result = await runTransaction(userRef, (current) => {
    if (current) {
      return current;
    }
    return profile;
  });

  const saved = sanitizeUserProfile(uid, result.snapshot.val() as UserProfile);
  if (!saved) {
    throw new Error('Failed to save user profile.');
  }
  return saved;
}
