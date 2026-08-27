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
