import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ChatNotificationProvider } from '../../context/ChatNotificationContext';
import { clsx } from '../../lib/utils';
import { ChatToastStack } from '../chat/ChatToastStack';
import { TopNav } from './TopNav';

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Overview', subtitle: 'Balance, cash flow, and spends' },
  '/income': { title: 'Project Income', subtitle: 'Track revenue & company share' },
  '/expenses': { title: 'Owner Expenses', subtitle: 'Costs that offset your company share' },
  '/users': { title: 'Team', subtitle: 'Roles, access & project owners' },
  '/office-expenses': { title: 'Office Expenses', subtitle: 'Fixed & operational costs' },
  '/transactions': { title: 'Ledger', subtitle: 'Complete transaction history' },
  '/my-salary': { title: 'Employee portal', subtitle: 'Salary breakdown and daily attendance' },
  '/chat': { title: 'Messages', subtitle: 'Direct chats and groups' },
  '/pending': { title: 'Verification', subtitle: 'Employee access approval' },
  '/settings': { title: 'Preferences', subtitle: 'Account & appearance' },
};

export function AppLayout() {
  const location = useLocation();
  const { profile, permissions } = useAuth();
  const isChatRoute = location.pathname === '/chat';
  const pageInfo = pageTitles[location.pathname] ?? {
    title: 'OfficeEx',
    subtitle: 'Finance Ledger',
  };

  return (
    <ChatNotificationProvider
      firebaseUid={profile?.uid}
      displayName={profile?.displayName ?? 'User'}
      enabled={permissions.canAccessChat}
    >
      <div className="app-shell has-mobile-dock">
        <div className="app-bg-pattern" aria-hidden />
        <TopNav />
        <main className={clsx('app-main', isChatRoute && 'app-main-route-chat')}>
          {!isChatRoute && (
            <div
              className={clsx(
                'page-hero',
                location.pathname === '/' && 'page-hero-compact',
              )}
            >
              <p className="page-eyebrow">OfficeEx · {new Date().getFullYear()}</p>
              <h1 className="page-hero-title">{pageInfo.title}</h1>
              {pageInfo.subtitle && (
                <p className="page-hero-subtitle">{pageInfo.subtitle}</p>
              )}
            </div>
          )}
          <div className={clsx('page-content', isChatRoute && 'page-content-chat')}>
            <Outlet />
          </div>
        </main>
        {permissions.canAccessChat && <ChatToastStack />}
      </div>
    </ChatNotificationProvider>
  );
}
