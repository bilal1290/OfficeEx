import { NavLink } from 'react-router-dom';
import {
  Building2,
  DollarSign,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  Wallet,
  BadgeDollarSign,
} from 'lucide-react';
import { useUsers } from '../../hooks/useUsers';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../lib/permissions';
import { clsx } from '../../lib/utils';
import { UserAvatar } from '../ui/UserAvatar';

export function Sidebar() {
  const { profile, permissions, isPendingApproval } = useAuth();
  const { pendingCount } = useUsers();

  const navItems = [
    {
      to: '/my-salary',
      icon: BadgeDollarSign,
      label: 'My Portal',
        show: permissions.canAccessEmployeePortal,
    },
    {
      to: '/',
      icon: LayoutDashboard,
      label: 'Dashboard',
      end: true,
      show: permissions.canViewIncomeOnDashboard,
    },
    {
      to: '/income',
      icon: DollarSign,
      label: 'Project Income',
      show: permissions.canViewIncome,
    },
    {
      to: '/expenses',
      icon: Wallet,
      label: 'My Expenses',
      show: permissions.canManageOwnerExpenses,
    },
    {
      to: '/office-expenses',
      icon: Building2,
      label: 'Office Expenses',
      show: permissions.canAccessOfficeExpenses,
    },
    {
      to: '/transactions',
      icon: Receipt,
      label: 'Transactions',
      show: permissions.canViewExpenseTransactions,
    },
    {
      to: '/users',
      icon: Users,
      label: 'Users',
      show: permissions.canManageUsers,
    },
    {
      to: '/settings',
      icon: Settings,
      label: 'Settings',
      show: !isPendingApproval,
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">OE</div>
        <div>
          <h1 className="sidebar-title">OfficeEx</h1>
          <p className="sidebar-tagline">Finance Manager</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems
          .filter((item) => item.show)
          .map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx('sidebar-link', isActive && 'sidebar-link-active')
              }
            >
              <Icon size={20} />
              <span>{label}</span>
              {to === '/users' && pendingCount > 0 && (
                <span className="nav-pending-badge">{pendingCount}</span>
              )}
            </NavLink>
          ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          {profile ? (
            <UserAvatar user={profile} size="md" />
          ) : (
            <div className="sidebar-avatar">U</div>
          )}
          <div>
            <p className="sidebar-user-name">{profile?.displayName}</p>
            <p className="sidebar-user-role">
              {profile?.role ? getRoleLabel(profile.role) : 'User'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
