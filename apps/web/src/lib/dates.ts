/** One date format everywhere: US-style mm/dd/yyyy. Date-only ISO strings
 * ("2026-08-27") are parsed as LOCAL dates — new Date() would read them as
 * UTC and show yesterday in negative-offset timezones. */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

function toDate(value: string | number | Date): Date {
  return typeof value === 'string' && DATE_ONLY.test(value) ? parseDay(value) : new Date(value);
}

/** "08/27/2026" */
export function formatDate(value: string | number | Date): string {
  return toDate(value).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

/** "8/27" — for tight labels (chart axes, heatmap rows). */
export function formatDateShort(value: string | number | Date): string {
  return toDate(value).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

/* ----------------------- Calendar keys (local time) ----------------------- */
/* Diary entries, weigh-ins, sessions and plan days are keyed by the day the
 * person lived through, not the UTC day: `toISOString().slice(0, 10)` flips
 * "today" to tomorrow at 8pm US time, so an evening meal landed on the wrong
 * day and the dashboard's today view emptied out every night. Every
 * calendar KEY (YYYY-MM-DD) goes through these; timestamps (logged_at,
 * started_at, completed_at) stay full ISO strings in UTC as before. */

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD of `d` in local time (today by default). */
export function localIsoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a YYYY-MM-DD key (same parsing rule as parseDay). */
export function parseLocalDate(iso: string): Date {
  return parseDay(iso.slice(0, 10));
}

/** The key `days` calendar days after `iso` (negative = before). Steps by
 * calendar days, so DST transitions never shift the result. */
export function addDays(iso: string, days: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return localIsoDate(d);
}

/** Today's key shifted `days` calendar days into the past. */
export function localIsoDateDaysAgo(days: number, from: Date = new Date()): string {
  return addDays(localIsoDate(from), -days);
}

/** Weekday with Monday = 0 … Sunday = 6 — the app's plan-day convention. */
export function localDayOfWeek(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7;
}

/** Key of the Monday that starts the week containing `iso`. */
export function mondayOf(iso: string): string {
  return addDays(iso, -localDayOfWeek(parseLocalDate(iso)));
}
