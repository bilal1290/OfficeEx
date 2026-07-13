import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { permissions, loading } = useAuth();

  if (loading) return null;

  if (!permissions.canManageUsers) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function IncomeRoute() {
  const { permissions, loading } = useAuth();

  if (loading) return null;

  if (!permissions.canViewIncome) {
    return <Navigate to="/office-expenses" replace />;
  }

  return <Outlet />;
}

export function OfficeExpensesRoute() {
  const { permissions, loading } = useAuth();

  if (loading) return null;

  if (!permissions.canAccessOfficeExpenses) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function OwnerExpensesRoute() {
  const { permissions, loading } = useAuth();

  if (loading) return null;

  if (!permissions.canManageOwnerExpenses) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function HomeRoute() {
  const { permissions, loading } = useAuth();

  if (loading) return null;

  if (permissions.canViewIncomeOnDashboard) {
    return <Outlet />;
  }

  return <Navigate to="/office-expenses" replace />;
}
