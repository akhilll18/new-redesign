// Call tracker: employees log calls; managers and admins see the team's activity against targets.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, LinearProgress, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { AddIcCallRounded, CallMadeRounded, CallReceivedRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap, EmptyState, BarChart, Mono } from "../kit/UI.jsx";
import { callStats, fmtDur, lastNDays, hhmm } from "../../lib/hrcalc.js";
import { isoDate, fmtDate, downloadCsv } from "../../lib/utils.js";

const OUTCOME = { connected: ["Connected", "good"], no_answer: ["No answer", "neutral"], busy: ["Busy", "neutral"], voicemail: ["Voicemail", "info"] };
const DISP = { interested: ["Interested", "info"], not_interested: ["Not interested", "neutral"], follow_up: ["Follow-up", "warn"], won: ["Won", "good"] };

function LogCallDialog({ open, onClose }) {
  const { logCall, notifyToast } = useStore();
  const [f, setF] = useState({});
  const [error, setError] = useState("");
  React.useEffect(() => {
    if (open) {
      setF({ direction: "outbound", contact: "", company: "", phone: "", outcome: "connected", duration: "3:00", disposition: "interested", follow_up_date: "", notes: "" });
      setError("");
    }
  }, [open]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Log a call</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <ToggleButtonGroup exclusive size="small" value={f.direction} onChange={(_, v) => v && set("direction", v)}>
            <ToggleButton value="outbound" sx={{ fontSize: "0.65rem", gap: 0.5 }}><CallMadeRounded sx={{ fontSize: 15 }} /> Outbound</ToggleButton>
            <ToggleButton value="inbound" sx={{ fontSize: "0.65rem", gap: 0.5 }}><CallReceivedRounded sx={{ fontSize: 15 }} /> Inbound</ToggleButton>
          </ToggleButtonGroup>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Contact *" value={f.contact || ""} onChange={(e) => set("contact", e.target.value)} />
            <TextField label="Company *" value={f.company || ""} onChange={(e) => set("company", e.target.value)} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Phone" value={f.phone || ""} onChange={(e) => set("phone", e.target.value)} />
            <FormControl size="small" fullWidth>
              <InputLabel>Outcome *</InputLabel>
              <Select label="Outcome *" value={f.outcome || "connected"} onChange={(e) => set("outcome", e.target.value)}>
                {Object.entries(OUTCOME).map(([k, [l]]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Duration (mm:ss)" value={f.duration || ""} disabled={f.outcome !== "connected"} onChange={(e) => set("duration", e.target.value.replace(/[^\d:]/g, ""))} />
          </Stack>
          {f.outcome === "connected" && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Result</InputLabel>
                <Select label="Result" value={f.disposition || "interested"} onChange={(e) => set("disposition", e.target.value)}>
                  {Object.entries(DISP).map(([k, [l]]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
                </Select>
              </FormControl>
              {f.disposition === "follow_up" && <TextField label="Follow up on *" type="date" value={f.follow_up_date || ""} onChange={(e) => set("follow_up_date", e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: isoDate() } }} />}
            </Stack>
          )}
          <TextField label="Notes" multiline minRows={2} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} />
          <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>Calls from the mobile dialer app are logged automatically; use this for calls made from other phones.</Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = logCall(f); if (!r.ok) return setError(r.error); notifyToast("Call logged."); onClose(); }}>Save call</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CallTracker({ employees, self = false }) {
  const { data, user } = useStore();
  const [range, setRange] = useState("today");
  const [rep, setRep] = useState("");
  const [open, setOpen] = useState(false);
  const target = data.settings.call_daily_target;
  const reps = employees.filter((e) => e.call_tracking === "yes" && e.status === "active");
  const codes = new Set((self ? [user.employee_code] : reps.map((e) => e.employee_code)).filter((c) => !rep || c === rep));
  const days = range === "today" ? [isoDate()] : lastNDays(7);
  const calls = useMemo(() => data.calls.filter((c) => codes.has(c.employee_code) && days.some((d) => c.ts.startsWith(d))).sort((a, b) => b.ts.localeCompare(a.ts)), [data.calls, rep, range, self]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = callStats(calls);
  const workDays = range === "today" ? 1 : days.filter((d) => ![0, 6].includes(new Date(`${d}T12:00:00`).getDay())).length;
  const goal = target * workDays * codes.size;
  const hours = Array.from({ length: 11 }, (_, i) => 8 + i).map((h) => ({ label: `${h}:00`, calls: calls.filter((c) => new Date(c.ts).getHours() === h).length, connected: calls.filter((c) => new Date(c.ts).getHours() === h && c.outcome === "connected").length }));
  const board = reps
    .filter((e) => !self && (!rep || e.employee_code === rep))
    .map((e) => ({ e, s: callStats(calls.filter((c) => c.employee_code === e.employee_code)) }))
    .sort((a, b) => b.s.total - a.s.total);
  const followUps = data.calls.filter((c) => codes.has(c.employee_code) && c.disposition === "follow_up" && c.follow_up_date && c.follow_up_date <= isoDate(Date.now() + 2 * 86400000)).sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date)).slice(0, 8);
  const name = (code) => data.employees.find((e) => e.employee_code === code)?.full_name;

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
          <ToggleButtonGroup exclusive size="small" value={range} onChange={(_, v) => v && setRange(v)}>
            <ToggleButton value="today" sx={{ fontSize: "0.65rem" }}>Today</ToggleButton>
            <ToggleButton value="week" sx={{ fontSize: "0.65rem" }}>Last 7 days</ToggleButton>
          </ToggleButtonGroup>
          {!self && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Rep</InputLabel>
              <Select label="Rep" value={rep} onChange={(e) => setRep(e.target.value)}>
                <MenuItem value="">Everyone ({reps.length})</MenuItem>
                {reps.map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" disabled={!calls.length} onClick={() => downloadCsv(`calls-${range}.csv`, ["Time", "Rep", "Direction", "Contact", "Company", "Outcome", "Result", "Duration (s)", "Follow up", "Source", "Notes"], calls.map((c) => [c.ts, name(c.employee_code), c.direction, c.contact, c.company, c.outcome, c.disposition, c.duration_sec, c.follow_up_date, c.source, c.notes]))}>CSV</Button>
          {self && <Button variant="contained" startIcon={<AddIcCallRounded />} onClick={() => setOpen(true)}>Log call</Button>}
        </Stack>
      </Stack>
      <Grid min={160}>
        <StatCard label="Calls" value={s.total} hint={`Target ${goal} (${target}/day per rep)`} />
        <StatCard label="Connect rate" value={`${s.connectRate}%`} tone="good" hint={`${s.connected} connected`} />
        <StatCard label="Talk time" value={`${s.talkMin} min`} tone="info" hint={`Avg ${fmtDur(s.avgSec)} per connected call`} />
        <StatCard label="Won" value={s.won} tone="accent" hint="Calls marked as won" />
        <StatCard label="Follow-ups due" value={followUps.length} tone="warn" hint="Today and the next 2 days" />
      </Grid>
      <SectionCard title="Progress to target">
        <LinearProgress variant="determinate" value={Math.min(100, (s.total / Math.max(1, goal)) * 100)} sx={{ height: 10, borderRadius: 5 }} />
        <Typography sx={{ fontSize: "0.62rem", color: "#78827b", mt: 0.8 }}>{s.total} of {goal} calls · {Math.round((s.total / Math.max(1, goal)) * 100)}%</Typography>
      </SectionCard>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: board.length ? "1.2fr 1fr" : "1fr 1fr" }, gap: 2.5 }}>
        {board.length > 0 ? (
          <SectionCard title="Leaderboard" noPad>
            <TableWrap>
              <Table size="small" sx={{ minWidth: 560 }}>
                <TableHead><TableRow><TableCell>Rep</TableCell><TableCell align="right">Calls</TableCell><TableCell align="right">Connect %</TableCell><TableCell align="right">Talk</TableCell><TableCell align="right">Won</TableCell><TableCell sx={{ width: 140 }}>Vs target</TableCell></TableRow></TableHead>
                <TableBody>
                  {board.map(({ e, s: x }) => (
                    <TableRow key={e.employee_code}>
                      <TableCell><PersonCell name={e.full_name} sub={e.designation} /></TableCell>
                      <TableCell align="right">{x.total}</TableCell>
                      <TableCell align="right">{x.connectRate}%</TableCell>
                      <TableCell align="right">{x.talkMin} min</TableCell>
                      <TableCell align="right">{x.won}</TableCell>
                      <TableCell><LinearProgress variant="determinate" color={x.total >= target * workDays ? "success" : "primary"} value={Math.min(100, (x.total / (target * workDays)) * 100)} sx={{ height: 6, borderRadius: 3 }} /><Typography sx={{ fontSize: "0.55rem", color: "#78827b" }}>{x.total}/{target * workDays}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          </SectionCard>
        ) : (
          <SectionCard title="Calls by hour">
            <BarChart data={hours.map((h) => ({ label: h.label.replace(":00", ""), calls: h.calls, connected: h.connected }))} series={[{ key: "calls", label: "Calls", color: "#2A7DC9" }, { key: "connected", label: "Connected", color: "#1A9A72" }]} height={150} />
          </SectionCard>
        )}
        <SectionCard title="Follow-ups due" noPad>
          {followUps.length === 0 ? <Typography sx={{ p: 2, fontSize: "0.66rem", color: "#78827b" }}>No follow-ups due.</Typography> : followUps.map((c) => (
            <Stack key={c.id} direction="row" spacing={1.2} sx={{ px: 2, py: 1.1, borderBottom: "1px solid #f0f2ef", alignItems: "center" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{c.contact} · {c.company}</Typography>
                <Typography noWrap sx={{ fontSize: "0.6rem", color: "#78827b" }}>{self ? "" : `${name(c.employee_code)} · `}{c.notes || "Follow up"}</Typography>
              </Box>
              <Tag tone={c.follow_up_date < isoDate() ? "bad" : c.follow_up_date === isoDate() ? "warn" : "neutral"}>{c.follow_up_date === isoDate() ? "Today" : fmtDate(c.follow_up_date)}</Tag>
            </Stack>
          ))}
        </SectionCard>
      </Box>
      {board.length > 0 && (
        <SectionCard title="Calls by hour" subtitle="Two series: all calls and connected calls">
          <BarChart data={hours.map((h) => ({ label: h.label.replace(":00", ""), calls: h.calls, connected: h.connected }))} series={[{ key: "calls", label: "Calls", color: "#2A7DC9" }, { key: "connected", label: "Connected", color: "#1A9A72" }]} height={150} />
        </SectionCard>
      )}
      <SectionCard title={self ? "My calls" : "Call log"} noPad>
        {calls.length === 0 ? <EmptyState title="No calls in this period" text={self ? "Log a call, or calls from the dialer app appear here automatically." : "Calls from the team appear here."} /> : (
          <TableWrap>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead><TableRow><TableCell>Time</TableCell>{!self && <TableCell>Rep</TableCell>}<TableCell>Contact</TableCell><TableCell>Outcome</TableCell><TableCell align="right">Duration</TableCell><TableCell>Result</TableCell><TableCell>Notes</TableCell></TableRow></TableHead>
              <TableBody>
                {calls.slice(0, 60).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{range === "today" ? "" : `${fmtDate(c.ts)} `}<Mono>{hhmm(c.ts)}</Mono> {c.direction === "inbound" ? <CallReceivedRounded sx={{ fontSize: 13, color: "#46719a", verticalAlign: "middle" }} /> : <CallMadeRounded sx={{ fontSize: 13, color: "#2e7d32", verticalAlign: "middle" }} />}</TableCell>
                    {!self && <TableCell>{name(c.employee_code)}</TableCell>}
                    <TableCell><Typography sx={{ fontSize: "0.68rem", fontWeight: 600 }}>{c.contact}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{c.company}</Typography></TableCell>
                    <TableCell><Tag tone={OUTCOME[c.outcome]?.[1]}>{OUTCOME[c.outcome]?.[0]}</Tag></TableCell>
                    <TableCell align="right"><Mono>{c.duration_sec ? fmtDur(c.duration_sec) : "—"}</Mono></TableCell>
                    <TableCell>{c.disposition ? <Tag tone={DISP[c.disposition]?.[1]}>{DISP[c.disposition]?.[0]}</Tag> : "—"}</TableCell>
                    <TableCell sx={{ maxWidth: 220 }}><Typography noWrap sx={{ fontSize: "0.62rem" }}>{c.notes || (c.source === "mobile_app" ? "Dialer app" : "")}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
      <LogCallDialog open={open} onClose={() => setOpen(false)} />
    </Stack>
  );
}
