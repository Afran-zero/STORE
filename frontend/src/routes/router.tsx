import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute, RoleGuard } from '@/routes/guards';
import { LoginPage } from '@/pages/login-page';
import { RegisterPage } from '@/pages/register-page';
import { ForgotPasswordPage } from '@/pages/forgot-password-page';
import { ResetPasswordPage } from '@/pages/reset-password-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { StoresPage } from '@/pages/stores-page';
import { EmployeesPage } from '@/pages/employees-page';
import { InventoryPage } from '@/pages/inventory-page';
import { RecipesPage } from '@/pages/recipes-page';
import { FoodPage } from '@/pages/food-page';
import { AssignmentsPage } from '@/pages/assignments-page';
import { AttendancePage } from '@/pages/attendance-page';
import { SalesPage } from '@/pages/sales-page';
import { ReportsPage } from '@/pages/reports-page';
import { AnalyticsPage } from '@/pages/analytics-page';
import { TicketsPage } from '@/pages/tickets-page';
import { NotificationsPage } from '@/pages/notifications-page';
import { SettingsPage } from '@/pages/settings-page';
import { ProfilePage } from '@/pages/profile-page';
import { AiAssistantPage } from '@/pages/ai-assistant-page';
import { HelpPage } from '@/pages/help-page';
import { SupportPage } from '@/pages/support-page';
import { ForbiddenPage } from '@/pages/forbidden-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { MaintenancePage } from '@/pages/maintenance-page';

function Shell({ children }: { children: JSX.Element }): JSX.Element {
  return <AppShell>{children}</AppShell>;
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/403', element: <ForbiddenPage /> },
  { path: '/maintenance', element: <MaintenancePage /> },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <Shell>
          <DashboardPage />
        </Shell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/stores',
    element: (
      <ProtectedRoute>
        <Shell>
          <StoresPage />
        </Shell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/employees',
    element: (
      <ProtectedRoute>
        <Shell>
          <RoleGuard roles={['OWNER', 'MANAGER']}>
            <EmployeesPage />
          </RoleGuard>
        </Shell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/inventory',
    element: (
      <ProtectedRoute>
        <Shell>
          <InventoryPage />
        </Shell>
      </ProtectedRoute>
    ),
  },
  { path: '/recipes', element: <ProtectedRoute><Shell><RecipesPage /></Shell></ProtectedRoute> },
  { path: '/menu', element: <ProtectedRoute><Shell><FoodPage /></Shell></ProtectedRoute> },
  { path: '/assignments', element: <ProtectedRoute><Shell><AssignmentsPage /></Shell></ProtectedRoute> },
  { path: '/attendance', element: <ProtectedRoute><Shell><AttendancePage /></Shell></ProtectedRoute> },
  { path: '/sales', element: <ProtectedRoute><Shell><SalesPage /></Shell></ProtectedRoute> },
  { path: '/reports', element: <ProtectedRoute><Shell><ReportsPage /></Shell></ProtectedRoute> },
  { path: '/analytics', element: <ProtectedRoute><Shell><AnalyticsPage /></Shell></ProtectedRoute> },
  { path: '/tickets', element: <ProtectedRoute><Shell><TicketsPage /></Shell></ProtectedRoute> },
  { path: '/notifications', element: <ProtectedRoute><Shell><NotificationsPage /></Shell></ProtectedRoute> },
  { path: '/settings', element: <ProtectedRoute><Shell><SettingsPage /></Shell></ProtectedRoute> },
  { path: '/profile', element: <ProtectedRoute><Shell><ProfilePage /></Shell></ProtectedRoute> },
  { path: '/ai-assistant', element: <ProtectedRoute><Shell><AiAssistantPage /></Shell></ProtectedRoute> },
  { path: '/help', element: <HelpPage /> },
  { path: '/support', element: <SupportPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
