// Operational sample data: geofences, biometric devices, punches, live location, monitoring, calls, assets,
// performance, recruitment, onboarding, learning, benefits, wellness, workforce and analytics.
// Generated relative to "now" so the demo always shows today's activity.
import { isoDate, DAY } from "../lib/utils.js";
import { rng, offset } from "../lib/geo.js";

const at = (dayIso, hhmm) => new Date(`${dayIso}T${hhmm}:00`).toISOString();
const pad = (n) => String(n).padStart(2, "0");
const minToHHMM = (m) => `${pad(Math.floor(m / 60))}:${pad(Math.round(m % 60))}`;

export const GEOFENCES = [
  { id: "GF-HQ", name: "Hyderabad HQ · HITEC City", lat: 17.4474, lng: 78.3762, radius_m: 200, type: "office", country: "IN", active: true },
  { id: "GF-NZP", name: "Nizampet branch", lat: 17.5186, lng: 78.3863, radius_m: 150, type: "office", country: "IN", active: true },
  { id: "GF-WH", name: "Shamshabad warehouse", lat: 17.2403, lng: 78.4294, radius_m: 400, type: "site", country: "IN", active: true },
  { id: "GF-CL1", name: "Client · Retail CRM, Gachibowli", lat: 17.4401, lng: 78.3489, radius_m: 250, type: "client", country: "IN", active: true },
  { id: "GF-CL2", name: "Client · Logistics park, Kondapur", lat: 17.4632, lng: 78.3639, radius_m: 250, type: "client", country: "IN", active: true },
  { id: "GF-LDN", name: "London office", lat: 51.5155, lng: -0.0922, radius_m: 150, type: "office", country: "GB", active: true },
  { id: "GF-AUS", name: "Austin office", lat: 30.2672, lng: -97.7431, radius_m: 150, type: "office", country: "US", active: true },
  { id: "GF-DXB", name: "Dubai office · DIFC", lat: 25.2131, lng: 55.2797, radius_m: 180, type: "office", country: "AE", active: true },
  { id: "GF-SG", name: "Singapore office", lat: 1.2834, lng: 103.851, radius_m: 150, type: "office", country: "SG", active: true },
  // ONAS · Africa region offices
  { id: "GF-WHK", name: "Windhoek office", lat: -22.5609, lng: 17.0658, radius_m: 150, type: "office", country: "NA", active: true },
  { id: "GF-JNB", name: "Johannesburg office · Sandton", lat: -26.1076, lng: 28.0567, radius_m: 150, type: "office", country: "ZA", active: true },
  { id: "GF-NBO", name: "Nairobi office · Westlands", lat: -1.2676, lng: 36.8108, radius_m: 150, type: "office", country: "KE", active: true },
  { id: "GF-LOS", name: "Lagos office · Victoria Island", lat: 6.4281, lng: 3.4219, radius_m: 150, type: "office", country: "NG", active: true },
  { id: "GF-GBE", name: "Gaborone office · CBD", lat: -24.6545, lng: 25.9086, radius_m: 150, type: "office", country: "BW", active: true },
  // ONAS · AMER, EMEA, ASIA and more AFRICA offices
  { id: "GF-TOR", name: "Toronto office", lat: 43.6487, lng: -79.3817, radius_m: 150, type: "office", country: "CA", active: true },
  { id: "GF-MEX", name: "Mexico City office · Reforma", lat: 19.4270, lng: -99.1677, radius_m: 150, type: "office", country: "MX", active: true },
  { id: "GF-SAO", name: "São Paulo office · Faria Lima", lat: -23.5868, lng: -46.6820, radius_m: 150, type: "office", country: "BR", active: true },
  { id: "GF-BER", name: "Berlin office", lat: 52.5200, lng: 13.4050, radius_m: 150, type: "office", country: "DE", active: true },
  { id: "GF-PAR", name: "Paris office · La Défense", lat: 48.8920, lng: 2.2370, radius_m: 150, type: "office", country: "FR", active: true },
  { id: "GF-DUB", name: "Dublin office · Docklands", lat: 53.3478, lng: -6.2397, radius_m: 150, type: "office", country: "IE", active: true },
  { id: "GF-RUH", name: "Riyadh office · KAFD", lat: 24.7616, lng: 46.6400, radius_m: 180, type: "office", country: "SA", active: true },
  { id: "GF-KUL", name: "Kuala Lumpur office", lat: 3.1579, lng: 101.7123, radius_m: 150, type: "office", country: "MY", active: true },
  { id: "GF-MNL", name: "Manila office · BGC", lat: 14.5509, lng: 121.0503, radius_m: 150, type: "office", country: "PH", active: true },
  { id: "GF-JKT", name: "Jakarta office · Sudirman", lat: -6.2253, lng: 106.8090, radius_m: 150, type: "office", country: "ID", active: true },
  { id: "GF-ACC", name: "Accra office · Airport City", lat: 5.6037, lng: -0.1870, radius_m: 150, type: "office", country: "GH", active: true },
  { id: "GF-LUN", name: "Lusaka office", lat: -15.4167, lng: 28.2833, radius_m: 150, type: "office", country: "ZM", active: true },
];

const DEVICES = [
  { device_id: "DEV-01", name: "HQ main entrance", type: "fingerprint", geofence_id: "GF-HQ", serial: "FP-7A21-0931", ip: "10.12.1.21", status: "online", firmware: "6.4.2" },
  { device_id: "DEV-02", name: "HQ floor 3", type: "face", geofence_id: "GF-HQ", serial: "FC-3B11-2280", ip: "10.12.1.22", status: "online", firmware: "3.1.0" },
  { device_id: "DEV-03", name: "Nizampet branch", type: "fingerprint", geofence_id: "GF-NZP", serial: "FP-7A21-1144", ip: "10.14.1.10", status: "offline", firmware: "6.2.9" },
  { device_id: "DEV-04", name: "Warehouse gate", type: "face", geofence_id: "GF-WH", serial: "FC-3B11-3307", ip: "10.16.1.5", status: "online", firmware: "3.1.0" },
];

const APPS = {
  Engineering: [["VS Code", "productive"], ["GitHub", "productive"], ["Jira", "productive"], ["Slack", "neutral"], ["Chrome · docs", "productive"], ["YouTube", "unproductive"]],
  "Data Migration": [["DBeaver", "productive"], ["Excel", "productive"], ["Jira", "productive"], ["Teams", "neutral"], ["News sites", "unproductive"]],
  Sales: [["CRM", "productive"], ["Dialer", "productive"], ["WhatsApp Business", "neutral"], ["Gmail", "neutral"], ["Social media", "unproductive"]],
  default: [["Office suite", "productive"], ["Email", "neutral"], ["Teams", "neutral"], ["HR portal", "productive"], ["Shopping sites", "unproductive"]],
};

function workdays(n, now) {
  const out = [];
  for (let i = 0; out.length < n && i < n * 2; i += 1) {
    const d = isoDate(new Date(now - i * DAY));
    const wd = new Date(`${d}T12:00:00`).getDay();
    if (wd !== 0 && wd !== 6) out.push(d);
  }
  return out;
}

export function buildOps({ employees }) {
  const now = Date.now();
  const today = isoDate(now);
  // Outside working hours the demo builds "today" as if it were 14:30, so dashboards have live data to show.
  const realMin = new Date().getHours() * 60 + new Date().getMinutes();
  const demoClock = realMin < 600 || realMin > 1170;
  const nowMin = demoClock ? 870 : realMin;
  const days = workdays(30, now); // ~6 weeks of history for hours and attendance ranges
  const active = employees.filter((e) => e.status === "active");
  const fence = (id) => GEOFENCES.find((g) => g.id === id) || GEOFENCES[0];

  // ── Punches (biometric devices, geofenced mobile, web) ──
  const punches = [];
  let pid = 1;
  active.forEach((e) => {
    days.forEach((d) => {
      const r = rng(`${e.employee_code}${d}`);
      if (d !== today && r() < 0.06) return; // absent / on leave
      if (d === today && e.employee_code === "EMP001") return; // the demo employee punches in live
      const inMin = 540 + Math.round(r() * 75) - (e.country_code === "IN" ? 0 : 10);
      const outMin = inMin + 520 + Math.round(r() * 110);
      const isBio = e.attendance_mode === "biometric" || (e.attendance_mode === "any" && r() < 0.5);
      const f = fence(e.primary_geofence);
      const fieldDay = e.field_staff === "yes" && r() < 0.55;
      const site = fieldDay ? fence(r() < 0.5 ? "GF-CL1" : "GF-CL2") : f;
      const mk = (type, m) => {
        const outside = !isBio && e.attendance_mode !== "web" && r() < 0.07;
        const pos = offset(site, (r() - 0.5) * (outside ? 1800 : site.radius_m), (r() - 0.5) * (outside ? 1800 : site.radius_m));
        const dev = DEVICES.find((x) => x.geofence_id === e.primary_geofence && x.type === (r() < 0.5 ? "fingerprint" : "face")) || DEVICES.find((x) => x.geofence_id === e.primary_geofence);
        const source = isBio && dev ? (dev.type === "face" ? "biometric_face" : "biometric_fp") : e.attendance_mode === "web" ? "web" : "geo_mobile";
        return {
          id: `PN-${pid++}`,
          employee_code: e.employee_code,
          ts: at(d, minToHHMM(m)),
          type,
          source,
          device_id: source.startsWith("biometric") ? dev.device_id : null,
          verified: source.startsWith("biometric") ? "device" : source === "geo_mobile" ? (r() < 0.8 ? "selfie" : "device_biometric") : "password",
          lat: source === "geo_mobile" ? +pos.lat.toFixed(6) : null,
          lng: source === "geo_mobile" ? +pos.lng.toFixed(6) : null,
          accuracy: source === "geo_mobile" ? 8 + Math.round(r() * 30) : null,
          geofence_id: source === "web" ? null : site.id,
          inside: source !== "geo_mobile" || !outside,
          flag: outside ? "Outside geofence" : null,
        };
      };
      if (d !== today || inMin < nowMin) punches.push(mk("in", inMin));
      if (d !== today || outMin < nowMin) punches.push(mk("out", outMin));
    });
  });

  // ── Live location (latest position for staff clocked in today who consented) ──
  const consents = {};
  employees.forEach((e) => {
    const no = ["EMP011", "EMP014"].includes(e.employee_code);
    consents[e.employee_code] = e.employee_code === "EMP001" || e.status !== "active" ? null : { location: !no, activity: !no && e.employee_code !== "EMP006", at: new Date(now - 40 * DAY).toISOString(), version: "2026.1" };
  });
  const locations = {};
  active.forEach((e) => {
    const todays = punches.filter((p) => p.employee_code === e.employee_code && p.ts.startsWith(today));
    const clockedIn = todays.some((p) => p.type === "in") && !todays.some((p) => p.type === "out");
    if (!clockedIn || !consents[e.employee_code]?.location) return;
    const r = rng(`${e.employee_code}loc${today}`);
    const last = todays.filter((p) => p.lat).pop();
    const f = fence(e.primary_geofence);
    const base = last ? { lat: last.lat, lng: last.lng } : offset(f, (r() - 0.5) * f.radius_m, (r() - 0.5) * f.radius_m);
    const trail = Array.from({ length: e.field_staff === "yes" ? 8 : 3 }, (_, i) => ({ ...offset(base, (r() - 0.5) * (e.field_staff === "yes" ? 1600 : 60) * (i / 8), (r() - 0.5) * (e.field_staff === "yes" ? 1600 : 60) * (i / 8)), ts: new Date(now - (8 - i) * 20 * 60000).toISOString() }));
    const cur = trail[trail.length - 1];
    locations[e.employee_code] = { lat: +cur.lat.toFixed(6), lng: +cur.lng.toFixed(6), accuracy: 6 + Math.round(r() * 25), battery: 35 + Math.round(r() * 60), ts: new Date(now - Math.round(r() * (e.employee_code === "EMP023" ? 40 : 9)) * 60000).toISOString(), trail, source: "mobile" };
  });

  // ── Activity (monitoring, consenting employees only) ──
  const activity = [];
  active.forEach((e) => {
    if (!consents[e.employee_code]?.activity) return;
    const apps = APPS[e.department] || APPS.default;
    days.forEach((d) => {
      const r = rng(`${e.employee_code}act${d}`);
      const span = d === today ? Math.max(0, Math.min(nowMin, 1110) - 570) : 480 + Math.round(r() * 120);
      if (span <= 0) return;
      const idle = Math.round(span * (0.08 + r() * 0.18));
      const act = span - idle;
      const prodShare = 0.55 + r() * 0.3 - (e.engagement < 3 ? 0.15 : 0);
      const unprod = Math.round(act * (0.03 + r() * 0.08));
      const productive = Math.round(act * prodShare);
      const neutral = Math.max(0, act - productive - unprod);
      const split = apps.map(([n, c]) => [n, c, Math.round((c === "productive" ? productive : c === "neutral" ? neutral : unprod) / apps.filter((a) => a[1] === c).length)]);
      activity.push({ employee_code: e.employee_code, date: d, productive, neutral, unproductive: unprod, idle, first: minToHHMM(560 + Math.round(r() * 40)), last: d === today ? minToHHMM(Math.min(nowMin, 1110)) : minToHHMM(560 + span + Math.round(r() * 30)), apps: split.sort((a, b) => b[2] - a[2]).slice(0, 5) });
    });
  });

  // ── Calls ──
  const calls = [];
  let cid = 1;
  const companies = ["Sri Venkateswara Traders", "Deccan Logistics", "Kaveri Foods", "Banjara Retail", "Godavari Pharma", "Charminar Motors", "Krishna Textiles", "Hussain Sagar Hotels", "Golconda Steels", "Tank Bund Electronics", "Ameerpet Coaching", "Secunderabad Agencies"];
  const people = ["Mr. Rao", "Ms. Lakshmi", "Mr. Khan", "Ms. Priya", "Mr. Reddy", "Mr. Iyer", "Ms. Fatima", "Mr. Naidu", "Ms. Deepa", "Mr. Joseph"];
  employees
    .filter((e) => e.call_tracking === "yes" && e.status === "active")
    .forEach((e) => {
      days.slice(0, 7).forEach((d) => {
        const r = rng(`${e.employee_code}calls${d}`);
        const n = d === today ? Math.max(0, Math.round(((nowMin - 570) / 480) * (12 + r() * 16))) : 10 + Math.round(r() * 22);
        for (let i = 0; i < Math.min(n, 30); i += 1) {
          const m = 570 + Math.round((i / Math.max(1, n)) * 470 + r() * 15);
          if (d === today && m > nowMin) break;
          const roll = r();
          const outcome = roll < 0.58 ? "connected" : roll < 0.78 ? "no_answer" : roll < 0.9 ? "busy" : "voicemail";
          const disp = outcome !== "connected" ? "" : r() < 0.12 ? "won" : r() < 0.45 ? "follow_up" : r() < 0.7 ? "interested" : "not_interested";
          calls.push({
            id: `CL-${cid++}`,
            employee_code: e.employee_code,
            ts: at(d, minToHHMM(m)),
            direction: r() < 0.78 ? "outbound" : "inbound",
            contact: people[Math.floor(r() * people.length)],
            company: companies[Math.floor(r() * companies.length)],
            phone: `+91 9${Math.floor(100000000 + r() * 899999999)}`,
            duration_sec: outcome === "connected" ? 40 + Math.round(r() * 420) : outcome === "voicemail" ? 25 : 0,
            outcome,
            disposition: disp,
            follow_up_date: disp === "follow_up" ? isoDate(new Date(`${d}T12:00:00`).getTime() + (1 + Math.round(r() * 4)) * DAY) : "",
            notes: disp === "won" ? "Order confirmed; sending proforma." : disp === "follow_up" ? "Asked for pricing sheet." : "",
            source: r() < 0.85 ? "mobile_app" : "manual",
          });
        }
      });
    });

  // ── Assets ──
  const A = (id, category, model, serial, cost, purchasedDays, status, to, extra = {}) => ({
    asset_id: id,
    category,
    model,
    serial,
    cost,
    purchase_date: isoDate(now - purchasedDays * DAY),
    warranty_end: isoDate(now - purchasedDays * DAY + (category === "Laptop" ? 3 : 1) * 365 * DAY),
    status,
    assigned_to: to,
    assigned_on: to ? isoDate(now - Math.min(purchasedDays, 200) * DAY) : null,
    acknowledged: !!to && to !== "EMP010",
    condition: "Good",
    location: "GF-HQ",
    history: to ? [{ at: isoDate(now - Math.min(purchasedDays, 200) * DAY), action: "Assigned", to }] : [],
    ...extra,
  });
  const assets = [
    A("LT-0101", "Laptop", "Dell Latitude 5440 · i7 · 16 GB", "DL5440-8KX21", 92000, 420, "assigned", "EMP001"),
    A("LT-0102", "Laptop", "Lenovo ThinkPad T14 · 32 GB", "TP14-55120", 118000, 700, "assigned", "EMP004"),
    A("LT-0103", "Laptop", "MacBook Pro 14 M3", "C02MP14-771", 185000, 300, "assigned", "EMP007"),
    A("LT-0104", "Laptop", "Dell Latitude 5440 · i5 · 16 GB", "DL5440-8KX55", 84000, 25, "assigned", "EMP010"),
    A("LT-0105", "Laptop", "HP EliteBook 840", "HP840-22018", 96000, 1300, "repair", null, { condition: "Battery swelling", location: "GF-HQ" }),
    A("LT-0106", "Laptop", "Dell Latitude 5440 · i5 · 16 GB", "DL5440-8KX90", 84000, 60, "in_stock", null),
    A("LT-0107", "Laptop", "Lenovo ThinkPad E14", "TPE14-90211", 68000, 520, "assigned", "EMP022"),
    A("LT-0108", "Laptop", "Lenovo ThinkPad E14", "TPE14-90244", 68000, 150, "assigned", "EMP023"),
    A("MN-0201", "Monitor", "Dell 24\" P2423", "P2423-1182", 16500, 400, "assigned", "EMP004"),
    A("MN-0202", "Monitor", "LG 27\" 4K", "LG27-77310", 28000, 210, "assigned", "EMP007"),
    A("MN-0203", "Monitor", "Dell 24\" P2423", "P2423-1190", 16500, 90, "in_stock", null),
    A("MN-0204", "Monitor", "Dell 24\" P2423", "P2423-1191", 16500, 90, "in_stock", null),
    A("PH-0301", "Phone", "Samsung Galaxy A35", "A35-IMEI-3391", 28000, 300, "assigned", "EMP022"),
    A("PH-0302", "Phone", "Samsung Galaxy A35", "A35-IMEI-3392", 28000, 30, "in_stock", null),
    A("PH-0303", "Phone", "Samsung Galaxy A55", "A55-IMEI-1180", 39000, 500, "assigned", "EMP024"),
    A("SM-0401", "SIM", "Corporate SIM · postpaid", "SIM-98480-11", 0, 300, "assigned", "EMP022"),
    A("SM-0402", "SIM", "Corporate SIM · postpaid", "SIM-98480-12", 0, 150, "assigned", "EMP023"),
    A("AC-0501", "Access card", "RFID access card", "AC-10001", 350, 420, "assigned", "EMP001"),
    A("AC-0502", "Access card", "RFID access card", "AC-10010", 350, 25, "assigned", "EMP010"),
    A("HS-0601", "Headset", "Jabra Evolve2 40", "JB40-5512", 9800, 300, "assigned", "EMP022"),
    A("HS-0602", "Headset", "Jabra Evolve2 40", "JB40-5513", 9800, 300, "assigned", "EMP015"),
    A("VH-0701", "Vehicle", "Two-wheeler · TS09 EX 4471", "TS09EX4471", 95000, 800, "assigned", "EMP013", { warranty_end: isoDate(now + 40 * DAY), notes: "Insurance renewal due" }),
  ];

  // ── Performance ──
  const perf = {};
  const reviews = {};
  employees.forEach((e) => {
    const r = rng(`${e.employee_code}perf`);
    const base = 2.6 + r() * 2.1 + (e.engagement - 3.5) * 0.4;
    const q = (x) => Math.max(1, Math.min(5, Math.round(x * 10) / 10));
    perf[e.employee_code] = { g: q(base + (r() - 0.5) * 0.6), c: q(base + (r() - 0.5) * 0.6), v: q(base + 0.2 + (r() - 0.5) * 0.4), pot: e.potential || 2 };
  });
  reviews.EMP004 = { self: { g: 4.2, c: 3.8, v: 4.0, comments: "Shipped the reconciliation automation; mentoring a junior.", submitted_at: new Date(now - 3 * DAY).toISOString() } };
  reviews.EMP022 = { self: { g: 3.9, c: 3.6, v: 4.1, comments: "Closed 14 new accounts; ahead of target in Q3.", submitted_at: new Date(now - 2 * DAY).toISOString() } };
  reviews.EMP009 = { self: { g: 3.7, c: 4.0, v: 3.9, comments: "Customer master go-live with zero defects.", submitted_at: new Date(now - 5 * DAY).toISOString() }, manager: { g: 3.9, c: 4.0, v: 4.0, pot: 2, comments: "Strong delivery; needs to delegate more.", submitted_at: new Date(now - 1 * DAY).toISOString(), by: "EMP007" } };
  const goalBank = {
    Engineering: [["Ship payments reconciliation v2", "Released to production", 40], ["Reduce p95 API latency", "Below 300 ms", 30], ["Mentor one new joiner", "30/60/90 plan completed", 30]],
    "Data Migration": [["Customer master migration", "1.2M records, zero P1 defects", 50], ["Automate data quality checks", "80% rules automated", 30], ["Snowflake certification", "Certified", 20]],
    Sales: [["New-logo revenue", "₹60 L booked", 50], ["Calls and meetings", "25 calls/day, 12 meetings/month", 30], ["CRM hygiene", "100% opportunities updated weekly", 20]],
    default: [["Process improvement", "One documented improvement per quarter", 40], ["Stakeholder satisfaction", "CSAT ≥ 4.3", 30], ["Learning hours", "24 hours this year", 30]],
  };
  const goals = [];
  let gid = 1;
  employees
    .filter((e) => e.status === "active")
    .forEach((e) => {
      const r = rng(`${e.employee_code}goals`);
      (goalBank[e.department] || goalBank.default).forEach(([title, target, weight]) => {
        const progress = Math.round((0.3 + r() * 0.7) * 100);
        goals.push({ id: `GL-${gid++}`, employee_code: e.employee_code, title, target, weight, progress, due: isoDate(now + (40 + Math.round(r() * 60)) * DAY), status: progress >= 100 ? "done" : progress < 45 ? "at_risk" : "on_track", updated_at: new Date(now - Math.round(r() * 10) * DAY).toISOString() });
      });
    });
  const feedback = [
    { id: "FB-1", from: "EMP007", to: "EMP001", type: "praise", text: "Great job on the on-call runbook — the rollback steps saved us on Friday.", at: new Date(now - 4 * DAY).toISOString(), visibility: "public" },
    { id: "FB-2", from: "EMP004", to: "EMP001", type: "praise", text: "Thanks for pairing on the latency fix.", at: new Date(now - 9 * DAY).toISOString(), visibility: "public" },
    { id: "FB-3", from: "EMP024", to: "EMP022", type: "suggestion", text: "Log follow-ups the same day so the pipeline stays current.", at: new Date(now - 2 * DAY).toISOString(), visibility: "private" },
  ];

  // ── Recruitment & onboarding (Sahayog modules 01–02) ──
  const reqs = [
    { id: "R-2601", role: "Senior Backend Engineer", dept: "Engineering", open: "2026-07-06", n: 2, closed: "2026-09-18", cost: 240000, hiring_manager: "EMP007" },
    { id: "R-2602", role: "Payroll Specialist", dept: "Finance", open: "2026-08-03", n: 1, closed: "2026-09-10", cost: 45000, hiring_manager: "EMP003" },
    { id: "R-2603", role: "Support Associate", dept: "Operations", open: "2026-07-20", n: 4, closed: "", cost: 60000, hiring_manager: "EMP005" },
    { id: "R-2604", role: "Account Executive", dept: "Sales", open: "2026-09-01", n: 2, closed: "", cost: 35000, hiring_manager: "EMP024" },
    { id: "R-2605", role: "Data Analyst", dept: "Data Migration", open: "2026-10-01", n: 1, closed: "", cost: 15000, hiring_manager: "EMP009" },
  ];
  const funnel = { "R-2601": [184, 62, 18, 3, 2], "R-2602": [76, 20, 6, 1, 1], "R-2603": [310, 95, 28, 5, 2], "R-2604": [98, 30, 9, 1, 0], "R-2605": [41, 12, 0, 0, 0] };
  reqs.forEach((q) => {
    [q.app, q.scr, q.int, q.off, q.acc] = funnel[q.id];
  });
  const cands = [
    ["Kavya Menon", "R-2603", "interview", "Referral", 4],
    ["Rohan Gupta", "R-2603", "offer", "Job portal", 4],
    ["Sameer Ali", "R-2603", "screen", "Job portal", 3],
    ["Pooja Iyer", "R-2603", "applied", "Campus", 0],
    ["Arjun Nair", "R-2604", "interview", "Agency", 4],
    ["Ishita Bose", "R-2604", "offer", "Referral", 5],
    ["Vikas Yadav", "R-2604", "screen", "Job portal", 3],
    ["Nikhil Joshi", "R-2605", "hired", "Referral", 5],
    ["Anjali Desai", "R-2605", "screen", "Job portal", 3],
    ["Tarun Mehta", "R-2605", "applied", "Careers page", 0],
  ];
  const candidates = cands.map(([name, req, stage, source, rating], i) => ({ id: `CD-${i + 1}`, name, req_id: req, stage, source, rating, email: `${name.split(" ")[0].toLowerCase()}@mail.demo`, updated_at: new Date(now - (i + 1) * DAY).toISOString() }));
  const onbTasks = [["Offer letter signed", -14], ["Documents & KYC verified", -7], ["Laptop & accounts ready", 0], ["Payroll & bank set up", 0], ["Buddy assigned", 1], ["Policy acknowledgement", 2], ["Orientation completed", 3], ["30-day check-in", 30]];
  const onboarding = [
    { id: "ONB-1", employee_code: "EMP010", name: "Rahul Verma", role: "Associate Data Engineer", dept: "Data Migration", doj: employees.find((e) => e.employee_code === "EMP010")?.date_of_joining, done: [true, true, true, true, true, false, true, false], buddy: "EMP008" },
    { id: "ONB-2", employee_code: "EMP012", name: "Meera Nair", role: "Software Engineer", dept: "Engineering", doj: employees.find((e) => e.employee_code === "EMP012")?.date_of_joining, done: [true, true, false, false, false, false, false, false], buddy: "EMP004" },
    { id: "ONB-3", employee_code: null, name: "Nikhil Joshi", role: "Data Analyst", dept: "Data Migration", doj: isoDate(now + 7 * DAY), done: [true, false, false, false, false, false, false, false], buddy: "EMP021" },
  ];

  // ── Learning, benefits, wellness, workforce, analytics, succession ──
  const courses = [
    { t: "Secure Coding Fundamentals", p: "Internal", cost: 0, h: 6, en: 5, co: 4, pre: 58, post: 81 },
    { t: "Advanced SQL for Analysts", p: "External", cost: 12000, h: 16, en: 4, co: 3, pre: 52, post: 74 },
    { t: "POSH Awareness (mandatory)", p: "Internal", cost: 0, h: 2, en: 16, co: 13, pre: 70, post: 92 },
    { t: "Manager Essentials", p: "External", cost: 35000, h: 24, en: 4, co: 2, pre: 55, post: 71 },
    { t: "Customer Empathy Workshop", p: "External", cost: 8000, h: 8, en: 6, co: 6, pre: 61, post: 79 },
  ];
  const trainH = {};
  const benefits = {};
  employees.forEach((e, i) => {
    trainH[e.employee_code] = [18, 6, 22, 12, 30, 9, 26, 14, 20, 4, 11, 0, 16, 8, 15, 10, 12, 7, 5, 9, 13, 6][i % 22];
    benefits[e.employee_code] = { tier: ["F", "S", "S1", "F", "F", "S", "F", "S1", "F", "S", "S", "S", "S1", "S", "S"][i % 15], nps: [10, 0, 5, 0, 14, 0, 10, 5, 10, 0, 0, 0, 5, 0, 0][i % 15], meal: i % 3 !== 1 };
  });
  const healthTiers = { S: { l: "Self", p: 9000 }, S1: { l: "Self + spouse", p: 16500 }, F: { l: "Family floater", p: 24000 } };
  const programs = [
    { n: "Annual health check", b: 96000, p: 14, u: "participants" },
    { n: "Yoga & mobility (weekly)", b: 48000, p: 7, u: "participants" },
    { n: "Employee assistance (EAP)", b: 60000, p: 11, u: "sessions" },
    { n: "Step challenge", b: 15000, p: 10, u: "participants" },
  ];
  // Anonymous pulse responses: department + month only, never the employee code.
  const month = today.slice(0, 7);
  const pulses = [];
  active.forEach((e) => {
    if (e.employee_code === "EMP001") return;
    const r = rng(`${e.employee_code}pulse`);
    pulses.push({ dept: e.department, month, stress: 1 + Math.round(r() * 4), sleep: 2 + Math.round(r() * 3), activity: 1 + Math.round(r() * 4), energy: 2 + Math.round(r() * 3), in_programme: r() < 0.6 });
  });
  const pulseSubmitted = { [month]: active.filter((e) => e.employee_code !== "EMP001").map((e) => e.employee_code) };
  const budget = { Engineering: { hc: 8, cost: 2400000 }, "Data Migration": { hc: 5, cost: 1000000 }, People: { hc: 2, cost: 260000 }, Finance: { hc: 2, cost: 420000 }, Operations: { hc: 3, cost: 650000 }, Design: { hc: 1, cost: 120000 }, Marketing: { hc: 2, cost: 160000 }, Sales: { hc: 7, cost: 2600000 } };
  const shifts = { G: ["General 09:30–18:30", 8], M: ["Morning 06:00–15:00", 8], N: ["Night 21:00–06:00", 8], O: ["Off", 0] };
  const rosterWeek = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return isoDate(d);
  })();
  const roster = { EMP013: ["M", "M", "G", "G", "N", "O", "O"], EMP008: ["G", "G", "N", "N", "G", "O", "O"], EMP010: ["N", "N", "G", "G", "M", "O", "O"], EMP014: ["G", "M", "M", "G", "G", "O", "O"] };
  const hcTrend = [15, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
  const exits = [
    { d: "2025-12-12", dept: "Engineering", ctry: "IN", type: "Voluntary", r: "Compensation" },
    { d: "2026-02-27", dept: "Sales", ctry: "IN", type: "Voluntary", r: "Career growth" },
    { d: "2026-04-10", dept: "Operations", ctry: "IN", type: "Involuntary", r: "Performance" },
    { d: "2026-06-30", dept: "Operations", ctry: "IN", type: "Voluntary", r: "Relocation" },
    { d: "2026-08-14", dept: "Engineering", ctry: "IN", type: "Voluntary", r: "Career growth" },
  ];
  const succession = [
    { id: "SC-1", role: "Engineering Manager", incumbent: "EMP007", successors: [["EMP009", "1-2"], ["EMP004", "3+"]] },
    { id: "SC-2", role: "Operations Head", incumbent: "EMP005", successors: [["EMP024", "1-2"]] },
    { id: "SC-3", role: "Sales Manager – India", incumbent: "EMP024", successors: [["EMP022", "3+"]] },
    { id: "SC-4", role: "Lead – Data Migration", incumbent: "EMP009", successors: [["EMP008", "now"], ["EMP021", "1-2"]] },
    { id: "SC-5", role: "People Operations Lead", incumbent: "EMP002", successors: [] },
    { id: "SC-6", role: "Senior Accountant", incumbent: "EMP003", successors: [["EMP013", "3+"]] },
  ];
  const cycle = { id: "CYC-2026H2", name: "H2 2026 performance review", stage: "self_review", cutoff: "2026-07-01", self_due: isoDate(now + 6 * DAY), manager_due: isoDate(now + 16 * DAY), calibration_due: isoDate(now + 24 * DAY) };

  return {
    geofences: GEOFENCES,
    devices: DEVICES.map((d) => ({ ...d, last_sync: new Date(now - (d.status === "online" ? 4 : 2 * 24 * 60) * 60000).toISOString(), enrolled: employees.filter((e) => e.biometric_id && e.primary_geofence === d.geofence_id).length })),
    punches,
    locations,
    consents,
    activity,
    calls,
    assets,
    perf,
    reviews,
    goals,
    feedback,
    cycle,
    reqs,
    candidates,
    onbTasks,
    onboarding,
    courses,
    trainH,
    benefits,
    healthTiers,
    programs,
    pulses,
    pulseSubmitted,
    budget,
    shifts,
    roster,
    rosterWeek,
    hcTrend,
    exits,
    succession,
    revenue: 480000000,
    fx: { INR: 1, GBP: 112, USD: 88, AED: 24, SGD: 68, NAD: 4.9, ZAR: 4.9, KES: 0.68, NGN: 0.058, BWP: 6.5, CAD: 63, MXN: 4.8, BRL: 16, EUR: 102, SAR: 23.5, MYR: 20.8, PHP: 1.5, IDR: 0.0053, GHS: 8, ZMW: 3.8 },
    payrollRuns: [],
    demo_clock: demoClock ? { at: "14:30", seeded_at: new Date(now).toISOString() } : null,
    deviceKeys: {},
  };
}
