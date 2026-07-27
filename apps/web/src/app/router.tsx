import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/app/layout/AppLayout';
import { AdminPage } from '@/features/admin/pages/AdminPage';
import { SignInPage } from '@/features/auth/pages/SignInPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { ExerciseListPage } from '@/features/exercises/pages/ExerciseListPage';
import { ExerciseDetailPage } from '@/features/exercises/pages/ExerciseDetailPage';
import { WorkoutsPage } from '@/features/workouts/pages/WorkoutsPage';
import { NutritionPage } from '@/features/nutrition/pages/NutritionPage';
import { PlansPage } from '@/features/plans/pages/PlansPage';
import { ShoppingPage } from '@/features/shopping/pages/ShoppingPage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/signin', element: <SignInPage /> },
      { path: '/admin', element: <AdminPage /> },
      { path: '/exercises', element: <ExerciseListPage /> },
      { path: '/exercises/:id', element: <ExerciseDetailPage /> },
      { path: '/workouts', element: <WorkoutsPage /> },
      { path: '/nutrition', element: <NutritionPage /> },
      { path: '/plans', element: <PlansPage /> },
      { path: '/shopping', element: <ShoppingPage /> },
    ],
  },
]);
