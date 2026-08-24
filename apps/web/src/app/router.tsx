import { createBrowserRouter, Navigate } from 'react-router';
import { ErrorPage } from '@/components/ErrorPage';
import { AppLayout } from '@/app/layout/AppLayout';
import { EatLayout, TrainLayout, YouLayout } from '@/app/layout/SectionLayouts';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { AdminPage } from '@/features/admin/pages/AdminPage';
import { SignInPage } from '@/features/auth/pages/SignInPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { GoalsPage } from '@/features/goals/pages/GoalsPage';
import { ExerciseListPage } from '@/features/exercises/pages/ExerciseListPage';
import { ExerciseDetailPage } from '@/features/exercises/pages/ExerciseDetailPage';
import { WorkoutsPage } from '@/features/workouts/pages/WorkoutsPage';
import { WorkoutDetailPage } from '@/features/workouts/pages/WorkoutDetailPage';
import { WorkoutSessionPage } from '@/features/workouts/pages/WorkoutSessionPage';
import { MealPlanPage } from '@/features/nutrition/pages/MealPlanPage';
import { NutritionPage } from '@/features/nutrition/pages/NutritionPage';
import { RecipesPage } from '@/features/nutrition/pages/RecipesPage';
import { RecipeDetailPage } from '@/features/nutrition/pages/RecipeDetailPage';
import { PlanDetailPage } from '@/features/plans/pages/PlanDetailPage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';
import { ShoppingPage } from '@/features/shopping/pages/ShoppingPage';
import { TrainingDashboardPage } from '@/features/training/pages/TrainingDashboardPage';
import { ExplorePage } from '@/features/training/pages/ExplorePage';
import { CatalogWorkoutPage } from '@/features/training/pages/CatalogWorkoutPage';
import { CatalogPlanPage } from '@/features/training/pages/CatalogPlanPage';
import { ProgressPage } from '@/features/training/pages/ProgressPage';
import { SchedulePage } from '@/features/training/pages/SchedulePage';
import { SessionDetailPage } from '@/features/training/pages/SessionDetailPage';
import { WelcomePage } from '@/features/training/pages/WelcomePage';
import { ProfilePage } from '@/features/profile/pages/ProfilePage';
import { PublicProfilePage } from '@/features/profile/pages/PublicProfilePage';

/** The 4-tab shell: Home (/), Train, Eat, You. Every screen lives inside one
 * of the three section layouts (or the dashboard), so section chrome
 * persists through every drill-down. Old paths redirect so bookmarks,
 * notifications, and muscle memory keep working. */
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
      { path: '/welcome', element: <WelcomePage /> },
      { path: '/admin', element: <AdminPage /> },

      {
        element: <TrainLayout />,
        children: [
          { path: '/train', element: <TrainingDashboardPage /> },
          { path: '/train/schedule', element: <SchedulePage /> },
          { path: '/train/library', element: <WorkoutsPage /> },
          { path: '/train/explore', element: <ExplorePage /> },
          { path: '/train/explore/workout/:key', element: <CatalogWorkoutPage /> },
          { path: '/train/explore/plan/:key', element: <CatalogPlanPage /> },
          { path: '/workouts/:id', element: <WorkoutDetailPage /> },
          { path: '/workouts/session/:sessionId', element: <WorkoutSessionPage /> },
          { path: '/exercises', element: <ExerciseListPage /> },
          { path: '/exercises/:id', element: <ExerciseDetailPage /> },
          { path: '/plans/community/:id', element: <PlanDetailPage /> },
        ],
      },

      {
        element: <EatLayout />,
        children: [
          { path: '/eat', element: <NutritionPage /> },
          { path: '/eat/meal-plan', element: <MealPlanPage /> },
          { path: '/eat/recipes', element: <RecipesPage /> },
          { path: '/eat/recipes/:id', element: <RecipeDetailPage /> },
          { path: '/eat/shopping', element: <ShoppingPage /> },
        ],
      },

      {
        element: <YouLayout />,
        children: [
          { path: '/you', element: <ProgressPage /> },
          { path: '/you/goals', element: <GoalsPage /> },
          { path: '/you/history/:sessionId', element: <SessionDetailPage /> },
        ],
      },

      // Account pages live under the top-bar avatar menu, outside any section.
      { path: '/profile', element: <ProfilePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/users/:username', element: <PublicProfilePage /> },

      // Legacy paths from the pre-redesign IA.
      { path: '/training', element: <Navigate to="/train" replace /> },
      { path: '/training/explore', element: <Navigate to="/train/explore" replace /> },
      { path: '/training/progress', element: <Navigate to="/you" replace /> },
      { path: '/plans', element: <Navigate to="/train/schedule" replace /> },
      { path: '/workouts', element: <Navigate to="/train/library" replace /> },
      { path: '/nutrition', element: <Navigate to="/eat" replace /> },
      { path: '/nutrition/meal-plan', element: <Navigate to="/eat/meal-plan" replace /> },
      { path: '/nutrition/recipes', element: <Navigate to="/eat/recipes" replace /> },
      { path: '/shopping', element: <Navigate to="/eat/shopping" replace /> },
      { path: '/goals', element: <Navigate to="/you/goals" replace /> },
      { path: '/you/profile', element: <Navigate to="/profile" replace /> },
      { path: '/you/settings', element: <Navigate to="/settings" replace /> },
    ],
  },
]);
