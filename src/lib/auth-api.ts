import { ref, set } from 'firebase/database';
import { db, firebaseConfig } from './firebase';
import type { UserProfile, UserRole } from '../types';

interface CreateAuthUserResponse {
  localId: string;
  idToken: string;
}

interface AuthErrorResponse {
  error?: { message?: string };
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
    const message =
      'error' in payload ? payload.error?.message : 'Failed to create user';
    throw new Error(message ?? 'Failed to create user');
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
