import { Capacitor } from '@capacitor/core';
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
} from 'firebase/auth';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle(auth: Auth): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await signInWithRedirect(auth, provider);
    return;
  }

  await signInWithPopup(auth, provider);
}

export async function completeGoogleRedirectSignIn(auth: Auth): Promise<void> {
  await getRedirectResult(auth);
}

export function getGoogleAuthErrorMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: string }).code)
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Google sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled. Enable it in Firebase Console or run: npx firebase-tools deploy --only auth';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method. Use email/password instead.';
    default:
      return error instanceof Error
        ? error.message
        : 'Google sign-in failed. Please try again.';
  }
}
