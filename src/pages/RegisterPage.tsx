import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthFooterLink, AuthShell } from '../components/auth/AuthShell';
import { AuthDivider, GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { useAuth } from '../context/AuthContext';
import { getDefaultRoute } from '../lib/routing';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { clsx } from '../lib/utils';

type AccountKind = 'team' | 'employee';

export function RegisterPage() {
  const { register, user, profile, loading, isVerifiedEmployee, permissions } = useAuth();
  const [accountKind, setAccountKind] = useState<AccountKind>('team');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="auth-shell auth-shell-loading">
        <div className="loading-screen">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (user && profile) {
    if (profile.accountStatus === 'pending' || profile.accountStatus === 'rejected') {
      return <Navigate to="/pending" replace />;
    }
    if (profile.role === 'employee') {
      return <Navigate to={isVerifiedEmployee ? '/my-salary' : '/pending'} replace />;
    }
    return <Navigate to={getDefaultRoute(permissions)} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password, displayName, accountKind === 'employee');
    } catch {
      setError('Registration failed. Email may already be in use.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Choose how you will use OfficeEx"
      footer={
        <AuthFooterLink
          prompt="Already registered?"
          linkLabel="Sign in"
          to="/login"
        />
      }
    >
      <div className="auth-kind-toggle" role="tablist" aria-label="Account type">
        <button
          type="button"
          role="tab"
          aria-selected={accountKind === 'team'}
          className={clsx('auth-kind-btn', accountKind === 'team' && 'active')}
          onClick={() => setAccountKind('team')}
        >
          Team member
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={accountKind === 'employee'}
          className={clsx('auth-kind-btn', accountKind === 'employee' && 'active')}
          onClick={() => setAccountKind('employee')}
        >
          Employee
        </button>
      </div>

      <p className="auth-kind-hint">
        {accountKind === 'employee'
          ? 'Employee accounts stay pending until an administrator links you to the payroll roster and verifies access.'
          : 'Team accounts stay pending until an administrator assigns your role and approves access.'}
      </p>

      {accountKind === 'team' && (
        <>
          <GoogleSignInButton label="Sign up with Google" onError={setError} />
          <AuthDivider />
        </>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <Input
          label="Full name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="new-password"
        />
        <Input
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          autoComplete="new-password"
        />
        {error && <p className="auth-error">{error}</p>}
        <Button type="submit" disabled={submitting} className="auth-submit">
          {submitting
            ? 'Creating account...'
            : accountKind === 'employee'
              ? 'Request employee access'
              : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
