/** What a report can point at. 'other' carries free text in targetId (e.g. a
 * URL) — the escape hatch until more entities become reportable. */
export type ReportTargetType = 'user' | 'plan' | 'review' | 'other';

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'cheating' | 'other';

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam or advertising',
  harassment: 'Harassment or bullying',
  inappropriate: 'Inappropriate content',
  cheating: 'Fake or misleading stats',
  other: 'Something else',
};

/** Shape the admin moderation queue works with. */
export interface AdminReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  /** Resolved display label (e.g. the reported user's name), when available. */
  targetLabel: string | null;
  reason: ReportReason;
  detail: string;
  status: ReportStatus;
  reporter: string | null;
  createdAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string;
}
