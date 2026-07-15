import { X } from 'lucide-react';
import { useChatNotifications } from '../../context/ChatNotificationContext';

export function ChatToastStack() {
  const { toasts, openNotification, dismissToast, notifications } = useChatNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="chat-toast-stack" aria-live="polite">
      {toasts.map((toast) => {
        const notification = notifications.find((item) => item.id === toast.notificationId);
        if (!notification) return null;

        return (
          <div key={toast.id} className="chat-toast">
            <button
              type="button"
              className="chat-toast-main"
              aria-label={`Open message from ${toast.title}`}
              onClick={() => openNotification(notification)}
            >
              <strong>{toast.title}</strong>
              <span>{toast.body}</span>
            </button>
            <button
              type="button"
              className="chat-toast-close"
              aria-label="Dismiss"
              onClick={() => dismissToast(toast.id)}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
