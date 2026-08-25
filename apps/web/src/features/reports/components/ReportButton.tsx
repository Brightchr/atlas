import { useState } from 'react';
import { Flag } from 'lucide-react';
import {
  REPORT_REASON_LABELS,
  type ReportReason,
  type ReportTargetType,
} from '@arcadia/shared';
import { useCreateReport } from '../api';

/** A quiet "Report" affordance with an inline reason form — drop it next to
 * any reportable thing (profiles today; plans and reviews can reuse it). */
export function ReportButton({
  targetType,
  targetId,
  label,
}: {
  targetType: ReportTargetType;
  targetId: string;
  /** What the confirmation refers to, e.g. a username. */
  label: string;
}) {
  const report = useCreateReport();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [detail, setDetail] = useState('');

  if (report.isSuccess) {
    return (
      <p className="text-xs font-medium text-emerald-500">
        Thanks — your report on {label} was sent to the moderators.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-rose-500"
      >
        <Flag size={13} aria-hidden />
        Report
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-2 rounded-2xl border border-line bg-elev p-3">
      <p className="text-xs font-semibold">Report {label}</p>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value as ReportReason)}
        className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
        aria-label="Reason"
      >
        {Object.entries(REPORT_REASON_LABELS).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Anything that helps the moderators (optional)"
        maxLength={1000}
        rows={2}
        className="w-full resize-none rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={report.isPending}
          onClick={() => report.mutate({ targetType, targetId, reason, detail: detail.trim() })}
          className="rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-500 transition-colors hover:bg-rose-500/25 disabled:opacity-50"
        >
          Send report
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface"
        >
          Cancel
        </button>
      </div>
      {report.isError && <p className="text-xs text-rose-500">{report.error.message}</p>}
    </div>
  );
}
