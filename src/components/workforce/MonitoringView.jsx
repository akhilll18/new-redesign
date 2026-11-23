// Employee monitoring (consent-based): work activity by category, idle time, after-hours work.
import React, { useMemo, useState } from "react";
import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { PrivacyTipRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap, HBar } from "../kit/UI.jsx";
import { productivity, lastNDays } from "../../lib/hrcalc.js";
import { isoDate } from "../../lib/utils.js";

export const CAT = [
  ["productive", "Productive", "#1A9A72"],
  ["neutral", "Neutral", "#2A7DC9"],
  ["unproductive", "Unproductive", "#D07A1F"],
  ["idle", "Idle", "#C8CEC9"],
];

export function ActivityBar({ a, height = 10 }) {
  const total = a ? CAT.reduce((s, [k]) => s + a[k], 0) : 0;
  if (!total) return <Box sx={{ height, borderRadius: height, background: "#f0f2ef" }} />;
  return (
    <Box sx={{ display: "flex", gap: "2px", height, borderRadius: height, overflow: "hidden" }}>
      {CAT.map(([k, l, c]) => a[k] > 0 && (
        <Tooltip key={k} title={`${l}: ${Math.floor(a[k] / 60)} h ${a[k] % 60} min`}>
          <Box sx={{ width: `${(a[k] / total) * 100}%`, background: c }} />
        </Tooltip>
      ))}
    </Box>
  );
}

export function CatLegend() {
  return (
    <Stack direction="row" spacing={1.6} useFlexGap sx={{ flexWrap: "wrap" }}>
      {CAT.map(([k, l, c]) => (
        <Stack key={k} direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
          <Box sx={{ width: 9, height: 9, borderRadius: "2px", background: c }} />
          <Typography sx={{ fontSize: "0.6rem", color: "#66716a" }}>{l}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function Spark({ values }) {
  const max = Math.max(1, ...values);
  return (
    <Stack direction="row" spacing="2px" sx={{ alignItems: "flex-end", height: 22 }} aria-label={`Last ${values.length} days active hours`}>
      {values.map((v, i) => <Box key={i} title={`${v.toFixed(1)} h`} sx={{ width: 6, height: `${(v / max) * 100}%`, minHeight: v ? 2 : 1, background: i === values.length - 1 ? "#244d3d" : "#9cc4ad", borderRadius: "2px 2px 0 0" }} />)}
    </Stack>
  );
}

const fmtH = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

export default function MonitoringView({ employees, appDetail = true }) {
  const { data } = useStore();
  const days = lastNDays(10).filter((d) => ![0, 6].includes(new Date(`${d}T12:00:00`).getDay()));
  const [day, setDay] = useState(isoDate());
  const st = data.settings;
  const active = employees.filter((e) => e.status === "active");
  const rows = useMemo(
    () =>
      active.map((e) => {
        const a = data.activity.find((x) => x.employee_code === e.employee_code && x.date === day);
        const consent = data.consents[e.employee_code];
        const p = productivity(a);
        const trend = days.map((d) => {
          const x = data.activity.find((y) => y.employee_code === e.employee_code && y.date === d);
          return x ? productivity(x).active / 60 : 0;
        });
        const alerts = [];
        if (a && a.last > st.work_hours_end) alerts.push(["After hours", "warn"]);
        if (a && p.active < 240 && day !== isoDate()) alerts.push(["Low activity", "bad"]);
        if (a && p.idlePct > 30) alerts.push(["High idle", "warn"]);
        if (a && p.active > 600) alerts.push(["Long day", "warn"]);
        return { e, a, p, consent, trend, alerts };
      }),
    [data.activity, data.consents, day, employees], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const tracked = rows.filter((r) => r.a);
  const avg = (f) => (tracked.length ? tracked.reduce((s, r) => s + f(r), 0) / tracked.length : 0);
  const totals = CAT.reduce((o, [k]) => ({ ...o, [k]: tracked.reduce((s, r) => s + r.a[k], 0) }), {});
  const apps = {};
  tracked.forEach((r) => r.a.apps.forEach(([n, c, m]) => { apps[n] = apps[n] || { n, c, m: 0 }; apps[n].m += m; }));
  const topApps = Object.values(apps).sort((a, b) => b.m - a.m).slice(0, 8);
  const consentCount = active.filter((e) => data.consents[e.employee_code]?.activity).length;

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <ToggleButtonGroup exclusive size="small" value={day} onChange={(_, v) => v && setDay(v)} sx={{ flexWrap: "wrap" }}>
          {days.slice(-6).map((d) => <ToggleButton key={d} value={d} sx={{ fontSize: "0.6rem" }}>{d === isoDate() ? "Today" : new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</ToggleButton>)}
        </ToggleButtonGroup>
        <CatLegend />
      </Stack>
      <Grid min={160}>
        <StatCard label="Tracked people" value={`${consentCount}/${active.length}`} hint="Only people who gave consent" tone="info" />
        <StatCard label="Avg active time" value={fmtH(Math.round(avg((r) => r.p.active)))} hint={day === isoDate() ? "So far today" : "Keyboard or mouse activity"} />
        <StatCard label="Avg productive" value={`${Math.round(avg((r) => r.p.productivePct))}%`} tone="good" hint="Share of active time in work apps" />
        <StatCard label="Avg idle" value={`${Math.round(avg((r) => r.p.idlePct))}%`} tone="warn" hint="No input for 5+ minutes" />
        <StatCard label="Alerts" value={tracked.reduce((s, r) => s + r.alerts.length, 0)} tone="bad" hint="After hours, long days, low activity" />
      </Grid>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: appDetail ? "2fr 1fr" : "1fr" }, gap: 2.5 }}>
        <SectionCard title="People" subtitle={`Work hours ${st.work_hours_start}–${st.work_hours_end}. Activity outside them is shown but not counted against anyone.`} noPad>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>First / last</TableCell><TableCell align="right">Active</TableCell><TableCell align="right">Productive</TableCell><TableCell sx={{ width: 180 }}>Time split</TableCell><TableCell>10 days</TableCell><TableCell>Alerts</TableCell></TableRow></TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.e.employee_code}>
                    <TableCell><PersonCell name={r.e.full_name} sub={`${r.e.employee_code} · ${r.e.department}`} /></TableCell>
                    {r.consent?.activity ? (
                      <>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{r.a ? `${r.a.first} – ${r.a.last}` : "—"}</TableCell>
                        <TableCell align="right">{r.a ? fmtH(r.p.active) : "—"}</TableCell>
                        <TableCell align="right">{r.a ? `${r.p.productivePct}%` : "—"}</TableCell>
                        <TableCell><ActivityBar a={r.a} /></TableCell>
                        <TableCell><Spark values={r.trend} /></TableCell>
                        <TableCell><Stack direction="row" spacing={0.4} useFlexGap sx={{ flexWrap: "wrap" }}>{r.alerts.map(([l, t]) => <Tag key={l} tone={t}>{l}</Tag>)}</Stack></TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={6}><Typography sx={{ fontSize: "0.64rem", color: "#78827b" }}>{r.consent ? "Activity tracking is off for this person (consent withdrawn)." : "Not tracked: this person has not given consent yet."}</Typography></TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
        {appDetail && (
          <Stack spacing={2.5}>
            <SectionCard title="Where time went" subtitle="All tracked people, selected day">
              <ActivityBar a={totals} height={14} />
              <Stack spacing={0.8} sx={{ mt: 1.5 }}>
                {CAT.map(([k, l]) => <Stack key={k} direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontSize: "0.66rem" }}>{l}</Typography><Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }}>{fmtH(totals[k])}</Typography></Stack>)}
              </Stack>
            </SectionCard>
            <SectionCard title="Top apps and sites" subtitle={st.activity_detail === "apps" ? "App names" : "Grouped by category; names shown to HR only"}>
              <Stack spacing={1.2}>
                {topApps.map((x) => <HBar key={x.n} label={`${x.n} · ${x.c}`} value={x.m} max={topApps[0]?.m || 1} right={fmtH(x.m)} color={CAT.find((c) => c[0] === x.c)?.[2]} />)}
                {!topApps.length && <Typography sx={{ fontSize: "0.65rem", color: "#78827b" }}>No activity recorded for this day.</Typography>}
              </Stack>
            </SectionCard>
            <SectionCard title="Privacy safeguards">
              <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                <PrivacyTipRounded sx={{ color: "#2e7d32", fontSize: 18, mt: 0.2 }} />
                <Typography sx={{ fontSize: "0.62rem", color: "#56655f", lineHeight: 1.7 }}>
                  Collected: active and idle minutes, and app or site categories during work hours. Not collected: keystrokes, message or document contents, {st.screenshots === "off" ? "screenshots, " : ""}personal devices. People see their own data in My activity and can withdraw consent. Data is deleted after {st.monitoring_retention_days} days.
                </Typography>
              </Stack>
            </SectionCard>
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
