// AI scheduling assistant. Two parts:
// 1. parseScheduleRequest – turns "45 min with Bindu and Akhil next Tuesday afternoon about Q4 review" into a structured request.
//    A rule-based parser always runs (offline); when Claude is connected the model's JSON is merged over it.
// 2. findSlots – searches real calendars (meetings, interviews, events, leave, holidays), each attendee's working hours
//    in their own time zone, lunch and buffers, and ranks the free slots. The model never invents availability.
import { busyBlocks, directory, localParts, tzOf } from "./collab.js";
import { DAY, isoDate } from "./utils.js";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function parseScheduleRequest(text, { data, me, now = new Date() }) {
  const t = ` ${String(text || "").toLowerCase().replace(/\s+/g, " ")} `;
  const out = { title: "", durationMin: 30, attendees: [], unknownNames: [], from: null, to: null, partOfDay: "any", kind: "meeting", mode: "video", client: "", notes: [] };

  // Duration
  let m = t.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/);
  const mm = t.match(/(\d+)\s*(minutes?|mins?|m)\b/);
  if (m) out.durationMin = Math.round(Number(m[1]) * 60) + (mm && t.indexOf(mm[0]) > t.indexOf(m[0]) ? Number(mm[1]) : 0);
  else if (mm) out.durationMin = Number(mm[1]);
  else if (/half an hour|half-hour/.test(t)) out.durationMin = 30;
  else if (/an hour|one hour/.test(t)) out.durationMin = 60;
  else if (/quick|catch ?up|sync|stand ?up/.test(t)) out.durationMin = 15 + (/catch ?up|sync/.test(t) ? 15 : 0);
  out.durationMin = Math.min(480, Math.max(15, out.durationMin));

  // Window
  const today = startOfDay(now);
  const setDay = (d, span = 1) => {
    out.from = isoDate(d);
    out.to = isoDate(new Date(d.getTime() + (span - 1) * DAY));
  };
  if (/\btoday\b/.test(t)) setDay(today);
  else if (/\bday after tomorrow\b/.test(t)) setDay(new Date(today.getTime() + 2 * DAY));
  else if (/\btomorrow\b/.test(t)) setDay(new Date(today.getTime() + DAY));
  else if (/\bnext week\b/.test(t)) {
    const d = new Date(today);
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    setDay(d, 5);
  } else if (/\bthis week\b/.test(t)) {
    const fri = new Date(today);
    fri.setDate(fri.getDate() + Math.max(0, 5 - fri.getDay()));
    out.from = isoDate(today);
    out.to = isoDate(fri < today ? today : fri);
  }
  const wd = WEEKDAYS.findIndex((w) => new RegExp(`\\b(next |this |on |coming )?${w}\\b`).test(t));
  if (wd >= 0) {
    const d = new Date(today);
    let add = (wd - d.getDay() + 7) % 7;
    if (add === 0) add = 7;
    if (new RegExp(`\\bnext ${WEEKDAYS[wd]}\\b`).test(t) && add < 7 && d.getDay() !== 0 && wd > d.getDay()) add += 7;
    d.setDate(d.getDate() + add);
    setDay(d);
  }
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/) || t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (m) {
    const day = Number(/\d/.test(m[1]) ? m[1] : m[2]);
    const mon = MONTHS.indexOf(/\d/.test(m[1]) ? m[2] : m[1]);
    let d = new Date(now.getFullYear(), mon, day);
    if (d < today) d = new Date(now.getFullYear() + 1, mon, day);
    setDay(d);
  }
  m = t.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
  if (m) setDay(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  m = t.match(/\bwithin (\d+) days?\b|\bin the next (\d+) days?\b/);
  if (m) {
    out.from = isoDate(today);
    out.to = isoDate(new Date(today.getTime() + Number(m[1] || m[2]) * DAY));
  }
  if (!out.from) {
    out.from = isoDate(new Date(today.getTime() + DAY));
    out.to = isoDate(new Date(today.getTime() + 7 * DAY));
    out.notes.push("No date given, so I looked at the next 7 days.");
  }

  // Part of day / exact time
  if (/\bmorning\b|\bbefore lunch\b|\bam\b/.test(t)) out.partOfDay = "morning";
  else if (/\bafternoon\b|\bafter lunch\b/.test(t)) out.partOfDay = "afternoon";
  else if (/\bevening\b|\bend of day\b|\beod\b/.test(t)) out.partOfDay = "evening";
  m = t.match(/\bat (\d{1,2})(?::(\d\d))?\s*(am|pm)?\b/);
  if (m) {
    let h = Number(m[1]);
    if (m[3] === "pm" && h < 12) h += 12;
    if (!m[3] && h < 8) h += 12;
    out.exactTime = h + Number(m[2] || 0) / 60;
  }

  // Kind / mode / client
  if (/\bclient\b|\bcustomer\b|\bprospect\b|\bdemo\b/.test(t)) out.kind = "client";
  if (/\bin person\b|\bin-person\b|\bon ?site\b|\boffice\b|\bvisit\b/.test(t)) out.mode = "in_person";
  else if (/\bphone\b|\bcall\b/.test(t) && !/video call/.test(t)) out.mode = "phone";
  const clientName = (data.clients || []).find((c) => t.includes(` ${c.company.toLowerCase()}`) || t.includes(` ${c.company.toLowerCase().split(" ")[0]} `));
  if (clientName) {
    out.kind = "client";
    out.client = clientName.id;
  }

  // Attendees by first or full name
  const people = directory(data).filter((p) => p.code !== me.code && p.kind === "emp");
  const withPart = (t.match(/\bwith ([^.]+?)(?: about | on | regarding | re:? | for | to discuss |$| next | this | tomorrow| today| at | in the | morning| afternoon| evening| \d)/) || [])[1] || "";
  const scan = ` ${withPart || t} `;
  for (const p of people) {
    const full = p.name.toLowerCase();
    const first = full.split(" ")[0];
    if (scan.includes(` ${full} `) || scan.includes(` ${full},`) || new RegExp(`[ ,]${first}(?:[ ,.'s]|$)`).test(scan)) {
      if (!out.attendees.includes(p.code)) out.attendees.push(p.code);
    }
  }
  if (/\bmy team\b|\bteam\b/.test(withPart) && me.employee_code) {
    data.employees.filter((e) => e.reporting_manager === me.employee_code && e.status === "active").forEach((e) => !out.attendees.includes(e.employee_code) && out.attendees.push(e.employee_code));
  }
  if (withPart) {
    const known = new Set(out.attendees.flatMap((c) => people.find((p) => p.code === c)?.name.toLowerCase().split(" ") || []));
    withPart.split(/,| and | & /).map((s) => s.trim()).filter((s) => s && !["me", "my team", "team", "the team", "client"].includes(s) && !s.split(" ").some((w) => known.has(w)) && !(clientName && s.includes(clientName.company.toLowerCase().split(" ")[0]))).forEach((s) => out.unknownNames.push(s));
  }

  // Title
  m = String(text || "").match(/\b(?:about|regarding|re:?|on|for|to discuss)\s+(.+?)(?:\s+(?:next|this|tomorrow|today|on|at|with|in the)\b.*)?$/i);
  out.title = (m?.[1] || "").replace(/[.?!]+$/, "").trim();
  if (!out.title) out.title = out.kind === "client" ? `Client meeting${clientName ? ` – ${clientName.company}` : ""}` : "Meeting";
  out.title = out.title[0].toUpperCase() + out.title.slice(1);
  return out;
}

/**
 * Ranked free slots for organiser + attendees.
 * Working hours are 09:30–18:30 in each person's own time zone, Monday–Friday; lunch 13:00–14:00 is avoided.
 */
export function findSlots({ data, organizer, attendees = [], durationMin = 30, from, to, partOfDay = "any", exactTime, max = 5, bufferMin = 10, stepMin = 30, workStart = 9.5, workEnd = 18.5 }) {
  const everyone = [...new Set([organizer, ...attendees])].filter(Boolean);
  const dir = directory(data);
  const recOf = (c) => data.employees.find((e) => e.employee_code === c) || data.employees.find((e) => e.employee_code === data.admins.find((a) => a.admin_code === c)?.employee_code) || null;
  const zoneOf = (c) => tzOf(recOf(c));
  const fromD = new Date(`${from}T00:00:00`);
  const toD = new Date(`${to}T23:59:59`);
  const now = new Date();
  const busy = Object.fromEntries(everyone.map((c) => [c, busyBlocks(data, c, fromD.toISOString(), toD.toISOString()).map((b) => ({ ...b, s: new Date(b.start).getTime(), e: new Date(b.end).getTime() }))]));
  const orgZone = zoneOf(organizer);
  const slots = [];
  const dur = durationMin * 60000;
  for (let t = Math.max(fromD.getTime(), Math.ceil(now.getTime() / (stepMin * 60000)) * stepMin * 60000); t + dur <= toD.getTime(); t += stepMin * 60000) {
    const s = new Date(t);
    const e = new Date(t + dur);
    const orgLocal = localParts(s, orgZone);
    if (orgLocal.hour < 7 || orgLocal.hour > 21) continue;
    let ok = true;
    let score = 100;
    const reasons = [];
    const localTimes = [];
    for (const c of everyone) {
      const lp = localParts(s, zoneOf(c));
      const le = localParts(e, zoneOf(c));
      if (["Sat", "Sun"].includes(lp.weekday)) { ok = false; break; }
      if (lp.hour < workStart || le.hour > workEnd || le.hour < lp.hour) { ok = false; break; }
      const clash = busy[c].find((b) => b.s < e.getTime() && b.e > s.getTime());
      if (clash) { ok = false; break; }
      const near = busy[c].find((b) => !b.allDay && (Math.abs(b.e - s.getTime()) < bufferMin * 60000 || Math.abs(e.getTime() - b.s) < bufferMin * 60000));
      if (near) score -= 8;
      if (lp.hour < 14 && le.hour > 13) score -= 15;
      if (zoneOf(c) !== orgZone) localTimes.push(`${(dir.find((p) => p.code === c)?.name || c).split(" ")[0]} ${lp.label} local`);
    }
    if (!ok) continue;
    const h = orgLocal.hour;
    if (exactTime != null) score -= Math.abs(h - exactTime) * 12;
    else if (partOfDay === "morning") score += h < 12.5 ? 12 : -20;
    else if (partOfDay === "afternoon") score += h >= 14 && h < 17 ? 12 : -20;
    else if (partOfDay === "evening") score += h >= 16 ? 12 : -20;
    else score += h >= 10 && h <= 12 ? 6 : h >= 14.5 && h <= 16.5 ? 4 : 0;
    const daysOut = Math.floor((s - startOfDay(now)) / DAY);
    score -= daysOut * 2;
    const dayLoad = everyone.reduce((n, c) => n + busy[c].filter((b) => !b.allDay && localParts(new Date(b.s), orgZone).date === orgLocal.date).length, 0);
    score -= dayLoad * 2;
    reasons.push(everyone.length > 1 ? `All ${everyone.length} free` : "You are free");
    if (!everyone.some((c) => busy[c].some((b) => !b.allDay && (Math.abs(b.e - s.getTime()) < bufferMin * 60000 || Math.abs(e.getTime() - b.s) < bufferMin * 60000)))) reasons.push("no back-to-back");
    if (dayLoad <= 1) reasons.push("light day");
    if (localTimes.length) reasons.push(localTimes.join(", "));
    slots.push({ start: s.toISOString(), end: e.toISOString(), score: Math.round(score), reasons });
  }
  slots.sort((a, b) => b.score - a.score || a.start.localeCompare(b.start));
  // Spread suggestions over different days where possible.
  const picked = [];
  const days = new Set();
  for (const sl of slots) {
    const d = sl.start.slice(0, 10);
    if (days.has(d) && picked.length < max - 1 && slots.some((x) => !days.has(x.start.slice(0, 10)) && !picked.includes(x))) continue;
    picked.push(sl);
    days.add(d);
    if (picked.length >= max) break;
  }
  if (picked.length < max) for (const sl of slots) if (!picked.includes(sl) && picked.length < max) picked.push(sl);
  picked.sort((a, b) => b.score - a.score);
  const conflicts = everyone.map((c) => ({ code: c, name: dir.find((p) => p.code === c)?.name || c, zone: zoneOf(c), busy: busy[c].filter((b) => !b.allDay).length, leave: busy[c].filter((b) => b.kind === "leave").map((b) => b.start.slice(0, 10)), holidays: busy[c].filter((b) => b.kind === "holiday").map((b) => `${b.title} ${b.start.slice(0, 10)}`) }));
  return { slots: picked, people: conflicts, searched: slots.length };
}

/** JSON prompt for the live model. The rule-based result is the offline answer and the merge base. */
export function schedulePrompt({ text, data, me, base }) {
  const people = directory(data).filter((p) => p.kind === "emp").map((p) => `${p.code}: ${p.name} (${p.title}, ${p.country})`).join("\n");
  const clients = (data.clients || []).map((c) => `${c.id}: ${c.company} – ${c.contact}`).join("\n");
  return {
    system:
      "You convert a meeting request into JSON for a scheduling engine. Output ONLY a JSON object with keys: " +
      'title (string), durationMin (number), attendees (array of employee codes from the list), unknownNames (array), from (YYYY-MM-DD), to (YYYY-MM-DD), partOfDay ("morning"|"afternoon"|"evening"|"any"), exactTime (decimal hour or null), kind ("meeting"|"client"), mode ("video"|"in_person"|"phone"), client (client id or ""), agenda (array of 3–5 short strings). ' +
      `Today is ${isoDate()} (${new Date().toDateString()}). The organiser is ${me.full_name} (${me.code}). Never invent people or clients that are not listed.`,
    messages: [{ role: "user", content: `Request: ${text}\n\nPeople:\n${people}\n\nClients:\n${clients || "(none)"}\n\nRule-based draft to improve:\n${JSON.stringify(base)}` }],
  };
}
export function mergeParsed(base, aiText) {
  try {
    const j = JSON.parse(String(aiText).slice(String(aiText).indexOf("{"), String(aiText).lastIndexOf("}") + 1));
    const out = { ...base };
    for (const k of ["title", "durationMin", "from", "to", "partOfDay", "kind", "mode", "client", "agenda"]) if (j[k] != null && j[k] !== "") out[k] = j[k];
    if (j.exactTime != null) out.exactTime = Number(j.exactTime);
    if (Array.isArray(j.attendees) && j.attendees.length) out.attendees = j.attendees;
    if (Array.isArray(j.unknownNames)) out.unknownNames = j.unknownNames;
    out.durationMin = Math.min(480, Math.max(15, Number(out.durationMin) || 30));
    return out;
  } catch {
    return base;
  }
}
