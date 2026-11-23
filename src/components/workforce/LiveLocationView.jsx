// Live location with geofences: manager (team), admin (scope) and Super Admin (all).
import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { OpenInNewRounded, BatteryStdRounded, GpsFixedRounded, ShieldRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap, KeyVal, Mono } from "../kit/UI.jsx";
import LiveMap from "../glass/LiveMap.jsx";
import { livePeople, todayStatus } from "../../lib/workforce.js";
import { fmtDistance, mapsLink } from "../../lib/geo.js";
import { hhmm } from "../../lib/hrcalc.js";
import { isoDate, timeAgo } from "../../lib/utils.js";
import { useCountryChoice } from "../../country/CountryContext.jsx";

const COUNTRY_NAME = { IN: "India", GB: "United Kingdom", US: "United States", AE: "UAE", SG: "Singapore", NA: "Namibia", ZA: "South Africa", KE: "Kenya", NG: "Nigeria", BW: "Botswana", CA: "Canada", MX: "Mexico", BR: "Brazil", DE: "Germany", FR: "France", IE: "Ireland", SA: "Saudi Arabia", MY: "Malaysia", PH: "Philippines", ID: "Indonesia", GH: "Ghana", ZM: "Zambia" };

export default function LiveLocationView({ employees, compact = false }) {
  const { data } = useStore();
  const [, setTick] = useState(0);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const active = employees.filter((e) => e.status === "active");
  const people = useMemo(() => livePeople(data, active), [data, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const countries = [...new Set(active.map((e) => e.country_code || "IN"))];
  const choice = useCountryChoice(countries, "IN");
  const region = choice.value;
  const setRegion = choice.setValue;
  const fences = data.geofences.filter((g) => (g.country || "IN") === region);
  const inRegion = people.filter((p) => (p.e.country_code || "IN") === region);
  const sel = people.find((p) => p.code === selected);
  const rows = active.map((e) => {
    const p = people.find((x) => x.code === e.employee_code);
    const st = todayStatus(data, e);
    const consent = data.consents[e.employee_code];
    const state = p ? p.status : st.status === "leave" ? "leave" : st.open ? (consent?.location ? "waiting" : "no_consent") : "off";
    return { e, p, st, state, consent };
  });
  const count = (s) => rows.filter((r) => r.state === s).length;
  const flagged = data.punches.filter((p) => p.flag && p.ts.startsWith(isoDate()) && active.some((e) => e.employee_code === p.employee_code));
  const STATE = { inside: ["Live · inside", "good"], outside: ["Live · outside", "warn"], stale: ["No update 15+ min", "neutral"], waiting: ["Clocked in · waiting for first update", "info"], no_consent: ["Clocked in · not sharing", "neutral"], leave: ["On leave", "info"], off: ["Not clocked in", "neutral"] };

  return (
    <Stack spacing={2.5}>
      {!compact && (
        <Grid min={160}>
          <StatCard label="Live now" value={people.filter((p) => p.status !== "stale").length} hint={`of ${active.length} people`} tone="good" icon={<GpsFixedRounded />} />
          <StatCard label="Outside geofence" value={count("outside")} tone="warn" hint="Live position outside their allowed sites" />
          <StatCard label="No recent update" value={count("stale")} tone="neutral" hint="Phone offline or app closed" />
          <StatCard label="Not sharing" value={count("no_consent")} tone="info" hint="Clocked in without location consent" icon={<ShieldRounded />} />
          <StatCard label="Flagged punches today" value={flagged.length} tone="bad" hint="Punched outside a geofence" />
        </Grid>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.7fr 1fr" }, gap: 2.5 }}>
        <SectionCard
          title="Live map"
          subtitle="Positions refresh every 30 seconds. Only people who consented and are clocked in appear."
          action={
            choice.showChips && (
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                {choice.options.map((c) => <Chip key={c} size="small" label={`${COUNTRY_NAME[c] || c} (${people.filter((p) => (p.e.country_code || "IN") === c).length})`} color={region === c ? "primary" : "default"} variant={region === c ? "filled" : "outlined"} onClick={() => setRegion(c)} />)}
              </Stack>
            )
          }
          noPad
        >
          <LiveMap fences={fences} people={inRegion} height={compact ? 320 : 430} selected={selected} onSelect={setSelected} />
        </SectionCard>
        <SectionCard title={sel ? sel.name : "Select a person"} subtitle={sel ? sel.sub : "Click a dot on the map or a row below"}>
          {sel ? (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Tag tone={STATE[sel.status]?.[1]}>{STATE[sel.status]?.[0]}</Tag>
                {sel.e.field_staff === "yes" && <Tag tone="accent">Field staff</Tag>}
              </Stack>
              <KeyVal
                cols={2}
                items={[
                  ["Last update", `${timeAgo(sel.ts)} · ${hhmm(sel.ts)}`],
                  ["Accuracy", sel.accuracy ? `± ${sel.accuracy} m` : "—"],
                  ["Nearest site", sel.fence ? sel.fence.name : "—"],
                  ["Distance", sel.fence ? `${fmtDistance(sel.distance)} from centre (radius ${sel.fence.radius_m} m)` : "—"],
                  ["Battery", sel.battery != null ? <Stack key="b" direction="row" spacing={0.4} sx={{ alignItems: "center" }}><BatteryStdRounded sx={{ fontSize: 14 }} />{sel.battery}%</Stack> : "—"],
                  ["Trail", `${sel.trail?.length || 0} points today`],
                ]}
              />
              <Button size="small" variant="outlined" endIcon={<OpenInNewRounded />} href={mapsLink(sel)} target="_blank" rel="noopener">Open in Google Maps</Button>
              <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>The dashed line is today's path. Positions are kept {data.settings.monitoring_retention_days} days, then deleted.</Typography>
            </Stack>
          ) : (
            <Typography sx={{ fontSize: "0.66rem", color: "#78827b" }}>{people.length ? `${people.length} people on the map.` : "No one is sharing a live location right now."}</Typography>
          )}
        </SectionCard>
      </Box>
      {!compact && (
        <SectionCard title="Everyone in scope" noPad>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Today</TableCell><TableCell>Location state</TableCell><TableCell>Nearest site</TableCell><TableCell>Last update</TableCell><TableCell>Consent</TableCell></TableRow></TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.e.employee_code} hover selected={selected === r.e.employee_code} sx={{ cursor: r.p ? "pointer" : "default" }} onClick={() => r.p && (setSelected(r.e.employee_code), setRegion(r.e.country_code || "IN"))}>
                    <TableCell><PersonCell name={r.e.full_name} sub={`${r.e.employee_code} · ${r.e.designation}`} /></TableCell>
                    <TableCell><Mono>{r.st.inT ? `${r.st.inT}${r.st.outT ? `–${r.st.outT}` : ""}` : "—"}</Mono></TableCell>
                    <TableCell><Tag tone={STATE[r.state][1]}>{STATE[r.state][0]}</Tag></TableCell>
                    <TableCell sx={{ maxWidth: 220 }}><Typography noWrap sx={{ fontSize: "0.66rem" }}>{r.p?.fence ? `${r.p.fence.name} · ${fmtDistance(r.p.distance)}` : "—"}</Typography></TableCell>
                    <TableCell>{r.p ? timeAgo(r.p.ts) : "—"}</TableCell>
                    <TableCell>{r.consent ? <Tag tone={r.consent.location ? "good" : "neutral"}>{r.consent.location ? "Location on" : "Location off"}</Tag> : <Tag tone="warn">Not asked yet</Tag>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      )}
      {!compact && flagged.length > 0 && (
        <SectionCard title="Punches outside a geofence today" noPad>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Time</TableCell><TableCell>Detail</TableCell><TableCell>Position</TableCell></TableRow></TableHead>
              <TableBody>
                {flagged.map((p) => {
                  const e = data.employees.find((x) => x.employee_code === p.employee_code);
                  return (
                    <TableRow key={p.id}>
                      <TableCell><PersonCell name={e?.full_name} sub={p.employee_code} /></TableCell>
                      <TableCell><Mono>{p.type} {hhmm(p.ts)}</Mono></TableCell>
                      <TableCell>{p.flag}</TableCell>
                      <TableCell>{p.lat ? <Button size="small" href={mapsLink(p)} target="_blank" rel="noopener" endIcon={<OpenInNewRounded sx={{ fontSize: 12 }} />} sx={{ fontSize: "0.6rem" }}>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</Button> : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      )}
    </Stack>
  );
}
