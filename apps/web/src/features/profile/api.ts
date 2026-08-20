import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

/** Banner presets — the id is what's stored; the CSS lives client-side so
 * new looks never need a migration. */
export const BANNERS = [
  { id: 'indigo', label: 'Indigo Night', css: 'linear-gradient(120deg, #4f46e5, #a78bfa)' },
  { id: 'tide', label: 'Tide', css: 'linear-gradient(120deg, #0d9488, #38bdf8)' },
  { id: 'ember', label: 'Ember', css: 'linear-gradient(120deg, #f59e0b, #ef4444)' },
  { id: 'meadow', label: 'Meadow', css: 'linear-gradient(120deg, #047857, #84cc16)' },
  { id: 'sunset', label: 'Sunset', css: 'linear-gradient(120deg, #7c3aed, #ec4899, #f59e0b)' },
  { id: 'mono', label: 'Mono', css: 'linear-gradient(120deg, #1f2937, #4b5563)' },
] as const;

export const bannerCss = (id: string): string =>
  BANNERS.find((b) => b.id === id)?.css ?? BANNERS[0].css;

export interface SharedGoal {
  title: string;
  label: string;
  pct: number;
}

export interface ProfileDoc {
  bannerId: string;
  avatarEmoji: string;
  show: {
    plans: boolean;
    stats: boolean;
    reviews: boolean;
    activity: boolean;
    goals: boolean;
  };
  sharedGoals: SharedGoal[];
}

export interface MyProfile {
  username: string;
  email: string;
  displayName: string | null;
  bio: string;
  memberSince: string;
  profile: ProfileDoc;
}

export interface PublicPlanCard {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  goal: string;
  diet: string | null;
  rating: number | null;
  reviewCount: number;
  updatedAt: string;
}

export interface PublicProfile {
  username: string;
  displayName: string | null;
  bio: string;
  memberSince: string;
  bannerId: string;
  avatarEmoji: string;
  stats: { rating: number | null; reviewCount: number; planCount: number } | null;
  plans: PublicPlanCard[];
  reviews: {
    id: string;
    rating: number;
    comment: string;
    planId: string;
    planName: string;
    updatedAt: string;
  }[];
  activity: { kind: 'plan' | 'review'; title: string; detail: string; at: string }[];
  goals: SharedGoal[];
}

export function useMyProfile() {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiFetch<MyProfile>('/v1/profiles/me'),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { displayName?: string | null; bio?: string; profile?: ProfileDoc }) =>
      apiFetch('/v1/profiles/me', { method: 'PATCH', body: JSON.stringify(args) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export function usePublicProfile(username: string | undefined) {
  return useQuery({
    queryKey: ['profile', 'public', username],
    queryFn: () => apiFetch<PublicProfile>(`/v1/profiles/${username}`),
    enabled: Boolean(username),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (args: { currentPassword: string; newPassword: string }) =>
      apiFetch('/v1/auth/change-password', { method: 'POST', body: JSON.stringify(args) }),
  });
}
