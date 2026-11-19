import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, formatDate, localIsoDate, parseLocalDate } from '@/lib/dates';
import { IconButton } from '@/components/ui';

/** "Today", "Yesterday", "Tomorrow", or "Tue, 11/17/2026". */
function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  if (date === addDays(today, 1)) return 'Tomorrow';
  const weekday = parseLocalDate(date).toLocaleDateString('en-US', { weekday: 'short' });
  return `${weekday}, ${formatDate(date)}`;
}

/** Which diary day is on screen. Chevrons step one day; the label in the
 * middle jumps back to today. You can look one day ahead (to pre-log
 * tomorrow) but no further. */
export function DaySwitcher({
  date,
  onChange,
}: {
  /** The selected day as a YYYY-MM-DD key. */
  date: string;
  onChange: (next: string) => void;
}) {
  const today = localIsoDate();
  const isToday = date === today;
  // Date keys are zero-padded, so comparing the strings compares the days.
  const atLimit = date >= addDays(today, 1);

  return (
    <nav aria-label="Diary day" className="flex items-center gap-1">
      <IconButton
        label="Previous day"
        variant="secondary"
        onClick={() => onChange(addDays(date, -1))}
      >
        <ChevronLeft size={20} aria-hidden />
      </IconButton>
      <button
        type="button"
        onClick={() => onChange(today)}
        disabled={isToday}
        aria-label={isToday ? 'Today' : `${dayLabel(date, today)} — go back to today`}
        className="springy flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-2 hover:bg-elev disabled:hover:bg-transparent"
      >
        <span className="truncate text-base font-bold">{dayLabel(date, today)}</span>
        {!isToday && <span className="text-xs font-medium text-accent">Back to today</span>}
      </button>
      <IconButton
        label="Next day"
        variant="secondary"
        disabled={atLimit}
        onClick={() => onChange(addDays(date, 1))}
      >
        <ChevronRight size={20} aria-hidden />
      </IconButton>
    </nav>
  );
}
