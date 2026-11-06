// Local-date helpers: plan_date is stored as 'YYYY-MM-DD', so build it from
// local components - toISOString() would shift the day in non-UTC timezones.

export function toDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return toDateISO(new Date());
}

export function parseDateISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Monday-first start of the week containing `date`.
export function startOfWeek(date) {
  const d = new Date(date);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekDates(refDate) {
  const start = startOfWeek(refDate);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatShortDate(iso) {
  return parseDateISO(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatCommentDate(iso) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = toDateISO(date) === toDateISO(now);
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, sameYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}
