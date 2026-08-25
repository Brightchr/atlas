import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FriendsResponse, GroupDetail, GroupSummary } from '@arcadia/shared';
import { apiFetch } from '@/lib/api';

/** React-query surface for the friends system. All server-backed — nothing
 * here touches the local database. */

export function useFriends() {
  return useQuery({
    queryKey: ['social', 'friends'],
    queryFn: () => apiFetch<FriendsResponse>('/v1/friends'),
    retry: 1,
  });
}

export function useGroups() {
  return useQuery({
    queryKey: ['social', 'groups'],
    queryFn: () => apiFetch<{ groups: GroupSummary[] }>('/v1/groups'),
    retry: 1,
  });
}

export function useGroup(id: string | undefined) {
  return useQuery({
    queryKey: ['social', 'groups', id],
    queryFn: () => apiFetch<GroupDetail>(`/v1/groups/${id}`),
    enabled: Boolean(id),
    retry: 1,
  });
}

function useSocialMutation<TArgs, TResult = unknown>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['social'] }),
  });
}

export const useSendFriendRequest = () =>
  useSocialMutation((username: string) =>
    apiFetch<{ ok: boolean; accepted: boolean }>('/v1/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  );

export const useAcceptRequest = () =>
  useSocialMutation((id: string) =>
    apiFetch(`/v1/friends/requests/${id}/accept`, { method: 'POST' }),
  );

export const useDeclineRequest = () =>
  useSocialMutation((id: string) =>
    apiFetch(`/v1/friends/requests/${id}/decline`, { method: 'POST' }),
  );

export const useCancelRequest = () =>
  useSocialMutation((id: string) => apiFetch(`/v1/friends/requests/${id}`, { method: 'DELETE' }));

export const useUnfriend = () =>
  useSocialMutation((userId: string) => apiFetch(`/v1/friends/${userId}`, { method: 'DELETE' }));

export const useSetFriendSharing = () =>
  useSocialMutation((args: { userId: string; enabled: boolean }) =>
    apiFetch(`/v1/friends/${args.userId}/sharing`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: args.enabled }),
    }),
  );

export const useCreateGroup = () =>
  useSocialMutation((name: string) =>
    apiFetch<{ ok: boolean; id: string }>('/v1/groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  );

export const useInviteToGroup = () =>
  useSocialMutation((args: { groupId: string; username: string }) =>
    apiFetch(`/v1/groups/${args.groupId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ username: args.username }),
    }),
  );

export const useJoinGroup = () =>
  useSocialMutation((groupId: string) => apiFetch(`/v1/groups/${groupId}/join`, { method: 'POST' }));

export const useDeclineGroupInvite = () =>
  useSocialMutation((groupId: string) =>
    apiFetch(`/v1/groups/${groupId}/decline`, { method: 'POST' }),
  );

export const useLeaveGroup = () =>
  useSocialMutation((groupId: string) =>
    apiFetch(`/v1/groups/${groupId}/members/me`, { method: 'DELETE' }),
  );

export const useDeleteGroup = () =>
  useSocialMutation((groupId: string) => apiFetch(`/v1/groups/${groupId}`, { method: 'DELETE' }));

export const useSetGroupSharing = () =>
  useSocialMutation((args: { groupId: string; enabled: boolean }) =>
    apiFetch(`/v1/groups/${args.groupId}/sharing`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: args.enabled }),
    }),
  );
