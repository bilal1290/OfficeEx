import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthFooterLink, AuthShell } from '../components/auth/AuthShell';
import { AuthDivider, GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function LoginPage() {
  const { login, user, profile, loading, isVerifiedEmployee } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your workspace with email or Google"
      footer={
        <AuthFooterLink
          prompt="New here?"
          linkLabel="Create an account"
          to="/register"
        />
      }
    >
      <GoogleSignInButton onError={setError} />

      <AuthDivider />

      <form onSubmit={handleSubmit} className="auth-form">
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
          autoComplete="current-password"
        />
        {error && <p className="auth-error">{error}</p>}
        <Button type="submit" disabled={submitting} className="auth-submit">
          {submitting ? 'Signing in...' : 'Continue'}
        </Button>
      </form>
    </AuthShell>
  );
}
