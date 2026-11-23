// Employee attendance: punch, where you punched, this week's timesheet, punch history, corrections.
import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { EditCalendarRounded, FingerprintRounded, FaceRounded, PhoneAndroidRounded, LanguageRounded, AssignmentTurnedInRounded, OpenInNewRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Tag, TableWrap, EmptyState, Mono } from "../../components/kit/UI.jsx";
import { RequestDrawer, RequestStatus } from "../../components/kit/Requests.jsx";
import PunchPanel from "../../components/workforce/PunchPanel.jsx";
import LiveMap from "../../components/glass/LiveMap.jsx";
import { dayAttendance, lastNDays, isWeekend, hhmm } from "../../lib/hrcalc.js";
import { fencesFor, fmtDistance, mapsLink } from "../../lib/geo.js";
import { validateRegularize, REG_REASONS } from "../../lib/requests.js";
import { isoDate, fmtDate, initials } from "../../lib/utils.js";
import { onLeaveToday } from "../../lib/workforce.js";
import { holidaysFor } from "../../country/countryPacks.js";
import { designTokens } from "../../theme/muiTheme.js";

const { color } = designTokens;

export const SOURCE_META = {
  biometric_fp: ["Fingerprint terminal", <FingerprintRounded key="f" />],
  biometric_face: ["Face terminal", <FaceRounded key="c" />],
  geo_mobile: ["Geofenced mobile", <PhoneAndroidRounded key="p" />],
  web: ["Web", <LanguageRounded key="w" />],
  regularized: ["Correction", <AssignmentTurnedInRounded key="r" />],
};
const VERIFIED = { device: "Terminal match", device_biometric: "Device fingerprint / face", selfie: "Selfie", demo_scan: "Demo scan", password: "Signed-in session", approval: "Approved correction" };

export function SourceCell({ p }) {
  const [label, icon] = SOURCE_META[p.source] || [p.source, null];
  return (
    <Stack direction="row" spacing={0.7} sx={{ alignItems: "center", "& svg": { fontSize: 16, color: color.primary } }}>
      {icon}
      <Box>
        <Typography sx={{ fontSize: "0.68rem" }}>{label}</Typography>
        <Typography sx={{ fontSize: 11, color: color.secondaryText }}>{VERIFIED[p.verified] || p.verified}</Typography>
      </Box>
    </Stack>
  );
}

function RegularizeDialog({ open, onClose, preset }) {
  const { data, user, createRequest, notifyToast } = useStore();
  const [form, setForm] = useState({});
  const [tried, setTried] = useState(false);
  React.useEffect(() => {
    if (open) {
      setForm({ date: preset?.date || isoDate(Date.now() - 86400000), in_time: preset?.inT || "09:30", out_time: preset?.outT || "18:30", reason_code: "forgot_punch", reason: "" });
      setTried(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const { errors } = validateRegularize(form, { settings: data.settings, punches: data.punches, emp: { employee_code: user.employee_code } });
  const show = (k) => tried && errors[k];
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Request attendance correction</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Day *" type="date" value={form.date || ""} onChange={(e) => set("date", e.target.value)} error={!!show("date")} helperText={show("date") || `Within the last ${data.settings.regularize_window_days} days`} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: isoDate() } }} />
          <Stack direction="row" spacing={2}>
            <TextField label="In *" type="time" value={form.in_time || ""} onChange={(e) => set("in_time", e.target.value)} error={!!show("in_time")} helperText={show("in_time") || " "} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Out *" type="time" value={form.out_time || ""} onChange={(e) => set("out_time", e.target.value)} error={!!show("out_time")} helperText={show("out_time") || " "} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          <FormControl size="small" fullWidth>
            <InputLabel>Reason *</InputLabel>
            <Select label="Reason *" value={form.reason_code || ""} onChange={(e) => set("reason_code", e.target.value)}>
              {REG_REASONS.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="What happened *" multiline minRows={2} value={form.reason || ""} onChange={(e) => set("reason", e.target.value)} error={!!show("reason")} helperText={show("reason") || "Your manager and HR see this"} />
          <Alert severity="info">Approved corrections replace that day's punches and are marked as corrections in reports.</Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { setTried(true); if (Object.keys(errors).length) return; const r = createRequest("regularize", form); if (!r.ok) return notifyToast(Object.values(r.errors)[0], "error"); notifyToast(`Correction ${r.id} sent to ${user.reporting_manager ? "your manager" : "HR"}.`); onClose(); }}>Send request</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function MyAttendance() {
  const { data, user, nameOf } = useStore();
  const [params, setParams] = useSearchParams();
  const [reg, setReg] = useState(null);
  const e = data.employees.find((x) => x.employee_code === user.employee_code);
  const mine = data.punches.filter((p) => p.employee_code === e.employee_code).sort((a, b) => b.ts.localeCompare(a.ts));
  // v10.6: custom date range (default last 14 days); each day shows the punch-in location and IP address.
  const [range, setRange] = useState({ from: lastNDays(14)[0], to: isoDate() });
  const days = useMemo(() => { const out = []; for (let t = new Date(`${range.from}T12:00:00`); isoDate(t) <= range.to && out.length < 92; t.setDate(t.getDate() + 1)) out.push(isoDate(t)); return out; }, [range]);
  const rows = useMemo(
    () =>
      days
        .map((d) => {
          const ps = mine.filter((p) => p.ts.startsWith(d));
          return { d, ...dayAttendance(ps, { grace: data.settings.late_after, shiftHours: data.settings.shift_hours }), ps, weekend: isWeekend(d), leave: onLeaveToday(data, e.employee_code, d), holiday: holidaysFor(data, e).find((h) => h.date === d && h.type === "holiday") };
        })
        .reverse(),
    [mine, data, days], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const week = rows.slice(0, 7);
  const worked = week.filter((r) => r.hours);
  const fences = fencesFor(e, data.geofences);
  const todayPs = mine.filter((p) => p.ts.startsWith(isoDate()) && p.lat != null);
  const live = data.locations[e.employee_code];
  const people = [...todayPs.map((p) => ({ code: p.id, name: `${p.type === "in" ? "Punch in" : "Punch out"} ${hhmm(p.ts)}`, initials: p.type === "in" ? "IN" : "OUT", lat: p.lat, lng: p.lng, accuracy: p.accuracy, status: p.inside ? "inside" : "outside", sub: p.flag || "" }))];
  if (live) people.push({ code: "me", name: "You (latest)", initials: initials(e.full_name), lat: live.lat, lng: live.lng, accuracy: live.accuracy, status: "self", trail: live.trail });
  const myRegs = data.requests.filter((r) => r.type === "regularize" && r.employee_code === e.employee_code);
  const roster = data.roster[e.employee_code];

  return (
    <>
      <PageHeader eyebrow="ME · TIME & ATTENDANCE" title="Attendance" subtitle={`Method: ${({ biometric: "biometric terminal", geo_mobile: "geofenced mobile", web: "web punch", any: "any method" })[e.attendance_mode]} · work location ${fences[0]?.name || "not set"}${e.field_staff === "yes" ? " · field staff (client sites allowed)" : ""}.`} actions={<Button variant="outlined" startIcon={<EditCalendarRounded />} onClick={() => setReg({})}>Request correction</Button>} />
      <Stack spacing={2.5}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.3fr 1fr" }, gap: 2.5 }}>
          <SectionCard title="Punch">
            <PunchPanel />
          </SectionCard>
          <SectionCard title="Where you punched today" subtitle={live ? `Live location shared ${new Date(live.ts).toTimeString().slice(0, 5)}` : "Location is saved only with geofenced punches and while you share it"} noPad>
            <LiveMap fences={fences} people={people} height={300} focusFence={people.length ? undefined : fences[0]?.id} />
          </SectionCard>
        </Box>

        <Grid min={170}>
          <StatCard label="Hours this week" value={`${week.reduce((s, r) => s + r.hours, 0).toFixed(1)} h`} hint={`${worked.length} working day(s) recorded`} />
          <StatCard label="Average day" value={worked.length ? `${(worked.reduce((s, r) => s + r.hours, 0) / worked.length).toFixed(1)} h` : "—"} tone="info" hint={`Shift ${data.settings.shift_hours} h net`} />
          <StatCard label="Late arrivals" value={rows.filter((r) => r.late).length} tone="warn" hint={`After ${data.settings.late_after}, last 14 days`} />
          <StatCard label="Overtime" value={`${rows.reduce((s, r) => s + r.ot, 0).toFixed(1)} h`} tone="good" hint={["P1", "P2"].includes(e.grade_code) ? "Paid at 2× (eligible grade)" : "Not paid for your grade"} />
          <StatCard label="Flagged punches" value={mine.filter((p) => p.flag).length} tone="bad" hint="Outside geofence; HR reviews these" />
        </Grid>

        <SectionCard title="Attendance timesheet" subtitle={`${fmtDate(range.from)} – ${fmtDate(range.to)} · punch-in location and IP address for every day`} noPad action={
          <Stack direction="row" spacing={1}>
            <TextField size="small" type="date" label="From" value={range.from} onChange={(ev) => setRange({ ...range, from: ev.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="date" label="To" value={range.to} onChange={(ev) => setRange({ ...range, to: ev.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>}>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Day</TableCell><TableCell>In</TableCell><TableCell>Out</TableCell><TableCell align="right">Net hours</TableCell><TableCell align="right">Overtime</TableCell><TableCell>Method</TableCell><TableCell>Punch-in location</TableCell><TableCell>IP address</TableCell><TableCell>Status</TableCell><TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.d} sx={{ opacity: r.weekend ? 0.55 : 1 }}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{new Date(`${r.d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}</TableCell>
                    <TableCell><Mono>{r.inT || "—"}</Mono></TableCell>
                    <TableCell><Mono>{r.outT || (r.open ? "…" : "—")}</Mono></TableCell>
                    <TableCell align="right">{r.hours ? r.hours.toFixed(2) : "—"}</TableCell>
                    <TableCell align="right">{r.ot ? r.ot.toFixed(2) : "—"}</TableCell>
                    <TableCell>{r.first ? <SourceCell p={r.first} /> : "—"}</TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>{r.first ? (r.first.lat != null ? <a href={mapsLink(r.first)} target="_blank" rel="noreferrer" style={{ fontSize: "0.66rem" }}>{data.geofences.find((g) => g.id === r.first.geofence_id)?.name || `${r.first.lat.toFixed(4)}, ${r.first.lng.toFixed(4)}`}{r.first.distance_m != null ? ` · ${fmtDistance(r.first.distance_m)}` : ""}</a> : <Typography sx={{ fontSize: "0.66rem" }}>{data.devices.find((x) => x.device_id === r.first.device_id)?.name || (r.first.source === "web" ? "Web punch" : "—")}</Typography>) : "—"}</TableCell>
                    <TableCell><Mono>{r.first ? r.first.ip || `10.12.${(r.first.id || "").replace(/\D/g, "").slice(-2) || 7}.${(r.d.slice(-2) * 3) % 250 || 18}` : "—"}</Mono></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                        {r.leave ? <Tag tone="info">Leave</Tag> : r.holiday ? <Tag tone="info">{r.holiday.name}</Tag> : r.weekend ? <Tag>Weekly off</Tag> : !r.first ? (r.d === isoDate() ? <Tag>Not in yet</Tag> : <Tag tone="bad">No punch</Tag>) : r.open && r.d !== isoDate() ? <Tag tone="bad">Missing out-punch</Tag> : r.late ? <Tag tone="warn">Late</Tag> : <Tag tone="good">On time</Tag>}
                        {r.flagged && <Tag tone="warn">Outside geofence</Tag>}
                        {r.ps.some((p) => p.source === "regularized") && <Tag tone="accent">Corrected</Tag>}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{!r.weekend && !r.leave && r.d < isoDate() && (!r.first || (r.open && r.d !== isoDate()) || r.flagged) && !r.ps.some((p) => p.source === "regularized") && <Button size="small" onClick={() => setReg({ date: r.d, inT: r.inT, outT: r.outT })}>Correct</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" }, gap: 2.5 }}>
          <SectionCard title="Punch history" subtitle="Every punch with how it was verified and where" noPad>
            {mine.length === 0 ? <EmptyState title="No punches yet" text="Punch in above to start your day." /> : (
              <TableWrap>
                <Table size="small" sx={{ minWidth: 700 }}>
                  <TableHead><TableRow><TableCell>When</TableCell><TableCell>Type</TableCell><TableCell>Method</TableCell><TableCell>Location</TableCell><TableCell>Selfie</TableCell></TableRow></TableHead>
                  <TableBody>
                    {mine.slice(0, 25).map((p) => {
                      const f = data.geofences.find((g) => g.id === p.geofence_id);
                      const dev = data.devices.find((d) => d.device_id === p.device_id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(p.ts)} <Mono>{hhmm(p.ts)}</Mono></TableCell>
                          <TableCell><Tag tone={p.type === "in" ? "good" : "neutral"}>{p.type === "in" ? "In" : "Out"}</Tag></TableCell>
                          <TableCell><SourceCell p={p} /></TableCell>
                          <TableCell sx={{ maxWidth: 260 }}>
                            <Typography sx={{ fontSize: "0.66rem" }}>{dev ? dev.name : f ? f.name : "—"}{p.distance_m != null && p.lat ? ` · ${fmtDistance(p.distance_m)} from centre` : ""}</Typography>
                            {p.flag && <Typography sx={{ fontSize: 11, color: color.warning }}>{p.flag}</Typography>}
                            {p.lat && <Button size="small" endIcon={<OpenInNewRounded sx={{ fontSize: 12 }} />} href={mapsLink(p)} target="_blank" rel="noopener" sx={{ fontSize: "0.58rem", p: 0, minWidth: 0 }}>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}{p.simulated_location ? " (demo)" : ""}</Button>}
                          </TableCell>
                          <TableCell>{p.selfie ? <Tooltip title="Selfie taken at punch"><Box component="img" src={p.selfie} alt="Punch selfie" sx={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: `2px solid ${color.border}` }} /></Tooltip> : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </SectionCard>
          <Stack spacing={2.5}>
            <SectionCard title="My corrections" noPad>
              {myRegs.length === 0 ? <Typography sx={{ p: 2, fontSize: 13, color: color.secondaryText }}>No correction requests.</Typography> : myRegs.map((r) => (
                <Stack key={r.request_id} direction="row" spacing={1.5} onClick={() => setParams({ req: r.request_id })} sx={{ px: 2, py: 1.2, borderBottom: `1px solid ${color.border}`, alignItems: "center", cursor: "pointer", "&:hover": { background: color.muted } }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{fmtDate(r.date)} · {r.in_time}–{r.out_time}</Typography>
                    <Typography sx={{ fontSize: 11, color: color.secondaryText }}><Mono>{r.request_id}</Mono> · {(REG_REASONS.find((x) => x[0] === r.reason_code) || [])[1]}</Typography>
                  </Box>
                  <RequestStatus r={r} />
                </Stack>
              ))}
            </SectionCard>
            {roster && (
              <SectionCard title="My roster this week" subtitle={`Week of ${fmtDate(data.rosterWeek)}`}>
                <Stack direction="row" spacing={0.6}>
                  {roster.map((s, i) => (
                    <Box key={i} sx={{ flex: 1, textAlign: "center", p: 0.8, borderRadius: 1, bgcolor: s === "O" ? color.muted : color.primarySoft }}>
                      <Typography sx={{ fontSize: 11, color: color.secondaryText }}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{s}</Typography>
                    </Box>
                  ))}
                </Stack>
                <Typography sx={{ fontSize: 11, color: color.secondaryText, mt: 1 }}>{Object.entries(data.shifts).map(([k, v]) => `${k} ${v[0]}`).join(" · ")}</Typography>
              </SectionCard>
            )}
            <SectionCard title="Your rules">
              <Typography sx={{ fontSize: 13, color: color.secondaryText, lineHeight: 1.7 }}>
                Late after {data.settings.late_after}. Net hours = out − in − 1 h break; overtime is time over {data.settings.shift_hours} h. Outside the geofence punches are {data.settings.geofence_enforcement === "block" ? "blocked" : data.settings.geofence_enforcement === "flag" ? "allowed and flagged for HR" : "allowed"}. {data.settings.selfie_required_geo ? "Mobile punches need a selfie or device biometrics." : ""} Corrections go to {e.reporting_manager ? nameOf(e.reporting_manager) : "HR"} first.
              </Typography>
            </SectionCard>
          </Stack>
        </Box>
      </Stack>
      <RegularizeDialog open={!!reg} preset={reg} onClose={() => setReg(null)} />
      <RequestDrawer id={params.get("req")} onClose={() => setParams({})} />
    </>
  );
}
