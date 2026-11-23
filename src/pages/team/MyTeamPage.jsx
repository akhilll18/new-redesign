// My Team (Keka-style) for managers: who is off, attendance today, team calendar, balances, approvals.
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import { ChevronLeftRounded, ChevronRightRounded, ArrowForwardRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Avatar, PersonCell, TableWrap, Tag } from "../../components/kit/UI.jsx";
import { isoDate } from "../../lib/utils.js";

// Demo attendance for today (the attendance module records the real punches).
function todayStatus(code, onLeave) {
  if (onLeave) return "leave";
  const h = [...`${code}${isoDate()}`].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 9973, 7) % 10;
  return h < 2 ? "notin" : h < 6 ? "ontime" : h < 8 ? "late" : h === 8 ? "wfh" : "remote";
}

export default function MyTeamPage() {
  const { data, user, reportsOf, leaveBalanceOf, pendingForManager, leaveTypeBy } = useStore();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const team = reportsOf(user.employee_code).filter((e) => e.status !== "rejected");
  const today = isoDate();
  const leaves = data.requests.filter((r) => r.type === "leave" && team.some((e) => e.employee_code === r.employee_code) && ["Approved", "Pending"].includes(r.status));
  const offToday = leaves.filter((r) => r.status === "Approved" && r.from_date <= today && r.to_date >= today);
  const statuses = team.map((e) => ({ e, st: todayStatus(e.employee_code, offToday.some((r) => r.employee_code === e.employee_code)) }));
  const count = (s) => statuses.filter((x) => x.st === s).length;
  const pend = pendingForManager(user.employee_code);

  const days = useMemo(() => {
    const out = [];
    const d = new Date(month);
    while (d.getMonth() === month.getMonth()) {
      out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, [month]);
  const hol = Object.fromEntries(data.holidays.map((h) => [h.date, h]));

  return (
    <>
      <PageHeader eyebrow="MY TEAM · SUMMARY" title="Team summary" subtitle={`${team.length} direct report(s). Approvals for leave, expenses, advances and attendance corrections come to your inbox.`} actions={<Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={() => navigate("/inbox")}>Inbox ({pend.requests.length + pend.points.length})</Button>} />
      <Stack spacing={2.5}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <SectionCard title="Who is off today">
            {offToday.length === 0 ? (
              <Box sx={{ p: 1.2, borderRadius: 1, background: "#fdf6e3", color: "#8a6a1f", fontSize: "0.65rem", border: "1px solid #f3e3b5" }}>No employee is off today.</Box>
            ) : (
              <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
                {offToday.map((r) => (
                  <Stack key={r.request_id} sx={{ alignItems: "center", width: 72 }}>
                    <Avatar name={data.employees.find((e) => e.employee_code === r.employee_code)?.full_name} size={40} />
                    <Typography noWrap sx={{ fontSize: "0.58rem", mt: 0.5, maxWidth: 72 }}>{data.employees.find((e) => e.employee_code === r.employee_code)?.full_name}</Typography>
                    <Typography sx={{ fontSize: "0.55rem", color: "#78827b" }}>{r.leave_type}</Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
          <SectionCard title="Not in yet today">
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
              {statuses.filter((x) => x.st === "notin").map(({ e }) => (
                <Stack key={e.employee_code} sx={{ alignItems: "center", width: 72 }}>
                  <Avatar name={e.full_name} size={40} />
                  <Typography noWrap sx={{ fontSize: "0.58rem", mt: 0.5, maxWidth: 72 }}>{e.full_name}</Typography>
                </Stack>
              ))}
              {count("notin") === 0 && <Typography sx={{ fontSize: "0.65rem", color: "#78827b" }}>Everyone has clocked in.</Typography>}
            </Stack>
          </SectionCard>
        </Box>
        <Grid min={180}>
          <StatCard label="Employees on time today" value={count("ontime")} tone="good" />
          <StatCard label="Late arrivals today" value={count("late")} tone="bad" />
          <StatCard label="Work from home / on duty" value={count("wfh")} tone="info" />
          <StatCard label="Remote clock-ins today" value={count("remote")} tone="warn" />
        </Grid>

        <SectionCard
          title="Team calendar"
          action={
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <IconButton size="small" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeftRounded /></IconButton>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, minWidth: 80, textAlign: "center" }}>{month.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</Typography>
              <IconButton size="small" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRightRounded /></IconButton>
            </Stack>
          }
          noPad
        >
          <TableWrap>
            <Table size="small" sx={{ minWidth: 220 + days.length * 30, "& td, & th": { px: 0.3 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ position: "sticky", left: 0, background: "#fbfdfb", zIndex: 1, minWidth: 180, pl: "12px !important" }}>Employee</TableCell>
                  {days.map((d) => <TableCell key={d.getDate()} align="center" sx={{ fontSize: "0.5rem !important" }}>{"SMTWTFS"[d.getDay()]}<br />{d.getDate()}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {team.map((e) => (
                  <TableRow key={e.employee_code}>
                    <TableCell sx={{ position: "sticky", left: 0, background: "#fff", zIndex: 1, pl: "12px !important" }}><PersonCell name={e.full_name} sub={e.designation} /></TableCell>
                    {days.map((d) => {
                      const iso = isoDate(d);
                      const lv = leaves.find((r) => r.employee_code === e.employee_code && r.from_date <= iso && r.to_date >= iso);
                      const weekend = d.getDay() === 0 || d.getDay() === 6;
                      const h = hol[iso];
                      const bg = lv ? (lv.status === "Approved" ? "#5b9a6b" : "#e3a36f") : h ? (h.type === "floater" ? "#b9a4e6" : "#8fb3d9") : weekend ? "#f3d27a" : "transparent";
                      const label = lv ? `${leaveTypeBy[lv.leave_type]?.name} · ${lv.status}` : h ? `${h.name}${h.type === "floater" ? " (floater)" : ""}` : weekend ? "Weekly off" : "Working day";
                      return (
                        <TableCell key={iso} align="center">
                          <Tooltip title={`${e.full_name} · ${d.toDateString()} · ${label}`}>
                            <Box sx={{ width: 22, height: 22, mx: "auto", borderRadius: "50%", background: bg, color: lv || h ? "#fff" : weekend ? "#5a4710" : "#6a756d", fontSize: "0.55rem", display: "grid", placeItems: "center", fontWeight: 600, outline: iso === today ? "2px solid #244d3d" : "none" }}>{d.getDate()}</Box>
                          </Tooltip>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
          <Stack direction="row" spacing={2} useFlexGap sx={{ p: 1.5, flexWrap: "wrap" }}>
            {[["#5b9a6b", "Leave approved"], ["#e3a36f", "Leave pending"], ["#8fb3d9", "Holiday"], ["#b9a4e6", "Floater"], ["#f3d27a", "Weekly off"]].map(([c, l]) => (
              <Stack key={l} direction="row" spacing={0.6} sx={{ alignItems: "center" }}><Box sx={{ width: 10, height: 10, borderRadius: "50%", background: c }} /><Typography sx={{ fontSize: "0.6rem", color: "#66716a" }}>{l}</Typography></Stack>
            ))}
          </Stack>
        </SectionCard>

        <SectionCard title="Team leave balances" noPad>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 620 }}>
              <TableHead><TableRow><TableCell>Employee</TableCell>{data.leaveTypes.filter((t) => t.annual != null).map((t) => <TableCell key={t.code} align="right">{t.code}</TableCell>)}<TableCell>Today</TableCell></TableRow></TableHead>
              <TableBody>
                {statuses.map(({ e, st }) => {
                  const b = leaveBalanceOf(e.employee_code);
                  return (
                    <TableRow key={e.employee_code}>
                      <TableCell><PersonCell name={e.full_name} sub={e.employee_code} /></TableCell>
                      {b.filter((x) => x.annual != null).map((x) => <TableCell key={x.code} align="right">{x.available}</TableCell>)}
                      <TableCell><Tag tone={{ ontime: "good", late: "bad", wfh: "info", remote: "warn", notin: "neutral", leave: "accent" }[st]}>{{ ontime: "On time", late: "Late", wfh: "WFH", remote: "Remote", notin: "Not in yet", leave: "On leave" }[st]}</Tag></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      </Stack>
    </>
  );
}
