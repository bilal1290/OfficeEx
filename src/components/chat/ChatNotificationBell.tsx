import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatNotifications } from '../../context/ChatNotificationContext';
import { formatChatTime } from '../../lib/datetime';
import { clsx } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';

export function ChatNotificationBell() {
  const {
    notifications,
    unreadCount,
    loading,
    desktopNotificationsEnabled,
    canEnableDesktopNotifications,
    markAllRead,
    openNotification,
    enableDesktopNotifications,
    refreshNotifications,
  } = useChatNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="chat-notif-bell" ref={panelRef}>
      <Tooltip label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          aria-expanded={open}
          onClick={() => {
            setOpen((current) => !current);
            if (!open) {
              void refreshNotifications();
            }
          }}
          className="chat-notif-bell-btn"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="chat-notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </Button>
      </Tooltip>

      {open && (
        <div className="chat-notif-panel">
          <div className="chat-notif-panel-head">
            <h3>Notifications</h3>
            <div className="chat-notif-panel-actions">
              {unreadCount > 0 && (
                <Tooltip label="Mark all notifications as read">
                  <button
                    type="button"
                    className="chat-notif-mark-all"
                    aria-label="Mark all notifications as read"
                    onClick={() => void markAllRead()}
                  >
                    <CheckCheck size={14} />
                    Mark all read
                  </button>
                </Tooltip>
              )}
            </div>
          </div>

          {canEnableDesktopNotifications && !desktopNotificationsEnabled && (
            <div className="chat-notif-enable-desktop">
              <p>Get alerts when you&apos;re in another tab.</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void enableDesktopNotifications()}
              >
                Enable desktop alerts
              </Button>
            </div>
          )}

          <ul className="chat-notif-list">
            {loading && notifications.length === 0 ? (
              <li className="chat-notif-empty">Loading…</li>
            ) : notifications.length === 0 ? (
              <li className="chat-notif-empty">No notifications yet.</li>
            ) : (
              notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={clsx(
                      'chat-notif-item',
                      !notification.readAt && 'chat-notif-item-unread',
                    )}
                    onClick={() => {
                      openNotification(notification);
                      setOpen(false);
                    }}
                  >
                    <span className="chat-notif-item-icon">
                      <MessageCircle size={16} />
                    </span>
                    <span className="chat-notif-item-body">
                      <span className="chat-notif-item-title">
                        {notification.type === 'mention'
                          ? `${notification.senderName} mentioned you`
                          : `${notification.senderName}`}
                      </span>
                      <span className="chat-notif-item-preview">{notification.preview}</span>
                      <span className="chat-notif-item-time">
                        {formatChatTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="chat-notif-panel-foot">
            <Tooltip label="Go to Messages">
              <button
                type="button"
                className="chat-notif-open-chat"
                aria-label="Open Messages"
                onClick={() => {
                  navigate('/chat');
                  setOpen(false);
                }}
              >
                Open Messages
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}
