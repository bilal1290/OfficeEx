import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PendingVerificationPage } from '../../pages/PendingVerificationPage';

function RouteLoader() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  );
}

const VERIFIED_EMPLOYEE_PATHS = ['/my-salary', '/settings', '/pending'];

export function ProtectedRoute() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <RouteLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return (
      <div className="setup-page">
        <div className="setup-card">
          <h1>Profile unavailable</h1>
          <p className="setup-lead">
            Your account is signed in but the team profile could not be loaded.
            Ask an administrator to link your account from the Team page.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (profile.accountStatus === 'pending' || profile.accountStatus === 'rejected') {
    if (location.pathname === '/pending') {
      return <Outlet />;
    }
    return <PendingVerificationPage />;
  }

  if (profile.role === 'employee') {
    const allowed = VERIFIED_EMPLOYEE_PATHS.some(
      (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
    );
    if (!allowed) {
      return <Navigate to="/my-salary" replace />;
    }
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { permissions, loading } = useAuth();

  if (loading) return <RouteLoader />;

  if (!permissions.canManageUsers) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function IncomeRoute() {
  const { permissions, loading } = useAuth();

  if (loading) return <RouteLoader />;

  if (!permissions.canViewIncome) {
    return <Navigate to="/office-expenses" replace />;
  }

  return <Outlet />;
}

export function OfficeExpensesRoute() {
  const { permissions, loading } = useAuth();

  if (loading) return <RouteLoader />;

  if (!permissions.canAccessOfficeExpenses) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function OwnerExpensesRoute() {
  const { permissions, loading } = useAuth();

  if (loading) return <RouteLoader />;

  if (!permissions.canManageOwnerExpenses) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function HomeRoute() {
  const { permissions, loading, isVerifiedEmployee } = useAuth();

  if (loading) return <RouteLoader />;

  if (isVerifiedEmployee) {
    return <Navigate to="/my-salary" replace />;
  }

  if (permissions.canViewIncomeOnDashboard) {
    return <Outlet />;
  }

  return <Navigate to="/office-expenses" replace />;
}

export function EmployeePortalRoute() {
  const { permissions, loading } = useAuth();

  if (loading) return <RouteLoader />;

  if (!permissions.canAccessEmployeePortal) {
    return <Navigate to="/pending" replace />;
  }

  return <Outlet />;
}
