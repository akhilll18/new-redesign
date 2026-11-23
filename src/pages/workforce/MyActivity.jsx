// My activity: what is monitored, my consent, and my own data (transparency for the employee).
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, FormControlLabel, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { CheckCircleRounded, BlockRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, TableWrap, Tag, HBar } from "../../components/kit/UI.jsx";
import { ActivityBar, CatLegend, CAT } from "../../components/workforce/MonitoringView.jsx";
import { productivity, lastNDays } from "../../lib/hrcalc.js";
import { isoDate, fmtDate, fmtDateTime } from "../../lib/utils.js";

const fmtH = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

export default function MyActivity() {
  const { data, user, setConsent, notifyToast, nameOf } = useStore();
  const navigate = useNavigate();
  const e = data.employees.find((x) => x.employee_code === user.employee_code);
  const consent = data.consents[e.employee_code];
  const st = data.settings;
  const [loc, setLoc] = useState(consent?.location ?? true);
  const [act, setAct] = useState(consent?.activity ?? true);
  const days = lastNDays(10).filter((d) => ![0, 6].includes(new Date(`${d}T12:00:00`).getDay()));
  const mine = days.map((d) => ({ d, a: data.activity.find((x) => x.employee_code === e.employee_code && x.date === d) })).reverse();
  const today = mine.find((m) => m.d === isoDate())?.a;
  const tp = productivity(today);
  const withData = mine.filter((m) => m.a);
  const avgActive = withData.length ? withData.reduce((s, m) => s + productivity(m.a).active, 0) / withData.length : 0;
  const live = data.locations[e.employee_code];

  const collected = [
    [true, `Location at each geofenced punch${st.location_tracking !== "off" ? `, and every ${st.location_ping_min} min while you are ${st.location_tracking === "clocked_in" ? "clocked in" : `in work hours (${st.work_hours_start}–${st.work_hours_end})`}` : ""}`],
    [st.activity_tracking, "Active and idle minutes on your work computer during work hours"],
    [st.activity_tracking, st.activity_detail === "apps" ? "Names of the apps and websites you use for work" : "Categories of apps and websites (productive, neutral, unproductive)"],
    [false, "Keystrokes, passwords, messages, emails or document contents"],
    [st.screenshots !== "off", st.screenshots === "off" ? "Screenshots of your screen" : "Blurred screenshots"],
    [false, "Anything on personal devices, or outside work hours"],
  ];

  return (
    <>
      <PageHeader eyebrow="ATTENDANCE · MY ACTIVITY" title="My activity" subtitle="Your recorded work time: active, productive and idle minutes, and the apps you used." />
      <Stack spacing={2.5}>
        <Alert severity="info" sx={{ fontSize: "0.68rem" }} action={<Button size="small" onClick={() => navigate("/my-privacy")}>Privacy & my data</Button>}>Your monitoring consent and what is collected now live in My profile → Privacy & my data.</Alert>
        {consent?.activity ? (
          <>
            <Grid min={170}>
              <StatCard label="Active today" value={fmtH(tp.active)} hint={today ? `${today.first} – ${today.last}` : "Nothing recorded yet today"} />
              <StatCard label="Productive today" value={`${tp.productivePct}%`} tone="good" hint="Share of active time in work apps" />
              <StatCard label="Idle today" value={`${tp.idlePct}%`} tone="warn" hint="No input for 5+ minutes" />
              <StatCard label="Average active day" value={fmtH(Math.round(avgActive))} tone="info" hint={`Last ${withData.length} working days`} />
            </Grid>
            <SectionCard title="My last 10 working days" action={<CatLegend />} noPad>
              <TableWrap>
                <Table size="small" sx={{ minWidth: 640 }}>
                  <TableHead><TableRow><TableCell>Day</TableCell><TableCell>First / last</TableCell><TableCell align="right">Active</TableCell><TableCell align="right">Productive</TableCell><TableCell sx={{ width: 260 }}>Time split</TableCell></TableRow></TableHead>
                  <TableBody>
                    {mine.map(({ d, a }) => {
                      const p = productivity(a);
                      return (
                        <TableRow key={d}>
                          <TableCell>{fmtDate(d)}</TableCell>
                          <TableCell>{a ? `${a.first} – ${a.last}` : "—"}</TableCell>
                          <TableCell align="right">{a ? fmtH(p.active) : "—"}</TableCell>
                          <TableCell align="right">{a ? `${p.productivePct}%` : "—"}</TableCell>
                          <TableCell><ActivityBar a={a} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrap>
            </SectionCard>
            {today && (
              <SectionCard title="Today's apps and sites">
                <Stack spacing={1.2}>{today.apps.map(([n, c, m]) => <HBar key={n} label={`${n} · ${c}`} value={m} max={today.apps[0][2] || 1} right={fmtH(m)} color={CAT.find((x) => x[0] === c)?.[2]} />)}</Stack>
              </SectionCard>
            )}
            <Typography sx={{ fontSize: "0.6rem", color: "#9aa39c" }}>In this demo, today's activity also counts the time you spend active in this portal while signed in.</Typography>
          </>
        ) : (
          consent && <Alert severity="info">Activity tracking is off for you, so there is no activity data.</Alert>
        )}
      </Stack>
    </>
  );
}

/** v10.4: consent + "what is collected" — shown in My profile → Privacy & my data (merged with privacy). */
export function MonitoringConsent() {
  const { data, user, setConsent, notifyToast, nameOf } = useStore();
  const e = data.employees.find((x) => x.employee_code === user.employee_code);
  const consent = data.consents[e.employee_code];
  const st = data.settings;
  const [loc, setLoc] = useState(consent?.location ?? true);
  const [act, setAct] = useState(consent?.activity ?? true);
  const days = lastNDays(10).filter((d) => ![0, 6].includes(new Date(`${d}T12:00:00`).getDay()));
  const mine = days.map((d) => ({ d, a: data.activity.find((x) => x.employee_code === e.employee_code && x.date === d) })).reverse();
  const today = mine.find((m) => m.d === isoDate())?.a;
  const tp = productivity(today);
  const withData = mine.filter((m) => m.a);
  const avgActive = withData.length ? withData.reduce((s, m) => s + productivity(m.a).active, 0) / withData.length : 0;
  const live = data.locations[e.employee_code];

  const collected = [
    [true, `Location at each geofenced punch${st.location_tracking !== "off" ? `, and every ${st.location_ping_min} min while you are ${st.location_tracking === "clocked_in" ? "clocked in" : `in work hours (${st.work_hours_start}–${st.work_hours_end})`}` : ""}`],
    [st.activity_tracking, "Active and idle minutes on your work computer during work hours"],
    [st.activity_tracking, st.activity_detail === "apps" ? "Names of the apps and websites you use for work" : "Categories of apps and websites (productive, neutral, unproductive)"],
    [false, "Keystrokes, passwords, messages, emails or document contents"],
    [st.screenshots !== "off", st.screenshots === "off" ? "Screenshots of your screen" : "Blurred screenshots"],
    [false, "Anything on personal devices, or outside work hours"],
  ];

  return (
      <Stack spacing={2.5}>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2.5 }}>
          <SectionCard title="Your consent · mandatory" subtitle="Company monitoring policy — location and work-activity recording are mandatory during work hours and cannot be switched off.">
            <Stack spacing={1.5}>
              <FormControlLabel control={<Switch checked disabled />} label={<Box><Typography sx={{ fontSize: "0.75rem", fontWeight: 700 }}>Share my location while I'm {st.location_tracking === "work_hours" ? "in work hours" : "clocked in"}</Typography><Typography sx={{ fontSize: "0.62rem", color: "#78827b" }}>Your manager and HR see you on the live map. Turning this off does not stop geofence checks when you punch.</Typography></Box>} sx={{ alignItems: "flex-start", m: 0, "& .MuiSwitch-root": { mt: -0.5 } }} />
              <FormControlLabel control={<Switch checked disabled />} label={<Box><Typography sx={{ fontSize: "0.75rem", fontWeight: 700 }}>Record my work activity</Typography><Typography sx={{ fontSize: "0.62rem", color: "#78827b" }}>{st.activity_tracking ? "Active and idle time and app categories during work hours." : "Your company has turned activity tracking off."}</Typography></Box>} sx={{ alignItems: "flex-start", m: 0, "& .MuiSwitch-root": { mt: -0.5 } }} />
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {/* v10.7: consent is mandatory — the toggles are inactive (always on) and there is nothing to save. */}
                <Tag tone="info">Mandatory · company policy</Tag>
                {live && <Tag tone="good">Location shared {new Date(live.ts).toTimeString().slice(0, 5)}</Tag>}
              </Stack>
              <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>These settings are set by the company and apply to everyone during work hours. Data is deleted after {st.monitoring_retention_days} days.</Typography>
            </Stack>
          </SectionCard>
          <SectionCard title="What is and isn't collected">
            <Stack spacing={1}>
              {collected.map(([on, text]) => (
                <Stack key={text} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                  {on ? <CheckCircleRounded sx={{ fontSize: 16, color: "#2e7d32", mt: 0.1 }} /> : <BlockRounded sx={{ fontSize: 16, color: "#d32f2f", mt: 0.1 }} />}
                  <Typography sx={{ fontSize: "0.68rem" }}>{on ? "" : "Never: "}{text}</Typography>
                </Stack>
              ))}
              <Typography sx={{ fontSize: "0.6rem", color: "#78827b", pt: 0.5 }}>Who sees it: you, {e.reporting_manager ? `${nameOf(e.reporting_manager)} (your manager${st.managers_see_team_activity ? ", summaries only" : ", live map only"})` : "your manager"}, and HR. Admins' views are written to the audit log.</Typography>
            </Stack>
          </SectionCard>
        </Box>
      </Stack>
  );
}
