import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronUp, Timer } from 'lucide-react';
import { getOpenSession } from '../repository';
import { formatClock, useRestTimer } from '../restTimer';

/** The open workout, if there is one. Shared query key with the hub and the
 * home hero, so starting or finishing a session updates all three at once. */
export function useOpenSession() {
  return useQuery({ queryKey: ['sessions', 'open'], queryFn: getOpenSession });
}

/** A workout in progress never disappears: leave the workout screen and it
 * collapses into this bar, docked just above the tab bar on every page. It
 * shows the running clock — or the rest countdown while resting — and one
 * tap brings the workout back. */
export function ActiveWorkoutBar() {
  const { data: session } = useOpenSession();
  const { rest, remainingSec } = useRestTimer();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  if (!session) return null;
  const resting = rest?.sessionId === session.id && remainingSec > 0;
  const elapsedSec = (now - Date.parse(session.startedAt)) / 1000;

  return (
    <Link
      to={`/workouts/session/${session.id}`}
      aria-label={`Resume workout: ${session.workoutName}`}
      className="springy fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex min-h-14 max-w-md items-center gap-3 rounded-2xl bg-linear-to-r from-accent to-accent-2 px-4 text-accent-ink md:bottom-6"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-ink/60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-ink" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{session.workoutName}</span>
        <span className="block text-xs font-medium opacity-80">
          {session.sets.length} set{session.sets.length === 1 ? '' : 's'} logged · tap to resume
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-lg font-bold tabular-nums">
        {resting && <Timer size={16} aria-hidden />}
        {resting ? formatClock(remainingSec) : formatClock(elapsedSec)}
      </span>
      <ChevronUp size={20} className="shrink-0" aria-hidden />
    </Link>
  );
}
