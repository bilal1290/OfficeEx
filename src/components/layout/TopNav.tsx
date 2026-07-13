import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  DollarSign,
  Grid3X3,
  LayoutDashboard,
  LogOut,
  Moon,
  Receipt,
  Settings,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getRoleLabel } from '../../lib/permissions';
import { clsx } from '../../lib/utils';
import { Button } from '../ui/Button';
import { UserAvatar } from '../ui/UserAvatar';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  shortLabel: string;
  end?: boolean;
  show: boolean;
  priority: number;
}

const MOBILE_DOCK_SLOTS = 3;

export function TopNav() {
  const { profile, permissions, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [hubOpen, setHubOpen] = useState(false);

  const navItems: NavItem[] = useMemo(
    () => [
      {
        to: '/',
        icon: LayoutDashboard,
        label: 'Overview',
        shortLabel: 'Home',
        end: true,
        show: permissions.canViewIncomeOnDashboard,
        priority: 1,
      },
      {
        to: '/income',
        icon: DollarSign,
        label: 'Income',
        shortLabel: 'Income',
        show: permissions.canViewIncome,
        priority: 2,
      },
      {
        to: '/expenses',
        icon: Wallet,
        label: 'Expenses',
        shortLabel: 'Costs',
        show: permissions.canManageOwnerExpenses,
        priority: 3,
      },
      {
        to: '/office-expenses',
        icon: Building2,
        label: 'Office',
        shortLabel: 'Office',
        show: permissions.canAccessOfficeExpenses,
        priority: 4,
      },
      {
        to: '/transactions',
        icon: Receipt,
        label: 'Ledger',
        shortLabel: 'Ledger',
        show: permissions.canViewExpenseTransactions,
        priority: 5,
      },
      {
        to: '/users',
        icon: Users,
        label: 'Team',
        shortLabel: 'Team',
        show: permissions.canManageUsers,
        priority: 6,
      },
      {
        to: '/settings',
        icon: Settings,
        label: 'Settings',
        shortLabel: 'Settings',
        show: true,
        priority: 7,
      },
    ],
    [permissions],
  );

  const visibleItems = useMemo(
    () =>
      navItems
        .filter((item) => item.show)
        .sort((a, b) => a.priority - b.priority),
    [navItems],
  );

  const needsHub = visibleItems.length > MOBILE_DOCK_SLOTS + 1;
  const dockItems = needsHub
    ? visibleItems.slice(0, MOBILE_DOCK_SLOTS)
    : visibleItems;

  useEffect(() => {
    setHubOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = hubOpen ? 'hidden' : '';
    document.body.classList.toggle('mobile-nav-open', hubOpen);
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('mobile-nav-open');
    };
  }, [hubOpen]);

  const userInitial =
    profile?.displayName?.charAt(0)?.toUpperCase() ?? 'U';

  const profileAvatar = profile ? (
    <UserAvatar user={profile} size="md" />
  ) : (
    <div className="topnav-avatar-mobile" aria-hidden>
      {userInitial}
    </div>
  );

  const mobileDock = createPortal(
    <nav className="mobile-dock" aria-label="Mobile navigation">
      <div className="mobile-dock-inner">
        {dockItems.map(({ to, icon: Icon, shortLabel, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx('mobile-dock-item', isActive && 'mobile-dock-item-active')
            }
          >
            <span className="mobile-dock-icon">
              <Icon size={22} strokeWidth={2} />
            </span>
            <span className="mobile-dock-label">{shortLabel}</span>
          </NavLink>
        ))}

        {needsHub && (
          <button
            type="button"
            className={clsx(
              'mobile-dock-item mobile-dock-item-more',
              hubOpen && 'mobile-dock-item-active',
            )}
            onClick={() => setHubOpen(true)}
            aria-label="Open all pages"
          >
            <span className="mobile-dock-icon">
              <Grid3X3 size={22} strokeWidth={2} />
            </span>
            <span className="mobile-dock-label">All</span>
          </button>
        )}
      </div>
    </nav>,
    document.body,
  );

  const hubPortal =
    hubOpen &&
    createPortal(
      <div
        className="nav-hub"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        onClick={() => setHubOpen(false)}
      >
        <div
          className="nav-hub-shell"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="nav-hub-hero">
            <div className="nav-hub-hero-top">
              <div>
                <p className="nav-hub-eyebrow">OfficeEx</p>
                <h2 className="nav-hub-title">All pages</h2>
              </div>
              <button
                type="button"
                className="nav-hub-close"
                onClick={() => setHubOpen(false)}
                aria-label="Close menu"
              >
                <X size={24} />
              </button>
            </div>
            <div className="nav-hub-user-card">
              {profile ? (
                <UserAvatar user={profile} size="lg" />
              ) : (
                <div className="nav-hub-avatar">{userInitial}</div>
              )}
              <div>
                <p className="nav-hub-user-name">{profile?.displayName}</p>
                <p className="nav-hub-user-role">
                  {profile?.role ? getRoleLabel(profile.role) : 'User'}
                </p>
              </div>
            </div>
          </div>

          <div className="nav-hub-grid">
            {visibleItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx('nav-hub-tile', isActive && 'nav-hub-tile-active')
                }
                onClick={() => setHubOpen(false)}
              >
                <span className="nav-hub-tile-icon">
                  <Icon size={26} strokeWidth={2} />
                </span>
                <span className="nav-hub-tile-label">{label}</span>
              </NavLink>
            ))}
          </div>

          <div className="nav-hub-footer">
            <button type="button" className="nav-hub-logout" onClick={logout}>
              <LogOut size={20} />
              Sign out
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <header className="topnav">
        <div className="topnav-inner">
          <div className="topnav-brand">
            <div className="brand-mark">OE</div>
            <div className="topnav-brand-text">
              <p className="brand-name">OfficeEx</p>
              <p className="brand-tag">Finance Ledger</p>
            </div>
          </div>

          <nav className="topnav-links-desktop" aria-label="Main navigation">
            {visibleItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx('topnav-link', isActive && 'topnav-link-active')
                }
              >
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="topnav-actions">
            <div className="topnav-user topnav-user-desktop">
              {profile && <UserAvatar user={profile} size="sm" className="topnav-user-avatar" />}
              <div>
                <span className="topnav-user-name">{profile?.displayName}</span>
                <span className="topnav-user-role">
                  {profile?.role ? getRoleLabel(profile.role) : 'User'}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              aria-label="Sign out"
              className="topnav-logout-desktop"
            >
              <LogOut size={18} />
            </Button>
            <div className="topnav-avatar-mobile-wrap" aria-hidden>
              {profileAvatar}
            </div>
          </div>
        </div>
      </header>

      {mobileDock}
      {hubPortal}
    </>
  );
}
