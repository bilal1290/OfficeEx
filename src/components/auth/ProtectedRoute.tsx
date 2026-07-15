import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PendingVerificationPage } from '../../pages/PendingVerificationPage';
import { getDefaultRoute } from '../../lib/routing';

function RouteLoader() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  );
}

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

  return <Outlet />;
}

function redirectForPermissions(
  permissions: ReturnType<typeof useAuth>['permissions'],
  isVerifiedEmployee: boolean,
) {
  return (
    <Navigate
      to={getDefaultRoute(permissions, { isVerifiedEmployee, skipDashboard: true })}
      replace
    />
  );
}

export function AdminRoute() {
  const { permissions, loading } = useAuth();

  if (loading) return <RouteLoader />;

  if (!permissions.canManageUsers) {
    return redirectForPermissions(permissions, false);
  }

  return <Outlet />;
}

export function IncomeRoute() {
  const { permissions, loading, isVerifiedEmployee } = useAuth();

  if (loading) return <RouteLoader />;

  if (!permissions.canViewIncome) {
    return redirectForPermissions(permissions, isVerifiedEmployee);
  }

  return <Outlet />;
}

export function OfficeExpensesRoute() {
  const { permissions, loading, isVerifiedEmployee } = useAuth();

  if (loading) return <RouteLoader />;

  if (!permissions.canAccessOfficeExpenses) {
    return redirectForPermissions(permissions, isVerifiedEmployee);
  }

  return <Outlet />;
}

export function OwnerExpensesRoute() {
  const { permissions, loading, isVerifiedEmployee } = useAuth();

  if (loading) return <RouteLoader />;

  if (!permissions.canManageOwnerExpenses) {
    return redirectForPermissions(permissions, isVerifiedEmployee);
  }

  return <Outlet />;
}

export function TransactionsRoute() {
  const { permissions, loading, isVerifiedEmployee } = useAuth();

  if (loading) return <RouteLoader />;

  if (!permissions.canViewExpenseTransactions) {
    return redirectForPermissions(permissions, isVerifiedEmployee);
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

  return (
    <Navigate
      to={getDefaultRoute(permissions, { skipDashboard: true })}
      replace
    />
  );
}

export function EmployeePortalRoute() {
  const { permissions, loading, profile } = useAuth();

  if (loading) return <RouteLoader />;

  if (!permissions.canAccessEmployeePortal) {
    if (profile?.accountStatus === 'pending' || profile?.accountStatus === 'rejected') {
      return <Navigate to="/pending" replace />;
    }
    return <Navigate to="/settings" replace />;
  }

  return <Outlet />;
}

export function ChatRoute() {
  const { permissions, loading, isVerifiedEmployee } = useAuth();

  if (loading) return <RouteLoader />;

  if (!permissions.canAccessChat) {
    return (
      <Navigate
        to={getDefaultRoute(permissions, { isVerifiedEmployee, skipDashboard: true })}
        replace
      />
    );
  }

  return <Outlet />;
}
