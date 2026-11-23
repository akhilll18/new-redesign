// Derived workforce views shared by dashboards, attendance, live map and team pages.
import { isoDate, initials } from "./utils.js";
import { dayAttendance, productivity, isWeekend } from "./hrcalc.js";
import { fencesFor, nearestGeofence, offset, rng } from "./geo.js";

export const nowMinutes = (data) => (data.demo_clock ? 870 : new Date().getHours() * 60 + new Date().getMinutes());

export function onLeaveToday(data, code, day = isoDate()) {
  return data.requests.find((r) => r.type === "leave" && r.status === "Approved" && r.employee_code === code && r.from_date <= day && r.to_date >= day);
}

// Today's attendance status for one employee.
export function todayStatus(data, e, day = isoDate()) {
  const ps = data.punches.filter((p) => p.employee_code === e.employee_code && p.ts.startsWith(day));
  const att = dayAttendance(ps, { grace: data.settings.late_after, shiftHours: data.settings.shift_hours });
  const leave = onLeaveToday(data, e.employee_code, day);
  let status;
  if (leave) status = "leave";
  else if (att.first) status = att.open ? (att.late ? "late" : "present") : "out";
  else if (isWeekend(day)) status = "weekend";
  else status = nowMinutes(data) > 600 ? "absent" : "not_in";
  return { ...att, status, leave, punches: ps };
}

export const STATUS_META = {
  present: ["On time", "good"],
  late: ["Late", "warn"],
  out: ["Clocked out", "neutral"],
  leave: ["On leave", "info"],
  absent: ["Not in", "bad"],
  not_in: ["Not in yet", "neutral"],
  weekend: ["Weekly off", "neutral"],
};

export function register(data, employees) {
  return employees.filter((e) => e.status === "active").map((e) => ({ e, ...todayStatus(data, e) }));
}

export function registerCounts(rows) {
  const c = { present: 0, late: 0, out: 0, leave: 0, absent: 0, not_in: 0, weekend: 0 };
  rows.forEach((r) => (c[r.status] += 1));
  return c;
}

// Live positions for a set of employees. Seeded positions drift slightly each minute so the demo map moves.
export function livePeople(data, employees, { selfCode } = {}) {
  const now = Date.now();
  const bucket = Math.floor(now / 60000);
  return employees
    .filter((e) => data.locations[e.employee_code])
    .map((e) => {
      const loc = data.locations[e.employee_code];
      let pos = { lat: loc.lat, lng: loc.lng };
      if (loc.source === "mobile" && e.field_staff === "yes") {
        const r = rng(`${e.employee_code}${bucket}`);
        pos = offset(pos, (r() - 0.5) * 80, (r() - 0.5) * 80);
      }
      const ageMin = (now - new Date(loc.ts).getTime()) / 60000;
      const allowed = fencesFor(e, data.geofences).map((g) => g.id);
      const geo = nearestGeofence({ ...pos, accuracy: loc.accuracy }, data.geofences, allowed);
      const status = e.employee_code === selfCode ? "self" : ageMin > 15 ? "stale" : geo.inside ? "inside" : "outside";
      return {
        code: e.employee_code,
        name: e.full_name,
        initials: initials(e.full_name),
        lat: pos.lat,
        lng: pos.lng,
        accuracy: loc.accuracy,
        battery: loc.battery,
        ts: loc.ts,
        ageMin,
        status,
        fence: geo.fence,
        distance: geo.distance,
        trail: loc.trail,
        e,
        sub: `${e.designation}${geo.fence ? ` · ${geo.inside ? "at" : "near"} ${geo.fence.name}` : ""}`,
      };
    });
}

export function activityFor(data, code, day) {
  return data.activity.find((a) => a.employee_code === code && a.date === day);
}

export function teamActivity(data, employees, day = isoDate()) {
  return employees.map((e) => {
    const a = activityFor(data, e.employee_code, day);
    const consent = data.consents[e.employee_code];
    return { e, a, p: productivity(a), consent };
  });
}

export function regionOf(fence) {
  return fence?.country || "IN";
}
