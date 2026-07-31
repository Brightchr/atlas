import { createBrowserRouter } from 'react-router';
import { ErrorPage } from '@/components/ErrorPage';
import { AppLayout } from '@/app/layout/AppLayout';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { AdminPage } from '@/features/admin/pages/AdminPage';
import { SignInPage } from '@/features/auth/pages/SignInPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { GoalsPage } from '@/features/goals/pages/GoalsPage';
import { ExerciseListPage } from '@/features/exercises/pages/ExerciseListPage';
import { ExerciseDetailPage } from '@/features/exercises/pages/ExerciseDetailPage';
import { WorkoutsPage } from '@/features/workouts/pages/WorkoutsPage';
import { NutritionPage } from '@/features/nutrition/pages/NutritionPage';
import { PlansPage } from '@/features/plans/pages/PlansPage';
import { ShoppingPage } from '@/features/shopping/pages/ShoppingPage';

export const router = createBrowserRouter([
  // Public: the only page reachable without a session.
  { path: '/signin', element: <SignInPage />, errorElement: <ErrorPage /> },
  // Everything else is an authenticated space.
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/admin', element: <AdminPage /> },
      { path: '/exercises', element: <ExerciseListPage /> },
      { path: '/exercises/:id', element: <ExerciseDetailPage /> },
      { path: '/goals', element: <GoalsPage /> },
      { path: '/workouts', element: <WorkoutsPage /> },
      { path: '/nutrition', element: <NutritionPage /> },
      { path: '/plans', element: <PlansPage /> },
      { path: '/shopping', element: <ShoppingPage /> },
    ],
  },
]);
