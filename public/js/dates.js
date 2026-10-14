// Dates are handled as local "YYYY-MM-DD" keys so they sort as strings and
// never drift across time zones. Parsed at noon to dodge DST edge cases.

const pad = (n) => String(n).padStart(2, '0');

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export const todayKey = () => toKey(new Date());

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** First day of the week containing `key`. weekStart: 0 = Sunday, 1 = Monday. */
export function weekStartOf(key, weekStart) {
  const d = fromKey(key);
  d.setDate(d.getDate() - ((d.getDay() - weekStart + 7) % 7));
  return toKey(d);
}

export const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 86_400_000);

export const fmt = (key, opts) => fromKey(key).toLocaleDateString(undefined, opts);
