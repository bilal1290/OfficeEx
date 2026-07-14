import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import type { RegistrationKind } from './account-status';

interface NotifyAdminRegistrationRequest {
  displayName: string;
  email: string;
  registrationKind: RegistrationKind;
}

interface NotifyAdminRegistrationResponse {
  success: boolean;
  notified: number;
}

export async function notifyAdminsOfRegistration(
  payload: NotifyAdminRegistrationRequest,
): Promise<void> {
  if (!app) return;

  try {
    const functions = getFunctions(app);
    const notifyAdminNewRegistration = httpsCallable<
      NotifyAdminRegistrationRequest,
      NotifyAdminRegistrationResponse
    >(functions, 'notifyAdminNewRegistration');
    await notifyAdminNewRegistration(payload);
  } catch (error) {
    console.warn('Could not notify administrators about new registration:', error);
  }
}
