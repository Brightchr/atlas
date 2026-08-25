import { useMutation } from '@tanstack/react-query';
import type { ReportReason, ReportTargetType } from '@arcadia/shared';
import { apiFetch } from '@/lib/api';

export interface ReportInput {
  targetType: ReportTargetType;
  /** Username for 'user' targets; entity id otherwise. */
  targetId: string;
  reason: ReportReason;
  detail: string;
}

export function useCreateReport() {
  return useMutation({
    mutationFn: (input: ReportInput) =>
      apiFetch<{ ok: boolean }>('/v1/reports', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}
