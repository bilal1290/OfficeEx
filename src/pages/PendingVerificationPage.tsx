import { Clock3, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

export function PendingVerificationPage() {
  const { profile, logout } = useAuth();

  const isRejected = profile?.accountStatus === 'rejected';
  const isEmployee = profile?.role === 'employee';

  return (
    <div className="pending-page">
      <div className="pending-card">
        <div className={`pending-icon ${isRejected ? 'rejected' : ''}`}>
          {isRejected ? <ShieldAlert size={28} /> : <Clock3 size={28} />}
        </div>
        <h1>{isRejected ? 'Access not approved' : 'Verification pending'}</h1>
        <p className="pending-lead">
          {isRejected
            ? 'Your access request was declined. Contact your administrator if you believe this is a mistake.'
            : isEmployee
              ? 'Your employee account is waiting for administrator approval. Once verified and linked to your payroll record, you can view salary breakdowns including leaves and bonuses.'
              : 'Your account is waiting for administrator approval. An admin will assign your role and grant access to the workspace.'}
        </p>

        {!isRejected && (
          <ul className="pending-steps">
            <li>Sign in completed</li>
            <li>Administrator reviews your registration</li>
            <li>
              {isEmployee
                ? 'Salary breakdown becomes available after payroll linking'
                : 'Workspace access is granted after role assignment'}
            </li>
          </ul>
        )}

        <div className="pending-actions">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Check again
          </Button>
          <Button variant="ghost" onClick={() => logout()}>
            <LogOut size={16} />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
