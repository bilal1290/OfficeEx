import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ShieldCheck, Wallet } from 'lucide-react';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="auth-shell">
      <aside className="auth-showcase" aria-hidden="false">
        <div className="auth-showcase-inner">
          <div className="auth-showcase-brand">
            <div className="auth-showcase-logo">
              <Building2 size={28} strokeWidth={2} />
            </div>
            <div>
              <p className="auth-showcase-name">OfficeEx</p>
              <p className="auth-showcase-tagline">Finance for modern teams</p>
            </div>
          </div>

          <div className="auth-showcase-copy">
            <h2>Clarity for company money, payroll, and office spend.</h2>
            <p>
              Track income, manage expenses, and give verified employees a transparent
              view of salary breakdowns including leaves and bonuses.
            </p>
          </div>

          <ul className="auth-showcase-points">
            <li>
              <ShieldCheck size={18} />
              Admin-verified employee access
            </li>
            <li>
              <Wallet size={18} />
              Salary breakdown with leave & bonus detail
            </li>
          </ul>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-panel-brand-mobile">
            <div className="auth-showcase-logo">
              <Building2 size={22} strokeWidth={2} />
            </div>
            <span>OfficeEx</span>
          </div>

          <header className="auth-panel-head">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </header>

          {children}

          <footer className="auth-panel-footer">{footer}</footer>
        </div>
      </main>
    </div>
  );
}

export function AuthFooterLink({
  prompt,
  linkLabel,
  to,
}: {
  prompt: string;
  linkLabel: string;
  to: string;
}) {
  return (
    <p className="auth-footer">
      {prompt} <Link to={to}>{linkLabel}</Link>
    </p>
  );
}
