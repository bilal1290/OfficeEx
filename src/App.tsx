import { Capacitor } from '@capacitor/core';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { FilterProvider } from './context/FilterContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { AppLayout } from './components/layout/AppLayout';
import {
  AdminRoute,
  HomeRoute,
  IncomeRoute,
  OfficeExpensesRoute,
  OwnerExpensesRoute,
  ProtectedRoute,
} from './components/auth/ProtectedRoute';
import { SetupRequired } from './components/SetupRequired';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { IncomePage } from './pages/IncomePage';
import { ExpensesPage } from './pages/ExpensesPage';
import { OfficeExpensesPage } from './pages/OfficeExpensesPage';
import { UsersPage } from './pages/UsersPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { isFirebaseConfigured } from './lib/firebase';

const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

export default function App() {
  if (!isFirebaseConfigured) {
    return (
      <ThemeProvider>
        <SetupRequired />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <CurrencyProvider>
          <FilterProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route element={<HomeRoute />}>
                    <Route index element={<DashboardPage />} />
                  </Route>
                  <Route element={<IncomeRoute />}>
                    <Route path="income" element={<IncomePage />} />
                  </Route>
                  <Route element={<OwnerExpensesRoute />}>
                    <Route path="expenses" element={<ExpensesPage />} />
                  </Route>
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route element={<AdminRoute />}>
                    <Route path="users" element={<UsersPage />} />
                  </Route>
                  <Route element={<OfficeExpensesRoute />}>
                    <Route path="office-expenses" element={<OfficeExpensesPage />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
          </FilterProvider>
        </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
