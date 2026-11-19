import { SkipForward, Timer } from 'lucide-react';
import { adjustRest, formatClock, stopRest, useRestTimer } from '../restTimer';

/** The rest countdown, pinned to the bottom of the workout screen where the
 * thumb already is: big digits to read from arm's length, a bar that drains,
 * and −15 / +15 / Skip as 48px buttons. Renders nothing when not resting. */
export function RestBar({ sessionId }: { sessionId: string }) {
  const { rest, remainingSec } = useRestTimer();
  if (!rest || rest.sessionId !== sessionId || remainingSec <= 0) return null;

  const fraction = Math.min(1, remainingSec / rest.totalSec);
  const button =
    'springy flex h-12 min-w-14 items-center justify-center rounded-xl bg-elev px-3 text-base font-bold tabular-nums active:bg-accent-soft';

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-accent/40 bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.25)] md:inset-x-auto md:right-6 md:bottom-6 md:w-96 md:rounded-2xl md:border">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
            <Timer size={14} className="text-accent" aria-hidden />
            Rest
          </p>
          <p className="text-4xl leading-none font-bold tabular-nums" aria-live="off">
            {formatClock(remainingSec)}
          </p>
        </div>
        <button type="button" onClick={() => adjustRest(-15)} className={button}>
          −15
        </button>
        <button type="button" onClick={() => adjustRest(15)} className={button}>
          +15
        </button>
        <button
          type="button"
          onClick={stopRest}
          aria-label="Skip rest"
          className={`${button} gap-1.5`}
        >
          <SkipForward size={18} aria-hidden />
          Skip
        </button>
      </div>
      <div className="mx-auto mt-3 h-1.5 max-w-3xl overflow-hidden rounded-full bg-elev">
        <div
          className="h-full rounded-full bg-linear-to-r from-accent to-accent-2 transition-[width] duration-500 ease-linear"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
