// v10.5 · HR admin dashboard widgets (classic and glass homes):
// my profile card · today's time in / out · average daily working hours · on-time arrival · team members attendance
// today (present / absent / late) · leave approval pending (pending my approval / my requests) · company attendance ·
// employee absenteeism. Data follows the admin's org-unit scope.
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { CheckCircleRounded, CancelRounded, AccessTimeRounded, OpenInNewRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard } from "../kit/UI.jsx";
import { dayAttendance, hoursInRange, fmtHrs } from "../../lib/hrcalc.js";
import { leaveBalances } from "../../lib/requests.js";
import { isoDate, fmtDate } from "../../lib/utils.js";

const C = { navy: "#17404D", teal: "#0B8C8C", blue: "#3949AB", green: "#2E7D32", red: "#D32F2F", amber: "#F9A825", mute: "#78827b" };
const ago = (n) => isoDate(new Date(Date.now() - n * 86400000));
const isWeekend = (d) => [0, 6].includes(new Date(`${d}T12:00:00`).getDay());

function Bar({ value, max, color = C.blue }) {
  return <LinearProgress variant="determinate" value={Math.min(100, max ? (value / max) * 100 : 0)} sx={{ height: 7, borderRadius: 4, background: "#eef1f6", "& .MuiLinearProgress-bar": { background: color, borderRadius: 4 } }} />;
}
function Pills({ value, onChange, items }) {
  return (
    <Stack direction="row" spacing={0.8} sx={{ mb: 1.2 }}>
      {items.map(([k, l, color]) => <Chip key={k} size="small" label={l} onClick={() => onChange(k)} sx={{ fontWeight: 700, fontSize: "0.6rem", bgcolor: value === k ? color : `${color}1f`, color: value === k ? "#fff" : color }} />)}
    </Stack>
  );
}
const Row = ({ children, onClick }) => <Stack direction="row" spacing={1.2} onClick={onClick} sx={{ py: 0.9, borderBottom: "1px solid #f0f2ef", alignItems: "center", cursor: onClick ? "pointer" : "default" }}>{children}</Stack>;

export default function HrDashboardWidgets() {
  const { data, user, nameOf, scopeUnits, pendingForAdmin, decideRequest, notifyToast, switchWorkspace } = useStore();
  const navigate = useNavigate();
  const today = isoDate();
  const units = user.role === "superadmin" ? null : scopeUnits(user);
  const people = useMemo(() => data.employees.filter((e) => e.status === "active" && (!units || units.has(e.department))), [data.employees, units]);
  const me = data.employees.find((e) => e.employee_code === user.employee_code);
  const [teamTab, setTeamTab] = useState("present");
  // v10.6: department-wise view of hours / on-time arrival, and "my team" (people under me) for the attendance card.
  const [statBy, setStatBy] = useState("dept");
  const underMe = useMemo(() => {
    if (!me) return new Set();
    const out = new Set(); const walk = (c) => data.employees.filter((e) => e.reporting_manager === c && e.status === "active").forEach((e) => { if (!out.has(e.employee_code)) { out.add(e.employee_code); walk(e.employee_code); } });
    walk(me.employee_code); return out;
  }, [data.employees, me]);
  const [teamScope, setTeamScope] = useState("mine");
  const [leaveTab, setLeaveTab] = useState("pending");
  const [reject, setReject] = useState(null);

  // Today's attendance for everyone in scope
  const todayRows = useMemo(() => {
    const onLeave = new Set(data.requests.filter((r) => r.type === "leave" && r.status === "Approved" && r.from_date <= today && r.to_date >= today).map((r) => r.employee_code));
    return people.map((e) => {
      const a = dayAttendance(data.punches.filter((p) => p.employee_code === e.employee_code && p.ts.startsWith(today)));
      const status = a.inT ? (a.late ? "late" : "present") : onLeave.has(e.employee_code) ? "leave" : "absent";
      return { e, a, status };
    });
  }, [people, data.punches, data.requests, today]);
  const count = (s) => todayRows.filter((r) => r.status === s).length;
  const scopeRows = teamScope === "mine" && underMe.size ? todayRows.filter((r) => underMe.has(r.e.employee_code)) : todayRows;
  const tcount = (s2) => scopeRows.filter((r) => r.status === s2).length;
  const teamList = scopeRows.filter((r) => (teamTab === "present" ? ["present", "late"].includes(r.status) : r.status === teamTab));

  // Last 30 days: average daily hours and on-time arrival
  const stats = useMemo(() => people.map((e) => {
    const h = hoursInRange(data, e.employee_code, ago(30), today);
    return { e, avg: h.avg || 0, present: h.present || 0, late: h.late || 0, onTime: h.present ? Math.round(((h.present - (h.late || 0)) / h.present) * 100) : null };
  }).filter((x) => x.present > 0), [people, data, today]);
  const topHours = [...stats].sort((a, b) => b.avg - a.avg).slice(0, 5);
  const onTime = [...stats].sort((a, b) => (b.onTime ?? 0) - (a.onTime ?? 0)).slice(0, 5);
  const deptStats = useMemo(() => {
    const by = {};
    stats.forEach((x) => { const d = (by[x.e.department] = by[x.e.department] || { dept: x.e.department, hrs: 0, n: 0, present: 0, late: 0 }); d.hrs += x.avg; d.n += 1; d.present += x.present; d.late += x.late; });
    return Object.values(by).map((d) => ({ ...d, avg: d.n ? d.hrs / d.n : 0, onTime: d.present ? Math.round(((d.present - d.late) / d.present) * 100) : 0 }));
  }, [stats]);
  const deptHours = [...deptStats].sort((a, b) => b.avg - a.avg);
  const deptOnTime = [...deptStats].sort((a, b) => b.onTime - a.onTime);
  const absColor = (pct) => (pct >= 10 ? "#E53950" : pct >= 5 ? "#F27C22" : "#1F9D63");
  const ByToggle = <Pills value={statBy} onChange={setStatBy} items={[["dept", "Department-wise", "#1E88E5"], ["people", "Top 5 people", "#7E57C2"]]} />;

  // Absenteeism by department (working days in the last 30 days with no punch and no approved leave)
  const absenteeism = useMemo(() => {
    const days = []; for (let i = 30; i >= 1; i--) { const d = ago(i); if (!isWeekend(d) && !(data.holidays || []).some((h) => h.date === d && h.type !== "optional")) days.push(d); }
    const punched = new Set(data.punches.map((p) => `${p.employee_code}|${p.ts.slice(0, 10)}`));
    const leave = new Set(); data.requests.filter((r) => r.type === "leave" && r.status === "Approved").forEach((r) => days.forEach((d) => { if (d >= r.from_date && d <= r.to_date) leave.add(`${r.employee_code}|${d}`); }));
    const by = {};
    people.forEach((e) => days.forEach((d) => { if (e.date_of_joining > d) return; const k = `${e.employee_code}|${d}`; const x = (by[e.department] = by[e.department] || { dept: e.department, absent: 0, possible: 0 }); x.possible++; if (!punched.has(k) && !leave.has(k)) x.absent++; }));
    return Object.values(by).map((x) => ({ ...x, pct: x.possible ? Math.round((x.absent / x.possible) * 100) : 0 })).sort((a, b) => b.pct - a.pct).slice(0, 6);
  }, [people, data.punches, data.requests, data.holidays]);

  // Leave approvals
  const pend = user.role === "admin" ? pendingForAdmin(user).requests.filter((r) => r.type === "leave") : data.requests.filter((r) => r.type === "leave" && r.status === "Pending");
  const mine = me ? data.requests.filter((r) => r.type === "leave" && r.employee_code === me.employee_code).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6) : [];
  const ltName = (c) => data.leaveTypes.find((t) => t.code === c)?.name || c;
  const decide = (r, approve, note = "") => { const res = decideRequest(r.request_id, { approve, note }); notifyToast(res.ok ? `${r.request_id} ${approve ? "approved" : "rejected"}.` : res.error, res.ok ? "success" : "error"); return res; };

  // My card
  const myToday = me ? dayAttendance(data.punches.filter((p) => p.employee_code === me.employee_code && p.ts.startsWith(today))) : null;
  const myLeaveTaken = me ? leaveBalances(me, data.leaveTypes, data.requests).reduce((s, b) => s + (b.taken || 0), 0) : 0;
  const overdue = pend.filter((r) => (Date.now() - new Date(r.created_at)) / 86400000 > (data.settings.approval_sla_days || 3)).length;
  const myOt = me ? hoursInRange(data, me.employee_code, `${today.slice(0, 8)}01`, today).days?.reduce((s, d) => s + (d.ot || 0), 0) || 0 : 0;
  const myProjects = me ? ((data.suite?.ijp?.applications) || []).filter((a) => a.employee_code === me.employee_code && a.status === "selected").length : 0;
  const total = todayRows.length || 1;

  const info = (label, value) => (
    <Box><Typography sx={{ fontSize: "0.55rem", color: C.mute }}>{label}</Typography><Typography sx={{ fontSize: "0.66rem", fontWeight: 600, wordBreak: "break-word" }}>{value || "—"}</Typography></Box>
  );

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "300px minmax(0,1fr)" }, gap: 2.2, alignItems: "start", mb: 2.5 }}>
      {/* Profile card */}
      <SectionCard noPad>
        <Box sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: C.navy, fontWeight: 800 }}>{(user.full_name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("")}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: C.navy }}>{user.full_name}</Typography>
              <Typography sx={{ fontSize: "0.62rem", color: C.mute }}>{me?.designation || (user.role === "superadmin" ? "Super Admin" : "HR admin")}</Typography>
              <Typography sx={{ fontSize: "0.58rem", color: C.mute }}>{me?.city || ""}{me?.department ? ` · ${me.department}` : ""}</Typography>
            </Box>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.2 }}>
            {info("Employee ID", me?.employee_code || user.admin_code || user.superadmin_code)}
            {info("Company", (data.companies || []).find((c) => c.company_id === me?.company_id)?.name)}
            {info("Date hired", me?.date_of_joining ? fmtDate(me.date_of_joining) : "")}
            {info("Contracted hours", me ? `${Math.round((Number(me.fte) || 1) * 40)} (FTE ${me.fte || "1.0"})` : "")}
            {info("Official email", me?.email || user.email)}
            {info("Work phone", me?.work_phone)}
            {info("Personal email", me?.personal_email)}
            {info("Personal mobile", me?.personal_mobile || me?.phone)}
            {info("Emergency contact", me?.emergency_contact_name)}
            {info("Emergency mobile", me?.emergency_contact_phone)}
            {info("Blood group", me?.blood_group)}
            {info("Reporting manager", me?.reporting_manager ? nameOf(me.reporting_manager) : "")}
          </Box>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #eef1f3" }}>
          {[["Leaves this year", myLeaveTaken], ["Overdue tasks", overdue], ["Overtime (hrs)", Math.round(myOt * 10) / 10], ["Projects", myProjects]].map(([l, v], i) => (
            <Box key={l} sx={{ p: 1.4, borderRight: i % 2 === 0 ? "1px solid #eef1f3" : 0, borderTop: i > 1 ? "1px solid #eef1f3" : 0 }}>
              <Typography sx={{ fontSize: "0.56rem", color: C.mute }}>{l}</Typography>
              <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: C.navy }}>{v}</Typography>
            </Box>
          ))}
        </Box>
        {!me && <Typography sx={{ px: 2, pb: 1.5, fontSize: "0.58rem", color: C.mute }}>Link your employee record in Users & access to see your own details here.</Typography>}
      </SectionCard>

      <Stack spacing={2.2}>
        {/* Time in / out */}
        <SectionCard noPad>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ p: 2, alignItems: { sm: "center" } }}>
            <Box sx={{ width: 46, height: 46, borderRadius: "50%", display: "grid", placeItems: "center", background: "#e8eaf6", color: C.blue }}><AccessTimeRounded /></Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: "0.6rem", color: C.mute }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</Typography>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: C.blue }}>{fmtHrs(myToday?.hours || 0)} <Typography component="span" sx={{ fontSize: "0.6rem", color: C.mute }}>total work time</Typography></Typography>
            </Box>
            <Box sx={{ textAlign: "center" }}><Typography sx={{ fontSize: "0.58rem", color: C.mute }}>Time in</Typography><Typography sx={{ fontWeight: 800, color: C.blue }}>{myToday?.inT || "--:--"}</Typography></Box>
            <Box sx={{ textAlign: "center" }}><Typography sx={{ fontSize: "0.58rem", color: C.mute }}>Time out</Typography><Typography sx={{ fontWeight: 800, color: C.navy }}>{myToday?.outT || "--:--"}</Typography></Box>
            {me && <Button size="small" variant="contained" onClick={() => { const r = switchWorkspace("emp"); if (r.ok) navigate("/attendance"); else notifyToast(r.error, "error"); }}>{myToday?.inT && !myToday?.outT ? "Tap out" : "Tap in"}</Button>}
          </Stack>
        </SectionCard>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.2 }}>
          <SectionCard title="Average daily working hours" subtitle={`Last 30 days · ${statBy === "dept" ? "by department" : "top 5 people"}`}>
            {ByToggle}
            {statBy === "dept" ? (deptHours.length === 0 ? <Typography sx={{ fontSize: "0.66rem", color: C.mute }}>No punches yet.</Typography> : deptHours.map((x) => (
              <Box key={x.dept} sx={{ mb: 1.2 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }}>{x.dept}</Typography><Typography sx={{ fontSize: "0.6rem", color: C.mute }}>{fmtHrs(x.avg)} / day · {x.n} people</Typography></Stack>
                <Bar value={x.avg} max={10} color="#1E88E5" />
              </Box>
            ))) : topHours.length === 0 ? <Typography sx={{ fontSize: "0.66rem", color: C.mute }}>No punches yet.</Typography> : topHours.map((x) => (
              <Box key={x.e.employee_code} sx={{ mb: 1.2 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }}>{x.e.full_name}</Typography><Typography sx={{ fontSize: "0.6rem", color: C.mute }}>{fmtHrs(x.avg)} / day</Typography></Stack>
                <Typography sx={{ fontSize: "0.56rem", color: C.mute, mb: 0.3 }}>{x.e.designation} · {x.e.department}</Typography>
                <Bar value={x.avg} max={10} color="#7E57C2" />
              </Box>
            ))}
          </SectionCard>
          <SectionCard title="On-time arrival" subtitle={`Last 30 days · ${statBy === "dept" ? "by department" : "top 5 people"} · days in before the grace time`}>
            {ByToggle}
            {statBy === "dept" ? (deptOnTime.length === 0 ? <Typography sx={{ fontSize: "0.66rem", color: C.mute }}>No punches yet.</Typography> : deptOnTime.map((x) => (
              <Box key={x.dept} sx={{ mb: 1.2 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }}>{x.dept}</Typography><Typography sx={{ fontSize: "0.6rem", color: C.mute }}>{x.onTime}% · {x.late} late day(s)</Typography></Stack>
                <Bar value={x.onTime} max={100} color="#1F9D63" />
              </Box>
            ))) : onTime.length === 0 ? <Typography sx={{ fontSize: "0.66rem", color: C.mute }}>No punches yet.</Typography> : onTime.map((x) => (
              <Box key={x.e.employee_code} sx={{ mb: 1.2 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }}>{x.e.full_name}</Typography><Typography sx={{ fontSize: "0.6rem", color: C.mute }}>{x.onTime}%</Typography></Stack>
                <Typography sx={{ fontSize: "0.56rem", color: C.mute, mb: 0.3 }}>{x.e.designation} · {x.e.department}</Typography>
                <Bar value={x.onTime} max={100} color="#1F9D63" />
              </Box>
            ))}
          </SectionCard>
          <SectionCard title={teamScope === "mine" && underMe.size ? "My team attendance today" : "Team members attendance today"} subtitle={`${teamScope === "mine" && underMe.size ? `${underMe.size} people under me · ` : ""}${tcount("present") + tcount("late")} in · ${tcount("absent")} not in · ${tcount("late")} late`}>
            {underMe.size > 0 && <Pills value={teamScope} onChange={setTeamScope} items={[["mine", `My team · under me (${underMe.size})`, "#D94F8A"], ["all", `Everyone in scope (${todayRows.length})`, "#66767E"]]} />}
            <Pills value={teamTab} onChange={setTeamTab} items={[["present", `Present (${tcount("present") + tcount("late")})`, "#1F9D63"], ["absent", `Absent (${tcount("absent")})`, "#E53950"], ["late", `Late (${tcount("late")})`, "#F27C22"]]} />
            <Stack direction="row" sx={{ fontSize: "0.56rem", color: C.mute, fontWeight: 700, pb: 0.5, borderBottom: "1px solid #eef1f3" }}><Box sx={{ flex: 1 }}>Name</Box><Box sx={{ width: 60 }}>Tap in</Box><Box sx={{ width: 60 }}>Tap out</Box></Stack>
            <Box sx={{ maxHeight: 220, overflow: "auto" }}>
              {teamList.length === 0 ? <Typography sx={{ py: 1.5, fontSize: "0.64rem", color: C.mute }}>Nobody here.</Typography> : teamList.map(({ e, a }) => (
                <Row key={e.employee_code}>
                  <Box sx={{ flex: 1, minWidth: 0 }}><Typography noWrap sx={{ fontSize: "0.66rem", fontWeight: 600, color: C.blue }}>{e.full_name}</Typography><Typography noWrap sx={{ fontSize: "0.56rem", color: C.mute }}>{e.designation}</Typography></Box>
                  <Typography sx={{ width: 60, fontSize: "0.64rem" }}>{a.inT || "—"}</Typography>
                  <Typography sx={{ width: 60, fontSize: "0.64rem" }}>{a.outT || "—"}</Typography>
                </Row>
              ))}
            </Box>
          </SectionCard>
          <SectionCard title="Leave approval pending" action={<Button size="small" endIcon={<OpenInNewRounded />} onClick={() => navigate(user.role === "superadmin" ? "/requests" : "/inbox")}>All</Button>}>
            <Pills value={leaveTab} onChange={setLeaveTab} items={[["pending", `Pending my approval (${pend.length})`, C.navy], ["mine", "My requests", C.red]]} />
            <Box sx={{ maxHeight: 250, overflow: "auto" }}>
              {leaveTab === "pending" ? (pend.length === 0 ? <Typography sx={{ py: 1.5, fontSize: "0.64rem", color: C.mute }}>Nothing waiting for you.</Typography> : pend.map((r, i) => (
                <Row key={r.request_id}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.66rem" }}>{i + 1}. <b>{nameOf(r.employee_code)}</b> requested {ltName(r.leave_type)} on {fmtDate(r.from_date)}{r.to_date !== r.from_date ? ` to ${fmtDate(r.to_date)}` : ""} ({r.days} day{r.days === 1 ? "" : "s"})</Typography>
                    {r.reason && <Typography sx={{ fontSize: "0.58rem", color: C.mute }}>[{r.reason}]</Typography>}
                  </Box>
                  {user.role === "admin" && <Tooltip title="Approve"><IconButton size="small" onClick={() => decide(r, true)} sx={{ color: C.green }}><CheckCircleRounded /></IconButton></Tooltip>}
                  {user.role === "admin" && <Tooltip title="Reject"><IconButton size="small" onClick={() => setReject(r)} sx={{ color: C.red }}><CancelRounded /></IconButton></Tooltip>}
                </Row>
              ))) : (!me ? <Typography sx={{ py: 1.5, fontSize: "0.64rem", color: C.mute }}>No employee record linked.</Typography> : mine.length === 0 ? <Typography sx={{ py: 1.5, fontSize: "0.64rem", color: C.mute }}>You have no leave requests.</Typography> : mine.map((r) => (
                <Row key={r.request_id}>
                  <Typography sx={{ flex: 1, fontSize: "0.66rem" }}>{ltName(r.leave_type)} · {fmtDate(r.from_date)}{r.to_date !== r.from_date ? ` – ${fmtDate(r.to_date)}` : ""} ({r.days}d)</Typography>
                  <Chip size="small" label={r.status} sx={{ height: 18, fontSize: "0.55rem", bgcolor: r.status === "Approved" ? "#e8f5e9" : r.status === "Rejected" ? "#ffebee" : "#fff8e1" }} />
                </Row>
              )))}
            </Box>
          </SectionCard>
          <SectionCard title="Company attendance" subtitle={`Today · ${todayRows.length} people in scope`}>
            {[["Present on time", count("present"), C.green], ["Late", count("late"), C.amber], ["On leave", count("leave"), C.blue], ["Not in / absent", count("absent"), C.red]].map(([l, n, color]) => (
              <Box key={l} sx={{ mb: 1.3 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontSize: "0.66rem", fontWeight: 600 }}>{l}</Typography><Typography sx={{ fontSize: "0.62rem", color: C.mute }}>{n} · {Math.round((n / total) * 100)}%</Typography></Stack>
                <Bar value={n} max={total} color={color} />
              </Box>
            ))}
          </SectionCard>
          <SectionCard title="Employee absenteeism" subtitle="Last 30 working days · unplanned absence by department" action={<Button size="small" onClick={() => navigate("/reports?r=missing-clockings")}>Report</Button>}>
            {absenteeism.map((x) => (
              <Box key={x.dept} sx={{ mb: 1.2 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontSize: "0.66rem", fontWeight: 600 }}>{x.dept}</Typography><Typography sx={{ fontSize: "0.6rem", color: C.mute }}>{x.absent} day(s) · {x.pct}%</Typography></Stack>
                <Bar value={x.pct} max={Math.max(20, ...absenteeism.map((y) => y.pct))} color={absColor(x.pct)} />
              </Box>
            ))}
            <Stack direction="row" spacing={1.5} sx={{ pt: 0.5 }}>{[["Under 5%", "#1F9D63"], ["5–10%", "#F27C22"], ["10% +", "#E53950"]].map(([l, c]) => <Stack key={l} direction="row" spacing={0.5} sx={{ alignItems: "center" }}><Box sx={{ width: 9, height: 9, borderRadius: "50%", background: c }} /><Typography sx={{ fontSize: "0.56rem", color: C.mute }}>{l}</Typography></Stack>)}</Stack>
          </SectionCard>
        </Box>
      </Stack>

      <Dialog open={!!reject} onClose={() => setReject(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Reject {reject?.request_id}</DialogTitle>
        <DialogContent><RejectNote onSubmit={(note) => { const r = decide(reject, false, note); if (r.ok) setReject(null); }} onCancel={() => setReject(null)} /></DialogContent>
      </Dialog>
    </Box>
  );
}

function RejectNote({ onSubmit, onCancel }) {
  const [note, setNote] = useState("");
  return (
    <>
      <TextField fullWidth multiline minRows={2} sx={{ mt: 1 }} label="Reason *" value={note} onChange={(e) => setNote(e.target.value)} />
      <DialogActions sx={{ px: 0 }}><Button color="inherit" onClick={onCancel}>Cancel</Button><Button variant="contained" color="error" onClick={() => onSubmit(note)}>Reject</Button></DialogActions>
    </>
  );
}
