// Attendance administration: today's register, punch log, biometric terminals, timesheet and overtime.
import React, { useMemo, useState } from "react";
import { Box, Button, Chip, FormControl, InputAdornment, InputLabel, MenuItem, Select, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import { SearchRounded, SyncRounded, FingerprintRounded, FaceRounded, WifiRounded, WifiOffRounded, DownloadRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap, Mono, EmptyState } from "../kit/UI.jsx";
import { register, registerCounts, STATUS_META } from "../../lib/workforce.js";
import { dayAttendance, lastNDays, hhmm, isWeekend } from "../../lib/hrcalc.js";
import { fmtDistance } from "../../lib/geo.js";
import { isoDate, fmtDate, timeAgo, fmtNum, downloadCsv } from "../../lib/utils.js";
import { SourceCell } from "../../pages/workforce/MyAttendance.jsx";

export function DevicesTable({ canSync = true }) {
  const { data, syncDevice, notifyToast } = useStore();
  return (
    <TableWrap>
      <Table size="small" sx={{ minWidth: 760 }}>
        <TableHead><TableRow><TableCell>Terminal</TableCell><TableCell>Type</TableCell><TableCell>Location</TableCell><TableCell>Status</TableCell><TableCell align="right">Enrolled</TableCell><TableCell>Last sync</TableCell><TableCell align="right">Punches today</TableCell>{canSync && <TableCell />}</TableRow></TableHead>
        <TableBody>
          {data.devices.map((d) => {
            const today = data.punches.filter((p) => p.device_id === d.device_id && p.ts.startsWith(isoDate())).length;
            return (
              <TableRow key={d.device_id}>
                <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{d.name}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}><Mono>{d.device_id}</Mono> · {d.serial} · {d.ip} · fw {d.firmware}</Typography></TableCell>
                <TableCell><Stack direction="row" spacing={0.5} sx={{ alignItems: "center", "& svg": { fontSize: 16, color: "#2e7d32" } }}>{d.type === "face" ? <FaceRounded /> : <FingerprintRounded />}<span>{d.type === "face" ? "Face" : "Fingerprint"}</span></Stack></TableCell>
                <TableCell>{data.geofences.find((g) => g.id === d.geofence_id)?.name}</TableCell>
                <TableCell><Tag tone={d.status === "online" ? "good" : "bad"}>{d.status === "online" ? <><WifiRounded sx={{ fontSize: 12, mr: 0.4, verticalAlign: "middle" }} />Online</> : <><WifiOffRounded sx={{ fontSize: 12, mr: 0.4, verticalAlign: "middle" }} />Offline</>}</Tag></TableCell>
                <TableCell align="right">{d.enrolled}</TableCell>
                <TableCell>{d.last_sync ? timeAgo(d.last_sync) : "Never"}</TableCell>
                <TableCell align="right">{today}</TableCell>
                {canSync && <TableCell align="right"><Button size="small" startIcon={<SyncRounded />} onClick={() => { const r = syncDevice(d.device_id); notifyToast(r.ok ? `${d.name}: ${r.added} new punch(es) pulled.` : r.error, r.ok ? "success" : "error"); }}>Sync now</Button></TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableWrap>
  );
}

export default function AttendanceAdminView({ employees }) {
  const { data } = useStore();
  const [tab, setTab] = useState("today");
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [srcF, setSrcF] = useState("");
  const active = employees.filter((e) => e.status === "active");
  const reg = useMemo(() => register(data, active), [data, employees]); // eslint-disable-line react-hooks/exhaustive-deps
  const c = registerCounts(reg);
  const codes = new Set(active.map((e) => e.employee_code));
  const name = (code) => data.employees.find((e) => e.employee_code === code)?.full_name;
  const punches = data.punches.filter((p) => codes.has(p.employee_code)).sort((a, b) => b.ts.localeCompare(a.ts));
  const filteredPunches = punches.filter((p) => (!srcF || p.source === srcF) && (!q || name(p.employee_code)?.toLowerCase().includes(q.toLowerCase()))).slice(0, 150);
  const week = lastNDays(7).filter((d) => !isWeekend(d));
  const ts = active.map((e) => {
    const daysA = week.map((d) => dayAttendance(data.punches.filter((p) => p.employee_code === e.employee_code && p.ts.startsWith(d)), { grace: data.settings.late_after, shiftHours: data.settings.shift_hours }));
    const tot = daysA.reduce((s, a) => s + a.hours, 0);
    const ot = daysA.reduce((s, a) => s + a.ot, 0);
    const elig = ["P1", "P2"].includes(e.grade_code);
    const hourly = e.monthly_gross / (26 * 8);
    return { e, daysA, tot, ot, late: daysA.filter((a) => a.late).length, missing: daysA.filter((a, i) => a.open && week[i] !== isoDate()).length, elig, otPay: elig ? Math.round(ot * hourly * 2) : 0, cur: e.country_code || "IN" };
  });
  const flagged = punches.filter((p) => p.flag && p.ts >= lastNDays(7)[0]);
  const rows = reg.filter((r) => (!statusF || r.status === statusF) && (!q || r.e.full_name.toLowerCase().includes(q.toLowerCase())));

  return (
    <Stack spacing={2.5}>
      <Grid min={150}>
        <StatCard label="On time" value={c.present} tone="good" hint={`of ${reg.length} today`} />
        <StatCard label="Late" value={c.late} tone="warn" hint={`After ${data.settings.late_after}`} />
        <StatCard label="Not in" value={c.absent + c.not_in} tone="bad" hint="No punch and no leave" />
        <StatCard label="On leave" value={c.leave} tone="info" />
        <StatCard label="Clocked out" value={c.out} tone="neutral" />
        <StatCard label="Flagged (7 days)" value={flagged.length} tone="bad" hint="Punches outside a geofence" />
      </Grid>
      <SectionCard noPad>
        <Box sx={{ px: 1.5, pt: 1, borderBottom: "1px solid #edf0ec" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
            {/* v10.6: today's register, the punch log and the timesheet & overtime are one tab */}
            <Tab value="today" label={`Today's register · punch log · timesheet & overtime`} sx={{ fontSize: "0.7rem" }} />
            <Tab value="devices" label={`Biometric terminals (${data.devices.length})`} sx={{ fontSize: "0.7rem" }} />
            <Tab value="flags" label={`Geofence flags (${flagged.length})`} sx={{ fontSize: "0.7rem" }} />
          </Tabs>
        </Box>
        {["today", "log"].includes(tab) && (
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ p: 1.5 }}>
            <TextField placeholder="Search employee" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: { md: 260 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
              <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                <Chip size="small" label="All" color={!statusF ? "primary" : "default"} onClick={() => setStatusF("")} />
                {Object.entries(STATUS_META).filter(([k]) => c[k]).map(([k, [l]]) => <Chip key={k} size="small" label={`${l} (${c[k]})`} color={statusF === k ? "primary" : "default"} variant={statusF === k ? "filled" : "outlined"} onClick={() => setStatusF(k)} />)}
              </Stack>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Method</InputLabel>
                <Select label="Method" value={srcF} onChange={(e) => setSrcF(e.target.value)}>
                  <MenuItem value="">All methods</MenuItem>
                  {[["biometric_fp", "Fingerprint terminal"], ["biometric_face", "Face terminal"], ["geo_mobile", "Geofenced mobile"], ["web", "Web"], ["regularized", "Correction"]].map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
                </Select>
              </FormControl>
          </Stack>
        )}
        {tab === "today" && (
          <TableWrap>
            <Table size="small" sx={{ minWidth: 860 }}>
              <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Status</TableCell><TableCell>In</TableCell><TableCell>Out</TableCell><TableCell align="right">Hours</TableCell><TableCell>Method</TableCell><TableCell>Where</TableCell></TableRow></TableHead>
              <TableBody>
                {rows.map((r) => {
                  const f = data.geofences.find((g) => g.id === r.first?.geofence_id);
                  return (
                    <TableRow key={r.e.employee_code}>
                      <TableCell><PersonCell name={r.e.full_name} sub={`${r.e.employee_code} · ${r.e.department}`} /></TableCell>
                      <TableCell><Stack direction="row" spacing={0.5}><Tag tone={STATUS_META[r.status][1]}>{STATUS_META[r.status][0]}</Tag>{r.flagged && <Tag tone="warn">Flag</Tag>}</Stack></TableCell>
                      <TableCell><Mono>{r.inT || "—"}</Mono></TableCell>
                      <TableCell><Mono>{r.outT || (r.open ? "…" : "—")}</Mono></TableCell>
                      <TableCell align="right">{r.hours ? r.hours.toFixed(1) : "—"}</TableCell>
                      <TableCell>{r.first ? <SourceCell p={r.first} /> : r.leave ? r.leave.leave_type : "—"}</TableCell>
                      <TableCell sx={{ maxWidth: 220 }}><Typography noWrap sx={{ fontSize: "0.65rem" }}>{f ? `${f.name}${r.first?.distance_m != null && r.first.lat ? ` · ${fmtDistance(r.first.distance_m)}` : ""}` : "—"}</Typography></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrap>
        )}
        {tab === "today" && (
          <>
            <Typography sx={{ px: 2, pt: 2.2, pb: 0.8,  fontWeight: 800, fontSize: "0.82rem", color: "#17404D", borderTop: "1px solid #edf0ec" }}>Punch log · {filteredPunches.length} latest{srcF ? " (method filter on)" : ""}</Typography>
            <TableWrap>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead><TableRow><TableCell>When</TableCell><TableCell>Employee</TableCell><TableCell>Type</TableCell><TableCell>Method</TableCell><TableCell>Terminal / site</TableCell><TableCell>Geofence</TableCell><TableCell>Selfie</TableCell></TableRow></TableHead>
                <TableBody>
                  {filteredPunches.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(p.ts)} <Mono>{hhmm(p.ts)}</Mono></TableCell>
                      <TableCell>{name(p.employee_code)}</TableCell>
                      <TableCell><Tag tone={p.type === "in" ? "good" : "neutral"}>{p.type === "in" ? "In" : "Out"}</Tag></TableCell>
                      <TableCell><SourceCell p={p} /></TableCell>
                      <TableCell>{data.devices.find((d) => d.device_id === p.device_id)?.name || data.geofences.find((g) => g.id === p.geofence_id)?.name || "—"}</TableCell>
                      <TableCell>{p.source === "geo_mobile" ? <Tag tone={p.inside ? "good" : "warn"}>{p.inside ? "Inside" : "Outside"}{p.distance_m != null ? ` · ${fmtDistance(p.distance_m)}` : ""}</Tag> : "—"}</TableCell>
                      <TableCell>{p.selfie ? <Tooltip title="Selfie at punch"><Box component="img" src={p.selfie} alt="" sx={{ width: 28, height: 28, borderRadius: "50%" }} /></Tooltip> : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
            <Stack direction="row" sx={{ p: 1.5, justifyContent: "space-between", alignItems: "center" }}>
              <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>Showing the latest {filteredPunches.length} punches.</Typography>
              <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv("punch-log.csv", ["Time", "Employee code", "Employee", "Type", "Source", "Verified", "Device", "Geofence", "Inside", "Distance m", "Lat", "Lng", "Flag"], punches.map((p) => [p.ts, p.employee_code, name(p.employee_code), p.type, p.source, p.verified, p.device_id || "", p.geofence_id || "", p.inside, p.distance_m ?? "", p.lat ?? "", p.lng ?? "", p.flag || ""]))}>Export all</Button>
            </Stack>
          </>
        )}
        {tab === "today" && (
          <>
          <Typography sx={{ px: 2, pt: 2.2, pb: 0.8,  fontWeight: 800, fontSize: "0.82rem", color: "#17404D", borderTop: "1px solid #edf0ec" }}>Timesheet & overtime · last 7 working days</Typography>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  {week.map((d) => <TableCell key={d} align="center">{new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</TableCell>)}
                  <TableCell align="right">Total</TableCell><TableCell align="right">Overtime</TableCell><TableCell align="right">Late</TableCell><TableCell align="right">OT pay (2×)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ts.map((r) => (
                  <TableRow key={r.e.employee_code}>
                    <TableCell><PersonCell name={r.e.full_name} sub={`${r.e.grade_code}${r.elig ? " · OT eligible" : ""}`} /></TableCell>
                    {r.daysA.map((a, i) => <TableCell key={i} align="center"><Typography sx={{ fontSize: "0.62rem",  color: a.late ? "#bf7955" : "inherit" }}>{a.inT ? `${a.inT}–${a.outT || "…"}` : "—"}</Typography><Typography sx={{ fontSize: "0.55rem", color: "#8a948d" }}>{a.hours ? `${a.hours.toFixed(1)} h` : ""}</Typography></TableCell>)}
                    <TableCell align="right">{r.tot.toFixed(1)}</TableCell>
                    <TableCell align="right">{r.ot.toFixed(1)}</TableCell>
                    <TableCell align="right">{r.late}</TableCell>
                    <TableCell align="right">{r.elig ? `${r.cur === "IN" ? "₹" : ""}${fmtNum(r.otPay)}` : <Tag>Not eligible</Tag>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
          </>
        )}
        {tab === "devices" && (
          <>
            <DevicesTable />
            <Typography sx={{ p: 1.5, fontSize: "0.6rem", color: "#78827b" }}>Terminals push punches to the server as they happen. “Sync now” pulls anything a terminal stored while offline. Register or move terminals in Geofences & devices (Super Admin).</Typography>
          </>
        )}
        {tab === "flags" && (flagged.length === 0 ? <EmptyState title="No flagged punches" text="Punches outside a geofence in the last 7 days appear here." /> : (
          <TableWrap>
            <Table size="small" sx={{ minWidth: 700 }}>
              <TableHead><TableRow><TableCell>When</TableCell><TableCell>Employee</TableCell><TableCell>Type</TableCell><TableCell>Detail</TableCell><TableCell>Verified by</TableCell></TableRow></TableHead>
              <TableBody>
                {flagged.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(p.ts)} <Mono>{hhmm(p.ts)}</Mono></TableCell>
                    <TableCell>{name(p.employee_code)}</TableCell>
                    <TableCell>{p.type}</TableCell>
                    <TableCell>{p.flag}</TableCell>
                    <TableCell><SourceCell p={p} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        ))}
      </SectionCard>
    </Stack>
  );
}
