// Time & workforce additions (v10): live attendance board (who is in right now, check-in density, live team pulse),
// shift scheduling with a weekly roster, swap requests and timesheets that feed straight into payroll,
// and the employee's "My shifts & timesheet".
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Card, Chip, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { Fingerprint, Groups, EventBusy, AccessTime, Place, Login, Schedule, SwapHoriz, Publish, AutoFixHigh, SendRounded, Face, Smartphone, Computer } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, TableWrap, PersonCell, EmptyState, Avatar } from "../../components/kit/UI.jsx";
import { ModuleHub, Pill, StatusPill, TwoCol, Hint, C, Progress, Ring } from "../../components/suite/Hub.jsx";
import { dayAttendance } from "../../lib/hrcalc.js";
import { fmtDate, isoDate } from "../../lib/utils.js";

const SRC = { biometric_fp: ["Fingerprint", <Fingerprint key="f" />], biometric_face: ["Face", <Face key="fa" />], geo_mobile: ["Mobile GPS", <Smartphone key="m" />], web: ["Web", <Computer key="w" />] };
const ATT_TABS0 = [["live", "Live board", "/live-board"], ["shifts", "Shift roster", "/shifts"], ["timesheets", "Timesheets → payroll", "/timesheets"]];
// v10.6: Employee monitoring joins the live board (same people, same day); HR doesn't see Timesheets → payroll.
export function useAttTabs() {
  const { user } = useStore();
  const hr = user.role === "admin" && (user.access_profile === "hr" || (!user.access_profile && (user.modules || []).includes("accounts") && !(user.modules || []).includes("payroll")));
  const mon = user.role === "superadmin" || (user.modules || []).includes("monitoring");
  return [...ATT_TABS0.filter((t) => !(hr && t[0] === "timesheets")), ...(mon ? [["monitoring", "Employee monitoring", "/monitoring"]] : [])];
}

function latestDay(punches) {
  const today = isoDate();
  if (punches.some((p) => p.ts.startsWith(today))) return today;
  return punches.map((p) => p.ts.slice(0, 10)).sort().pop() || today;
}

// ── Live board ──────────────────────────────────────────────────────────────────
export function LiveBoard() {
  const { data } = useStore();
  const navigate = useNavigate();
  const day = latestDay(data.punches);
  const replay = day !== isoDate(); // weekend / before anyone punched: show the last working day as it stood at 14:30
  const cutoff = replay ? new Date(`${day}T14:30:00`).getTime() : Infinity;
  const active = data.employees.filter((e) => e.status === "active");
  const fenceName = Object.fromEntries((data.geofences || []).map((g) => [g.id, g.name]));
  const people = active.map((e) => {
    const ps = data.punches.filter((p) => p.employee_code === e.employee_code && p.ts.startsWith(day) && new Date(p.ts).getTime() <= cutoff);
    const a = dayAttendance(ps);
    const leave = data.requests.some((r) => r.type === "leave" && r.status === "Approved" && r.employee_code === e.employee_code && r.from_date <= day && r.to_date >= day);
    const remote = a.first && (a.first.source === "geo_mobile" && !a.first.inside || a.first.source === "web");
    const state = leave ? "leave" : !a.first ? "not_in" : a.open ? (remote ? "remote" : "in") : "out";
    return { e, a, state, late: a.late, where: a.first?.geofence_id ? fenceName[a.first.geofence_id] || a.first.geofence_id : a.first?.source === "web" ? "Web" : "—" };
  });
  const inNow = people.filter((p) => p.state === "in").length;
  const remote = people.filter((p) => p.state === "remote").length;
  const out = people.filter((p) => p.state === "out").length;
  const notIn = people.filter((p) => p.state === "not_in").length;
  const leave = people.filter((p) => p.state === "leave").length;
  const late = people.filter((p) => p.late).length;
  const punchedToday = inNow + remote + out;
  // check-in density, 15-minute slots 08:30 → 11:00
  const buckets = Array.from({ length: 10 }, (_, i) => { const m = 510 + i * 15; return { label: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, m, n: 0 }; });
  people.forEach((p) => { if (!p.a.inT) return; const [h, mm] = p.a.inT.split(":").map(Number); const t = h * 60 + mm; const b = buckets.find((x) => t >= x.m && t < x.m + 15) || (t >= 660 ? buckets[buckets.length - 1] : null); if (b) b.n += 1; });
  const maxB = Math.max(1, ...buckets.map((b) => b.n));
  const bySrc = Object.entries(people.filter((p) => p.a.first).reduce((m, p) => ({ ...m, [p.a.first.source]: (m[p.a.first.source] || 0) + 1 }), {}));
  const byLoc = Object.entries(people.filter((p) => p.a.first).reduce((m, p) => ({ ...m, [p.where]: (m[p.where] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const tone = { in: "mint", remote: "navy", out: "purple", not_in: "glob", leave: "warn" };
  const label = { in: "In office", remote: "Remote / field", out: "Clocked out", not_in: "Not in yet", leave: "On leave" };
  const [filter, setFilter] = useState("all");
  return (
    <ModuleHub eyebrow="TIME & ATTENDANCE · LIVE" live="LIVE" title="Attendance" subtitle="Biometric, face, mobile GPS with selfie and web check-ins in one live board. Corrections and approvals flow into leave and payroll." tabs={useAttTabs()} tab="live"
      actions={<Button variant="outlined" onClick={() => navigate("/attendance-admin")}>Register & corrections</Button>}
      brief={{ text: <><b>{inNow} of {active.length}</b> in office right now{replay ? ` (replaying ${fmtDate(day)} at 14:30 — no punches yet today)` : ""} · {remote} remote or in the field · {late} arrived late · {leave} on leave. {notIn ? <><b>{notIn}</b> not in yet.</> : null}</>, actions: [["Nudge latecomers", () => navigate("/attendance-admin")]] }}
      kpis={[
        { label: "In office", value: inNow, hint: `${Math.round((inNow / Math.max(1, active.length)) * 100)}% of ${active.length}`, icon: <Login />, tone: "mint" },
        { label: "Remote / field", value: remote, hint: "GPS or web", icon: <Place />, tone: "navy" },
        { label: "Late", value: late, hint: "after 09:45", icon: <AccessTime />, tone: "glob" },
        { label: "Not in yet", value: notIn, icon: <Schedule />, tone: "purple" },
        { label: "On leave", value: leave, icon: <EventBusy />, tone: "warn" },
        { label: "Clocked out", value: out, icon: <Groups />, tone: "navy" },
      ]}
    >
      <TwoCol right={360}>
        <SectionCard title="Live team pulse" subtitle={`${punchedToday} checked in on ${fmtDate(day)}`} action={<TextField select size="small" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 150 }}><MenuItem value="all">Everyone</MenuItem>{Object.entries(label).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField>}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", xl: "repeat(3,1fr)" }, gap: 1 }}>
            {people.filter((p) => filter === "all" || p.state === filter).map((p) => (
              <Stack key={p.e.employee_code} direction="row" spacing={1} sx={{ alignItems: "center", p: 1, borderRadius: 2, border: 1, borderColor: "divider" }}>
                <Avatar name={p.e.full_name} size={30} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{p.e.full_name}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">{p.a.inT ? `In ${p.a.inT}${p.a.outT ? ` · out ${p.a.outT}` : ""}` : label[p.state]} · {p.where}</Typography>
                </Box>
                <Pill tone={tone[p.state]}>{p.late && p.state !== "leave" ? "late" : label[p.state].split(" ")[0].toLowerCase()}</Pill>
              </Stack>
            ))}
          </Box>
        </SectionCard>
        <Stack spacing={2}>
          <SectionCard title="Check-in density" subtitle="First check-in, 15-minute slots">
            <Stack direction="row" spacing={0.6} sx={{ alignItems: "flex-end", height: 120 }}>
              {buckets.map((b) => <Tooltip key={b.label} title={`${b.label}: ${b.n}`}><Box sx={{ flex: 1, height: `${(b.n / maxB) * 100}%`, minHeight: b.n ? 4 : 1, bgcolor: b.m >= 585 ? C.glob : C.navy, borderRadius: "4px 4px 0 0" }} /></Tooltip>)}
            </Stack>
            <Stack direction="row" sx={{ justifyContent: "space-between", mt: 0.5 }}><Typography variant="caption" color="text.secondary">08:30</Typography><Typography variant="caption" color="text.secondary">09:45 grace</Typography><Typography variant="caption" color="text.secondary">11:00+</Typography></Stack>
          </SectionCard>
          <SectionCard title="How people checked in">
            <Stack spacing={1}>{bySrc.map(([k, n], i) => <Progress key={k} label={SRC[k]?.[0] || k} right={n} value={(n / Math.max(1, punchedToday)) * 100} color={[C.navy, C.glob, C.mintDeep, "#5B4BB7"][i % 4]} />)}</Stack>
          </SectionCard>
          <SectionCard title="By location" noPad>{byLoc.map(([k, n]) => <Stack key={k} direction="row" sx={{ px: 2, py: 0.8, borderBottom: 1, borderColor: "divider", justifyContent: "space-between" }}><Typography variant="body2">{k}</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{n}</Typography></Stack>)}</SectionCard>
        </Stack>
      </TwoCol>
    </ModuleHub>
  );
}

// ── Shift roster ────────────────────────────────────────────────────────────────
function weekStart(off = 0) { const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow + off * 7); return isoDate(d); }
function weekDays(ws) { return Array.from({ length: 7 }, (_, i) => { const d = new Date(`${ws}T12:00:00`); d.setDate(d.getDate() + i); return isoDate(d); }); }
function defaultRow(e, i) {
  if (e.department === "Operations") return ["M", "M", "E", "E", "N", "O", "O"].map((_, k) => ["M", "E", "N", "M", "E", "O", "O"][(k + i) % 7]);
  return ["G", "G", "G", "G", "G", "O", "O"];
}
export function rosterFor(data, ws) {
  const saved = data.suite?.roster?.[ws] || {};
  return Object.fromEntries(data.employees.filter((e) => e.status === "active" && (e.country_code || "IN") === "IN").map((e, i) => [e.employee_code, saved[e.employee_code] || defaultRow(e, i)]));
}

export function Shifts({ tab = "shifts" }) {
  const { data, suiteDo, suiteCan, notifyToast, nameOf } = useStore();
  const attTabs = useAttTabs();
  const [off, setOff] = useState(0);
  const [dept, setDept] = useState("all");
  const ws = weekStart(off);
  const days = weekDays(ws);
  const tpl = data.suite?.shiftTemplates || [];
  const byCode = Object.fromEntries(tpl.map((t) => [t.code, t]));
  const [roster, setRoster] = useState(() => rosterFor(data, ws));
  React.useEffect(() => setRoster(rosterFor(data, ws)), [ws, data.suite?.roster]); // eslint-disable-line react-hooks/exhaustive-deps
  const can = suiteCan("shifts");
  const emps = data.employees.filter((e) => roster[e.employee_code] && (dept === "all" || e.department === dept));
  const depts = [...new Set(data.employees.filter((e) => roster[e.employee_code]).map((e) => e.department))];
  // v10.6: update the roster by picking the shift from a drop-down in each cell (then Publish week).
  const setCell = (code, i, v) => setRoster((r) => { const row = [...r[code]]; row[i] = v; return { ...r, [code]: row }; });
  const cycle = (code, i) => { if (!can) return; setRoster((r) => { const row = [...r[code]]; const idx = tpl.findIndex((t) => t.code === row[i]); row[i] = tpl[(idx + 1) % tpl.length].code; return { ...r, [code]: row }; }); };
  const coverage = days.map((_, i) => tpl.filter((t) => t.code !== "O").map((t) => [t.code, emps.filter((e) => roster[e.employee_code][i] === t.code).length]));
  function publish() {
    const r = suiteDo("shifts", (s) => { s.roster = { ...(s.roster || {}), [ws]: roster }; }, { action: "ROSTER_PUBLISH", details: `Week of ${ws} · ${Object.keys(roster).length} people`, note: { to: Object.keys(roster), text: `Your shifts for the week of ${fmtDate(ws)} are published.`, link: "/my-shifts" } });
    if (r.ok) notifyToast("Roster published — everyone was notified on the app.");
  }
  function autoRoster() { setRoster(Object.fromEntries(Object.keys(roster).map((c, i) => { const e = data.employees.find((x) => x.employee_code === c); return [c, defaultRow(e, i + off)]; }))); notifyToast("Rotated fairly — night shifts spread evenly, two days off each. Review, then publish."); }
  function decideSwap(id, status) { suiteDo("shifts", (s) => { const w = s.swaps.find((x) => x.id === id); w.status = status; return { emp: w.employee_code }; }, { action: "SHIFT_SWAP", details: `${id} ${status}`, note: (r) => ({ to: r.emp, text: `Your shift swap was ${status}.`, link: "/my-shifts" }) }); }

  if (tab === "timesheets") return <Timesheets />;
  return (
    <ModuleHub eyebrow="TIME & WORKFORCE · SHIFTS" title="Attendance" subtitle="Plan shifts week by week, let people swap, and send worked hours, overtime and night allowances straight to payroll." tabs={attTabs} tab="shifts"
      actions={<Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<AutoFixHigh />} onClick={autoRoster} disabled={!can}>Auto-roster</Button><Button variant="contained" startIcon={<Publish />} onClick={publish} disabled={!can}>Publish week</Button></Stack>}
      brief={{ text: <>Week of <b>{fmtDate(ws)}</b>: {emps.length} people rostered, {(data.suite?.swaps || []).filter((s) => s.status === "pending").length} swap request(s) waiting. Pick a shift from the drop-down in any cell to update the roster, then publish the week.</> }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
          <Button size="small" onClick={() => setOff(off - 1)}>← Previous</Button><Button size="small" onClick={() => setOff(0)}>This week</Button><Button size="small" onClick={() => setOff(off + 1)}>Next →</Button>
          <TextField select size="small" value={dept} onChange={(e) => setDept(e.target.value)} sx={{ minWidth: 170 }}><MenuItem value="all">All departments</MenuItem>{depts.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}</TextField>
          <Box sx={{ flex: 1 }} />
          {tpl.map((t) => <Chip key={t.code} size="small" label={`${t.code} · ${t.name}${t.start ? ` ${t.start}–${t.end}` : ""}`} sx={{ bgcolor: t.color, color: "#fff", fontWeight: 600 }} />)}
        </Stack>
        <SectionCard noPad>
          <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell>{days.map((d) => <TableCell key={d} align="center">{new Date(`${d}T12:00:00`).toLocaleDateString("en", { weekday: "short", day: "2-digit" })}</TableCell>)}<TableCell align="right">Hours</TableCell></TableRow></TableHead>
            <TableBody>
              {emps.map((e) => {
                const row = roster[e.employee_code];
                const hrs = row.reduce((s, c) => { const t = byCode[c]; if (!t?.start) return s; const [a, b] = [t.start, t.end].map((x) => +x.slice(0, 2) * 60 + +x.slice(3)); return s + (((b - a + 1440) % 1440) - t.brk) / 60; }, 0);
                return (
                  <TableRow key={e.employee_code}><TableCell><PersonCell name={e.full_name} sub={e.department} /></TableCell>
                    {row.map((c, i) => <TableCell key={i} align="center" sx={{ p: 0.5 }}>{can ? (
                      <TextField select size="small" value={c} onChange={(ev) => setCell(e.employee_code, i, ev.target.value)} sx={{ minWidth: 64, "& .MuiInputBase-root": { bgcolor: byCode[c]?.color || "#999", color: "#fff", fontWeight: 800, fontSize: "0.72rem", borderRadius: 1.2 }, "& .MuiSelect-icon": { color: "#fff" }, "& fieldset": { border: 0 } }}>
                        {tpl.map((t) => <MenuItem key={t.code} value={t.code}>{t.code} · {t.name}{t.start ? ` ${t.start}–${t.end}` : ""}</MenuItem>)}
                      </TextField>
                    ) : (<Box sx={{ borderRadius: 1.2, py: 0.6, fontWeight: 800, fontSize: "0.72rem", color: "#fff", bgcolor: byCode[c]?.color || "#999" }}>{c}</Box>)}</TableCell>)}
                    <TableCell align="right" sx={{ fontWeight: 700, color: hrs > 48 ? "error.main" : undefined }}>{hrs.toFixed(0)}h</TableCell></TableRow>
                );
              })}
              <TableRow><TableCell sx={{ fontWeight: 700 }}>Coverage</TableCell>{coverage.map((c, i) => <TableCell key={i} align="center"><Typography variant="caption">{c.filter(([, n]) => n).map(([k, n]) => `${k}${n}`).join(" ")}</Typography></TableCell>)}<TableCell /></TableRow>
            </TableBody></Table></TableWrap>
        </SectionCard>
        <SectionCard title="Swap requests" noPad>
          {(data.suite?.swaps || []).length === 0 ? <EmptyState title="No swap requests" /> : <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Requested by</TableCell><TableCell>Swap with</TableCell><TableCell>Day</TableCell><TableCell>Change</TableCell><TableCell>Status</TableCell><TableCell align="right" /></TableRow></TableHead>
            <TableBody>{data.suite.swaps.map((s) => <TableRow key={s.id}><TableCell>{nameOf(s.employee_code)}</TableCell><TableCell>{nameOf(s.with)}</TableCell><TableCell>{fmtDate(s.day)}</TableCell><TableCell>{byCode[s.from]?.name} → {byCode[s.to]?.name}</TableCell><TableCell><StatusPill status={s.status} /></TableCell>
              <TableCell align="right">{s.status === "pending" && <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}><Button size="small" disabled={!can} onClick={() => decideSwap(s.id, "approved")}>Approve</Button><Button size="small" color="error" disabled={!can} onClick={() => decideSwap(s.id, "rejected")}>Reject</Button></Stack>}</TableCell></TableRow>)}</TableBody></Table></TableWrap>}
        </SectionCard>
      </Stack>
    </ModuleHub>
  );
}

// ── Timesheets → payroll ────────────────────────────────────────────────────────
function Timesheets() {
  const { data, suiteDo, suiteCan, notifyToast } = useStore();
  const attTabs = useAttTabs();
  const can = suiteCan("payroll") || suiteCan("shifts");
  const month = isoDate().slice(0, 7);
  const ws = weekStart(0);
  const roster = rosterFor(data, ws);
  const night = data.suite?.shiftTemplates?.find((t) => t.code === "N")?.night_allowance || 0;
  const rows = useMemo(() => data.employees.filter((e) => e.status === "active" && (e.country_code || "IN") === "IN").map((e) => {
    const days = [...new Set(data.punches.filter((p) => p.employee_code === e.employee_code && p.ts.startsWith(month)).map((p) => p.ts.slice(0, 10)))];
    const att = days.map((d) => dayAttendance(data.punches.filter((p) => p.employee_code === e.employee_code && p.ts.startsWith(d))));
    const hours = att.reduce((s, a) => s + a.hours, 0), ot = att.reduce((s, a) => s + a.ot, 0);
    const nights = (roster[e.employee_code] || []).filter((c) => c === "N").length * 4;
    return { e, days: days.length, hours, ot, nights, allowance: nights * night, eligible: ["P1", "P2"].includes(e.grade_code) };
  }), [data.punches, data.employees, month]); // eslint-disable-line react-hooks/exhaustive-deps
  function push() {
    const r = suiteDo("payroll", (s) => {
      const v = { ...(s.variable?.[month] || {}) };
      rows.forEach((x) => { if (!x.allowance && !(x.eligible && x.ot >= 1)) return; const cur = v[x.e.employee_code] || { hours: 0, hourly_rate: 0, ot_hours: 0, bonus: 0, commission: 0, note: "" }; v[x.e.employee_code] = { ...cur, ot_hours: x.eligible ? Math.round(x.ot) : cur.ot_hours, bonus: (cur.bonus_base ?? cur.bonus) + x.allowance, bonus_base: cur.bonus_base ?? cur.bonus, note: [cur.note, x.allowance ? `Night allowance ${x.nights} nights` : "", x.eligible && x.ot >= 1 ? "OT from timesheet" : ""].filter(Boolean).join(" · ") }; });
      s.variable = { ...(s.variable || {}), [month]: v };
    }, { action: "TIMESHEET_TO_PAYROLL", details: `${month} · ${rows.length} timesheets` });
    if (r.ok) notifyToast("Overtime and night allowances sent to this month's payroll.");
    else notifyToast("Only Finance (payroll) or a Super Admin can push to payroll.", "info");
  }
  return (
    <ModuleHub eyebrow="TIME & WORKFORCE · TIMESHEETS" title="Attendance" subtitle="Worked hours from biometric, mobile and web punches; overtime for eligible grades (P1–P2, 2× in India) and night-shift allowance — pushed to payroll in one click." tabs={attTabs} tab="timesheets"
      actions={<Button variant="contained" startIcon={<SendRounded />} onClick={push} disabled={!can}>Send to payroll</Button>}
      brief={{ text: <>{rows.length} timesheets this month · <b>{rows.reduce((s, r) => s + (r.eligible ? r.ot : 0), 0).toFixed(0)} h</b> payable overtime · night allowance <b>₹{rows.reduce((s, r) => s + r.allowance, 0).toLocaleString("en-IN")}</b>.</> }}>
      <SectionCard noPad>
        <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell align="right">Days</TableCell><TableCell align="right">Hours</TableCell><TableCell align="right">Overtime</TableCell><TableCell>OT eligible</TableCell><TableCell align="right">Night shifts</TableCell><TableCell align="right">Allowance</TableCell></TableRow></TableHead>
          <TableBody>{rows.map((r) => <TableRow key={r.e.employee_code}><TableCell><PersonCell name={r.e.full_name} sub={`${r.e.grade_code} · ${r.e.department}`} /></TableCell><TableCell align="right">{r.days}</TableCell><TableCell align="right">{r.hours.toFixed(1)}</TableCell><TableCell align="right">{r.ot.toFixed(1)}</TableCell><TableCell>{r.eligible ? <Pill tone="mint">yes</Pill> : <Pill>no</Pill>}</TableCell><TableCell align="right">{r.nights}</TableCell><TableCell align="right">₹{r.allowance.toLocaleString("en-IN")}</TableCell></TableRow>)}</TableBody></Table></TableWrap>
      </SectionCard>
    </ModuleHub>
  );
}

// ── Employee: My shifts & timesheet ─────────────────────────────────────────────
export function MyShifts() {
  const { data, user, suiteDo, notifyToast, nameOf } = useStore();
  const me = data.employees.find((e) => e.employee_code === user.employee_code);
  // v10.6: contract / freelance workers don't swap shifts; everyone can ask for a shift-time change.
  const contingent = ["contract", "freelance", "consultant", "agency", "temporary", "intern", "apprentice"].includes(me.worker_type);
  const ws = weekStart(0);
  const days = weekDays(ws);
  const row = rosterFor(data, ws)[me.employee_code] || ["G", "G", "G", "G", "G", "O", "O"];
  const byCode = Object.fromEntries((data.suite?.shiftTemplates || []).map((t) => [t.code, t]));
  const mates = data.employees.filter((e) => e.status === "active" && e.department === me.department && e.employee_code !== me.employee_code);
  const [sw, setSw] = useState({ day: days[2], with: mates[0]?.employee_code || "", to: "E" });
  const month = isoDate().slice(0, 7);
  const myDays = [...new Set(data.punches.filter((p) => p.employee_code === me.employee_code && p.ts.startsWith(month)).map((p) => p.ts.slice(0, 10)))].sort().reverse();
  function ask() {
    const from = row[days.indexOf(sw.day)];
    const r = suiteDo("swap", (s, { now, me: code }) => { s.swaps = [{ id: `SW-${Date.now()}`, employee_code: code, with: sw.with, day: sw.day, from, to: sw.to, status: "pending", at: now }, ...(s.swaps || [])]; }, { action: "SHIFT_SWAP_REQUEST", details: `${me.employee_code} ${sw.day}`, note: { to: [sw.with, me.reporting_manager].filter(Boolean), text: `${me.full_name} asked to swap shifts on ${fmtDate(sw.day)} — approve it in Attendance → Timesheet & shifts.`, link: "/my-shifts" } });
    if (r.ok) notifyToast("Swap request sent to your teammate and manager.");
  }
  return (
    <ModuleHub eyebrow="ME · SHIFTS" title="Timesheet & shifts" subtitle="Your roster for the week, shift-time changes and swap requests (approved by your reporting manager), and the hours that go to payroll.">
      <Stack spacing={2}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(4,1fr)", md: "repeat(7,1fr)" }, gap: 1 }}>
          {days.map((d, i) => { const t = byCode[row[i]]; return (
            <Card key={d} sx={{ p: 1.4, borderTop: `4px solid ${t?.color || "#ccc"}`, bgcolor: d === isoDate() ? "rgba(0,74,119,0.04)" : undefined }}>
              <Typography variant="caption" color="text.secondary">{new Date(`${d}T12:00:00`).toLocaleDateString("en", { weekday: "short", day: "2-digit", month: "short" })}</Typography>
              <Typography sx={{ fontWeight: 800, color: t?.color }}>{t?.name}</Typography>
              <Typography variant="caption">{t?.start ? `${t.start} – ${t.end}` : "Rest day"}</Typography>
            </Card>
          ); })}
        </Box>
        <TwoCol right={360}>
          <SectionCard title={`Timesheet · ${new Date().toLocaleString("en", { month: "long" })}`} noPad>
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Day</TableCell><TableCell>In</TableCell><TableCell>Out</TableCell><TableCell align="right">Hours</TableCell><TableCell align="right">Overtime</TableCell><TableCell>Method</TableCell></TableRow></TableHead>
              <TableBody>{myDays.slice(0, 12).map((d) => { const a = dayAttendance(data.punches.filter((p) => p.employee_code === me.employee_code && p.ts.startsWith(d))); return <TableRow key={d}><TableCell>{fmtDate(d)}</TableCell><TableCell>{a.inT || "—"}</TableCell><TableCell>{a.outT || "—"}</TableCell><TableCell align="right">{a.hours.toFixed(1)}</TableCell><TableCell align="right">{a.ot.toFixed(1)}</TableCell><TableCell>{SRC[a.source]?.[0] || "—"}</TableCell></TableRow>; })}</TableBody></Table></TableWrap>
          </SectionCard>
          <Stack spacing={2}>
          {!contingent && <SectionCard title="Ask for a swap" subtitle={`Goes to ${me.reporting_manager ? nameOf(me.reporting_manager) : "HR"} (your reporting manager) for approval`}>
            <Stack spacing={1.5}>
              <TextField select size="small" label="Day" value={sw.day} onChange={(e) => setSw({ ...sw, day: e.target.value })}>{days.map((d, i) => <MenuItem key={d} value={d}>{fmtDate(d)} · {byCode[row[i]]?.name}</MenuItem>)}</TextField>
              <TextField select size="small" label="Swap with" value={sw.with} onChange={(e) => setSw({ ...sw, with: e.target.value })}>{mates.map((m) => <MenuItem key={m.employee_code} value={m.employee_code}>{m.full_name}</MenuItem>)}</TextField>
              <TextField select size="small" label="Change to" value={sw.to} onChange={(e) => setSw({ ...sw, to: e.target.value })}>{Object.values(byCode).map((t) => <MenuItem key={t.code} value={t.code}>{t.name}</MenuItem>)}</TextField>
              <Button variant="contained" startIcon={<SwapHoriz />} onClick={ask} disabled={!sw.with}>Send request</Button>
            </Stack>
          </SectionCard>}
          <ShiftTimeChange me={me} />
          </Stack>
        </TwoCol>
        <MyShiftRequests me={me} />
        <TeamShiftApprovals me={me} />
      </Stack>
    </ModuleHub>
  );
}

// v10.6 · Employee monitoring as a tab of the live board.
export function MonitoringTab({ children }) {
  return (
    <ModuleHub eyebrow="TIME & WORKFORCE · MONITORING" title="Attendance" subtitle="Active and idle time by app category during work hours, next to the live board and roster. No keystrokes, content or screenshots." tabs={useAttTabs()} tab="monitoring">
      {children}
    </ModuleHub>
  );
}

// v10.6 · Shift-time change request (all workers) → reporting manager approves.
function ShiftTimeChange({ me }) {
  const { suiteDo, notifyToast, nameOf } = useStore();
  const [f, setF] = useState({ date: isoDate(new Date(Date.now() + 86400000)), start: "10:00", end: "19:00", reason: "" });
  function send() {
    if (!f.reason.trim() || f.end <= f.start) return notifyToast("Enter a valid start / end time and the reason.", "error");
    const r = suiteDo("swap", (s, { now, me: code }) => { s.shiftChanges = [{ id: `SC-${Date.now()}`, employee_code: code, ...f, status: "pending", approver: me.reporting_manager || null, at: now }, ...(s.shiftChanges || [])]; }, { action: "SHIFT_TIME_CHANGE_REQUEST", details: `${me.employee_code} ${f.date} ${f.start}-${f.end}`, note: { to: [me.reporting_manager].filter(Boolean), text: `${me.full_name} asked to change their shift time on ${fmtDate(f.date)} to ${f.start}–${f.end}.`, link: "/my-shifts" } });
    if (r.ok) { notifyToast(`Sent to ${me.reporting_manager ? nameOf(me.reporting_manager) : "HR"}.`); setF({ ...f, reason: "" }); }
  }
  return (
    <SectionCard title="Change my shift time" subtitle="For a day you need to start or finish at a different time">
      <Stack spacing={1.5}>
        <TextField type="date" size="small" label="Date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <Stack direction="row" spacing={1}><TextField type="time" size="small" label="Start" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} /><TextField type="time" size="small" label="End" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} /></Stack>
        <TextField size="small" label="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <Button variant="contained" onClick={send}>Send to my manager</Button>
      </Stack>
    </SectionCard>
  );
}

// v10.6 · My shift requests (swaps and time changes) with their status — processed right here in the timesheet.
function MyShiftRequests({ me }) {
  const { data, nameOf } = useStore();
  const byCode = Object.fromEntries((data.suite?.shiftTemplates || []).map((t) => [t.code, t]));
  const rows = [
    ...(data.suite?.swaps || []).filter((x) => x.employee_code === me.employee_code).map((x) => ({ id: x.id, kind: "Swap", day: x.day, what: `${byCode[x.from]?.name || x.from} → ${byCode[x.to]?.name || x.to} with ${nameOf(x.with)}`, status: x.status, at: x.at })),
    ...(data.suite?.shiftChanges || []).filter((x) => x.employee_code === me.employee_code).map((x) => ({ id: x.id, kind: "Time change", day: x.date, what: `${x.start}–${x.end} · ${x.reason}`, status: x.status, at: x.at })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (!rows.length) return null;
  return (
    <SectionCard title="My shift requests" subtitle={`Approved by ${me.reporting_manager ? nameOf(me.reporting_manager) : "HR"}`} noPad>
      <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Type</TableCell><TableCell>Day</TableCell><TableCell>Change</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
        <TableBody>{rows.map((r) => <TableRow key={r.id}><TableCell>{r.kind}</TableCell><TableCell>{fmtDate(r.day)}</TableCell><TableCell>{r.what}</TableCell><TableCell><StatusPill status={r.status} /></TableCell></TableRow>)}</TableBody></Table></TableWrap>
    </SectionCard>
  );
}

// v10.6 · Reporting managers approve their team's swaps and shift-time changes here.
function TeamShiftApprovals({ me }) {
  const { data, suiteDo, notifyToast, nameOf } = useStore();
  const team = new Set(data.employees.filter((e) => e.reporting_manager === me.employee_code).map((e) => e.employee_code));
  if (!team.size) return null;
  const byCode = Object.fromEntries((data.suite?.shiftTemplates || []).map((t) => [t.code, t]));
  const rows = [
    ...(data.suite?.swaps || []).filter((x) => team.has(x.employee_code) && x.status === "pending").map((x) => ({ id: x.id, list: "swaps", emp: x.employee_code, kind: "Swap", day: x.day, what: `${byCode[x.from]?.name || x.from} → ${byCode[x.to]?.name || x.to} with ${nameOf(x.with)}` })),
    ...(data.suite?.shiftChanges || []).filter((x) => team.has(x.employee_code) && x.status === "pending").map((x) => ({ id: x.id, list: "shiftChanges", emp: x.employee_code, kind: "Time change", day: x.date, what: `${x.start}–${x.end} · ${x.reason}` })),
  ];
  const decide = (r, status) => { const res = suiteDo("swap", (s) => { const it = (s[r.list] || []).find((y) => y.id === r.id); if (it) it.status = status; }, { action: "SHIFT_REQUEST_DECIDE", details: `${r.id} ${status}`, note: { to: r.emp, text: `Your shift ${r.kind.toLowerCase()} for ${fmtDate(r.day)} was ${status}.`, link: "/my-shifts" } }); if (res.ok) notifyToast(`${r.kind} ${status}.`); };
  return (
    <SectionCard title="My team's shift requests" subtitle="Swaps and shift-time changes reported to you" noPad>
      {rows.length === 0 ? <EmptyState title="Nothing waiting" /> : <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Type</TableCell><TableCell>Day</TableCell><TableCell>Change</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>{rows.map((r) => <TableRow key={r.id}><TableCell>{nameOf(r.emp)}</TableCell><TableCell>{r.kind}</TableCell><TableCell>{fmtDate(r.day)}</TableCell><TableCell>{r.what}</TableCell><TableCell align="right"><Button size="small" onClick={() => decide(r, "approved")}>Approve</Button><Button size="small" color="error" onClick={() => decide(r, "rejected")}>Reject</Button></TableCell></TableRow>)}</TableBody></Table></TableWrap>}
    </SectionCard>
  );
}
