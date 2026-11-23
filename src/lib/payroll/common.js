// Helpers shared by every country payroll engine.
export const r2 = x => Math.round(x * 100) / 100;
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Progressive tax: slabs = [[upperLimit, rate], ...] in ascending order. */
export function slabTax(income, slabs) {
  let t = 0, prev = 0;
  for (const [cap, rate] of slabs) { if (income > prev) t += (Math.min(income, cap) - prev) * rate; prev = cap; }
  return t;
}

export const D = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export function ageAt(dob, onDate) {
  const b = D(dob), t = D(onDate);
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}
export const yearsBetween = (a, b) => (D(b) - D(a)) / (365.25 * 864e5);

/** Year-to-date pay before this period, assuming level monthly pay since January or the joining month. */
export function ytdBefore(emp, period, monthlyPay) {
  const [y, m] = period.split('-').map(Number), j = D(emp.doj);
  const firstPaidMonth = j.getFullYear() < y ? 1 : j.getFullYear() === y ? j.getMonth() + 1 : 13;
  return Math.max(0, m - firstPaidMonth) * monthlyPay;
}

/* ---------- filing-calendar helpers: each returns the next due date (ISO) on or after `today` ---------- */
export function monthlyDue(today, day) {
  const t = D(today); let d = new Date(t.getFullYear(), t.getMonth(), day);
  if (d < t) d = new Date(t.getFullYear(), t.getMonth() + 1, day);
  return iso(d);
}
/** Quarterly: due `day` of the month after each quarter end (or `monthsAfter` months after). */
export function quarterlyDue(today, day, monthsAfter = 1, quarterEnds = [3, 6, 9, 12]) {
  const t = D(today);
  for (let y = t.getFullYear() - 1; y <= t.getFullYear() + 1; y++) {
    for (const qe of quarterEnds) {
      const d = new Date(y, qe - 1 + monthsAfter, day);
      if (d >= t) return iso(d);
    }
  }
}
export function annualDue(today, month, day) {
  const t = D(today); let d = new Date(t.getFullYear(), month - 1, day);
  if (d < t) d = new Date(t.getFullYear() + 1, month - 1, day);
  return iso(d);
}
/** Last weekday of the month containing (or after) today. */
export function lastWorkingDay(today) {
  const t = D(today); let d = new Date(t.getFullYear(), t.getMonth() + 1, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  if (d < t) { d = new Date(t.getFullYear(), t.getMonth() + 2, 0); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); }
  return iso(d);
}

/** Check result helper. status: pass | warn | fail | info */
/** `block` = true means payroll cannot run for this employee until it is fixed. */
export const check = (rule, status, detail, law = '', block = false) => ({ rule, status, detail, law, block: block && status === 'fail' });
