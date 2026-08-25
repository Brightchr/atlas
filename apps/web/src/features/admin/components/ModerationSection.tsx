import { useState } from 'react';
import { Flag, Globe, ShieldOff } from 'lucide-react';
import { REPORT_REASON_LABELS, type ReportStatus } from '@arcadia/shared';
import {
  useAdminReports,
  useCreateIpBlock,
  useDeleteIpBlock,
  useIpBlocks,
  useUpdateReport,
} from '../api';

const REPORT_FILTERS: (ReportStatus | 'all')[] = ['open', 'resolved', 'dismissed', 'all'];

function ReportsQueue() {
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const reports = useAdminReports(filter);
  const update = useUpdateReport();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Flag size={18} className="text-accent" aria-hidden />
          Reports
        </h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ReportStatus | 'all')}
          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
          aria-label="Filter reports"
        >
          {REPORT_FILTERS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {reports.data?.reports.length === 0 && (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted shadow-sm">
          No {filter === 'all' ? '' : `${filter} `}reports — all clear.
        </p>
      )}
      <ul className="space-y-2">
        {reports.data?.reports.map((r) => (
          <li key={r.id} className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {REPORT_REASON_LABELS[r.reason]}
                  <span className="ml-2 rounded-full bg-elev px-2 py-0.5 text-xs font-medium text-muted">
                    {r.targetType}: {r.targetLabel ?? r.targetId}
                  </span>
                </p>
                <p className="text-xs text-muted">
                  by {r.reporter ?? 'deleted user'} · {new Date(r.createdAt).toLocaleString()}
                  {r.status !== 'open' &&
                    ` · ${r.status} by ${r.resolvedBy ?? '—'}${r.resolutionNote ? ` — ${r.resolutionNote}` : ''}`}
                </p>
                {r.detail && <p className="mt-1 text-sm">{r.detail}</p>}
              </div>
              {r.status === 'open' ? (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ id: r.id, status: 'resolved', note: '' })}
                    className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ id: r.id, status: 'dismissed', note: '' })}
                    className="rounded-lg bg-elev px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: r.id, status: 'open', note: '' })}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-elev disabled:opacity-50"
                >
                  Reopen
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {update.isError && <p className="text-sm text-rose-500">{update.error.message}</p>}
    </section>
  );
}

function IpBlocksSection() {
  const blocks = useIpBlocks();
  const create = useCreateIpBlock();
  const remove = useDeleteIpBlock();
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState('');

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Globe size={18} className="text-accent" aria-hidden />
        IP blocks
      </h2>
      <p className="text-sm text-muted">
        Blocked addresses are rejected before sign-in — this stops ban evasion via new accounts.
        Careful with shared networks (offices, campuses): one address can be many people.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value.trim())}
          placeholder="IP address"
          className="w-44 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          className="w-56 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <input
          type="number"
          min="1"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Hours"
          className="w-24 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
          aria-label="Hours until the block expires (blank = permanent)"
          title="Hours until the block expires (blank = permanent)"
        />
        <button
          type="button"
          disabled={ip.length < 3 || create.isPending}
          onClick={() =>
            create.mutate(
              {
                ip,
                reason: reason.trim(),
                ...(hours ? { expiresInHours: Number(hours) } : {}),
              },
              {
                onSuccess: () => {
                  setIp('');
                  setReason('');
                  setHours('');
                },
              },
            )
          }
          className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Block
        </button>
      </div>
      {create.isError && <p className="text-sm text-rose-500">{create.error.message}</p>}

      {blocks.data?.blocks.length === 0 && <p className="text-sm text-muted">No blocked IPs.</p>}
      <ul className="space-y-2">
        {blocks.data?.blocks.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between rounded-2xl border border-line bg-surface p-3 shadow-sm"
          >
            <div>
              <p className="font-mono text-sm font-semibold">
                {b.ip}
                {b.expiresAt && (
                  <span className="ml-2 rounded-full bg-elev px-2 py-0.5 text-xs font-medium text-muted">
                    until {new Date(b.expiresAt).toLocaleString()}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">
                {b.reason || 'No reason recorded'} · by {b.createdBy ?? '—'} ·{' '}
                {new Date(b.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate(b.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-elev disabled:opacity-50"
            >
              <ShieldOff size={14} aria-hidden />
              Unblock
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ModerationSection() {
  return (
    <div className="space-y-6">
      <ReportsQueue />
      <IpBlocksSection />
    </div>
  );
}
