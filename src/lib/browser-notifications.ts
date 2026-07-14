const STORAGE_KEY = 'officeex.chat.desktopNotifications';

export function areDesktopNotificationsEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setDesktopNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
}

export function canUseDesktopNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!canUseDesktopNotifications()) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    setDesktopNotificationsEnabled(true);
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    setDesktopNotificationsEnabled(false);
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  setDesktopNotificationsEnabled(permission === 'granted');
  return permission;
}

export function showDesktopNotification(
  title: string,
  options?: NotificationOptions,
): void {
  if (!canUseDesktopNotifications()) return;
  if (!areDesktopNotificationsEnabled()) return;
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;

  try {
    new Notification(title, {
      badge: '/favicon.ico',
      icon: '/favicon.ico',
      ...options,
    });
  } catch {
    // Ignore unsupported environments.
  }
}
