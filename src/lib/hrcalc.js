// HR calculations shared by the talent, attendance, monitoring, calls and analytics screens.
// Formulas follow the Sahayog HRMS modules so figures match across both front ends.
import { isoDate, DAY } from "./utils.js";

export const weightedScore = (p) => (p ? p.g * 0.5 + p.c * 0.3 + p.v * 0.2 : 0);

// Rating band → [label, merit %, tone]
export function band(s) {
  return s >= 4.5 ? ["Outstanding", 12, "good"] : s >= 3.75 ? ["Exceeds", 9, "good"] : s >= 3 ? ["Meets", 6, "info"] : s >= 2 ? ["Needs improvement", 2, "warn"] : ["Unsatisfactory", 0, "bad"];
}
export const perfLevel = (s) => (s >= 4 ? 2 : s >= 3 ? 1 : 0);

export const GRADE_MID = { P1: 40000, P2: 90000, P3: 150000, P4: 220000, M1: 160000, M2: 270000, M3: 380000 };
export const yearsSince = (iso) => (iso ? (Date.now() - new Date(`${iso}T12:00:00`)) / (365.25 * DAY) : 0);

// Flight risk: pay position, promotion gap, engagement and performance.
export function flightRisk(e, score) {
  const compa = e.country_code === "IN" && GRADE_MID[e.grade_code] ? e.monthly_gross / GRADE_MID[e.grade_code] : null;
  const since = yearsSince(e.last_promotion || e.date_of_joining);
  let r = 0;
  const why = [];
  if (compa != null) {
    if (compa < 0.9) {
      r += 25;
      why.push("pay below band");
    } else if (compa < 1) r += 10;
  }
  if (since > 3) {
    r += 25;
    why.push("no promotion 3+ yrs");
  } else if (since > 2) r += 10;
  const eng = e.engagement ?? 3.5;
  if (eng < 3) {
    r += 30;
    why.push("low engagement");
  } else if (eng < 3.5) r += 15;
  if (score >= 4) {
    r += 20;
    why.push("high performer");
  }
  return { score: r, level: r >= 50 ? ["High", "bad"] : r >= 25 ? ["Medium", "warn"] : ["Low", "good"], compa, since, why };
}

// Net hours for a clock pair "HH:MM" with a 1-hour break; handles overnight shifts.
export function netHours(inT, outT) {
  if (!inT || !outT) return 0;
  const [a, b] = inT.split(":").map(Number);
  const [c, d] = outT.split(":").map(Number);
  let mins = c * 60 + d - (a * 60 + b);
  if (mins < 0) mins += 1440;
  return Math.max(0, mins / 60 - 1);
}
export const hhmm = (iso) => new Date(iso).toTimeString().slice(0, 5);

// Pairs a day's punches into first-in / last-out with hours, late and OT flags.
export function dayAttendance(punches, { grace = "09:45", shiftHours = 8 } = {}) {
  const sorted = [...punches].sort((a, b) => a.ts.localeCompare(b.ts));
  const ins = sorted.filter((p) => p.type === "in");
  const outs = sorted.filter((p) => p.type === "out");
  const first = ins[0];
  const last = outs[outs.length - 1];
  const inT = first ? hhmm(first.ts) : null;
  const outT = last && (!first || last.ts > first.ts) ? hhmm(last.ts) : null;
  const hours = inT && outT ? netHours(inT, outT) : 0;
  return {
    first,
    last,
    inT,
    outT,
    hours,
    ot: Math.max(0, hours - shiftHours),
    late: !!inT && inT > grace,
    flagged: sorted.some((p) => p.flag),
    open: !!first && !outT,
    source: first?.source,
  };
}

// Productivity from activity minutes.
export function productivity(a) {
  if (!a) return { active: 0, productivePct: 0, idlePct: 0 };
  const active = a.productive + a.neutral + a.unproductive;
  const total = active + a.idle;
  return { active, total, productivePct: active ? Math.round((a.productive / active) * 100) : 0, idlePct: total ? Math.round((a.idle / total) * 100) : 0 };
}

// Wellness index 0–100 from 1–5 pulse items (stress reversed).
export const wellnessIndex = (p) => ((((6 - p.stress) + p.sleep + p.activity + p.energy) / 4 - 1) / 4) * 100;

export function lastNDays(n, from = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(isoDate(new Date(from.getTime() - i * DAY)));
  return out;
}

export const isWeekend = (iso) => [0, 6].includes(new Date(`${iso}T12:00:00`).getDay());

// Straight-line depreciation to zero over `years`.
export function bookValue(cost, purchased, years = 3) {
  const age = yearsSince(purchased);
  return Math.max(0, Math.round(cost * (1 - age / years)));
}

export function callStats(calls) {
  const connected = calls.filter((c) => c.outcome === "connected");
  const talk = connected.reduce((s, c) => s + c.duration_sec, 0);
  return {
    total: calls.length,
    connected: connected.length,
    connectRate: calls.length ? Math.round((connected.length / calls.length) * 100) : 0,
    talkMin: Math.round(talk / 60),
    avgSec: connected.length ? Math.round(talk / connected.length) : 0,
    won: calls.filter((c) => c.disposition === "won").length,
    followUps: calls.filter((c) => c.disposition === "follow_up" && c.follow_up_date).length,
  };
}

export const fmtDur = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

// ── Hours for a date range (home "My hours" card) ──
// Per day: total = first punch-in to last punch-out (or now while clocked in today);
// screen off = idle / screen-off minutes from activity data when the employee shares it, otherwise unlogged break time (1 h a day, estimated);
// worked = total − screen off.
export const rangeDates = (from, to) => {
  const out = [];
  for (let t = new Date(`${from}T12:00:00`).getTime(); t <= new Date(`${to}T12:00:00`).getTime() && out.length < 400; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};
export function hoursInRange(data, code, from, to, { grace = "09:45" } = {}) {
  const n = new Date();
  const todayIso = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  const days = rangeDates(from, to).map((d) => {
    const a = dayAttendance(data.punches.filter((p) => p.employee_code === code && p.ts.startsWith(d)), { grace });
    let total = 0;
    if (a.first) {
      const end = a.last && a.last.ts > a.first.ts ? new Date(a.last.ts) : d === todayIso ? new Date() : null;
      total = end ? Math.max(0, (end - new Date(a.first.ts)) / 3600000) : 0;
    }
    const act = (data.activity || []).find((x) => x.employee_code === code && x.date === d);
    const measured = !!act && total > 0;
    const screenOff = total <= 0 ? 0 : measured ? Math.min(total, (Number(act.idle) || 0) / 60 + Math.max(0, total - ((Number(act.productive) || 0) + (Number(act.neutral) || 0) + (Number(act.unproductive) || 0) + (Number(act.idle) || 0)) / 60)) : Math.min(total, total >= 5 ? 1 : 0);
    const r1 = (n) => Math.round(n * 100) / 100;
    // Screen-off time the manager approved as work (screen-off claims) moves from screen-off into worked hours.
    const claims = screenOffClaims(data, code, d);
    const approvedH = Math.min(screenOff, claims.approved / 60);
    const pendingH = Math.min(Math.max(0, screenOff - approvedH), claims.pending / 60);
    const off = Math.max(0, screenOff - approvedH);
    return { date: d, inT: a.inT, outT: a.outT, open: a.open && d === todayIso, late: a.late, total: r1(total), rawScreenOff: r1(screenOff), screenOff: r1(off), claimed: r1(approvedH), claimPending: r1(pendingH), claimable: r1(Math.max(0, off - pendingH)), worked: r1(Math.max(0, total - off)), measured, weekend: [0, 6].includes(new Date(`${d}T12:00:00`).getDay()) };
  });
  const sum = (k) => Math.round(days.reduce((s, x) => s + x[k], 0) * 100) / 100;
  const present = days.filter((x) => x.total > 0);
  return { days, worked: sum("worked"), screenOff: sum("screenOff"), total: sum("total"), claimed: sum("claimed"), claimPending: sum("claimPending"), claimable: sum("claimable"), present: present.length, avg: present.length ? Math.round((sum("worked") / present.length) * 100) / 100 : 0, late: present.filter((x) => x.late).length, measuredDays: days.filter((x) => x.measured).length };
}
/** Minutes of screen-off time claimed as work for one day: approved and still pending (screen-off claim requests). */
export function screenOffClaims(data, code, date) {
  const list = (data.requests || []).filter((r) => r.type === "screenoff" && r.employee_code === code && r.date === date);
  const mins = (st) => list.filter((r) => r.status === st).reduce((s, r) => s + (Number(r.approved_minutes ?? r.minutes) || 0), 0);
  return { approved: mins("Approved"), pending: mins("Pending"), list };
}
export const fmtHrs = (h) => { const m = Math.round((Number(h) || 0) * 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`; };
