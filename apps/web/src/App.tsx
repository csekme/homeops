import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/app-shell';
import { RequireAuth } from '@/components/require-auth';
import ActivatePage from '@/pages/activate';
import DashboardPage from '@/pages/dashboard';
import HouseholdPage from '@/pages/household';
import InvitePage from '@/pages/invite';
import LoginPage from '@/pages/login';
import LoginVerifyPage from '@/pages/login-verify';
import { PlaceholderPage } from '@/pages/placeholder';
import RegisterPage from '@/pages/register';
import SettingsPage from '@/pages/settings';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/verify" element={<LoginVerifyPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/activate/:token" element={<ActivatePage />} />
      <Route path="/invite/:token" element={<InvitePage />} />

      {/* Protected app shell */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/household" element={<HouseholdPage />} />
          <Route path="/obligations" element={<PlaceholderPage titleKey="nav.obligations" />} />
          <Route path="/expenses" element={<PlaceholderPage titleKey="nav.expenses" />} />
          <Route path="/services" element={<PlaceholderPage titleKey="nav.services" />} />
          <Route path="/documents" element={<PlaceholderPage titleKey="nav.documents" />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
