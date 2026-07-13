import { LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/Button';

interface HeaderProps {
  title: string;
  subtitle?: string;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export function Header({
  title,
  subtitle,
  mobileMenuOpen,
  onToggleMobileMenu,
}: HeaderProps) {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleMobileMenu}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div>
          <h1 className="header-title">{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="header-actions">
        <Button variant="ghost" size="sm" onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </Button>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut size={18} />
          <span className="hide-mobile">Logout</span>
        </Button>
      </div>
    </header>
  );
}
