import { ScrollText } from 'lucide-react';
import { useAuditLog } from '../api';

/** Read-only view of the append-only audit trail: who did what, to whom,
 * when. The newest 100 entries — enough for "what just happened" questions. */
export function AuditSection() {
  const audit = useAuditLog();

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <ScrollText size={18} className="text-accent" aria-hidden />
        Audit log
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Target</th>
              <th className="px-4 py-3 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody>
            {audit.data?.entries.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium">{e.action.replaceAll('_', ' ')}</td>
                <td className="px-4 py-3 text-muted">
                  {e.target_type}: <span className="font-mono text-xs">{e.target_id}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {e.detail && Object.keys(e.detail as object).length > 0
                    ? JSON.stringify(e.detail)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {audit.data?.entries.length === 0 && (
          <p className="px-4 py-6 text-center text-muted">Nothing logged yet.</p>
        )}
      </div>
    </section>
  );
}
