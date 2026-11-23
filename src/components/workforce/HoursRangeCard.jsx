// Home "My hours" card: pick Today, Yesterday, This week, Last week, This month, Last month or a custom range on the calendar,
// and see worked hours, system screen-off hours and total hours for those dates (from punches and, when shared, activity data).
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, IconButton, InputLabel, MenuItem, Popover, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { CalendarMonthRounded, ChevronLeftRounded, ChevronRightRounded, NorthEastRounded, SouthEastRounded, MoreTimeRounded, ListAltRounded } from "@mui/icons-material";
import { SCREENOFF_REASONS, fmtMins } from "../../lib/requests.js";
import { useStore } from "../../store/AppStore.jsx";
import { Panel } from "../PortalUI.jsx";
import { hoursInRange, fmtHrs } from "../../lib/hrcalc.js";
import { designTokens } from "../../theme/muiTheme.js";

const { color: tokens } = designTokens;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => new Date(`${s}T12:00:00`);
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const span = (a, b) => Math.round((parse(b) - parse(a)) / 86400000) + 1;
const nice = (s, opts = { day: "2-digit", month: "short" }) => parse(s).toLocaleDateString("en-GB", opts);

function presetRange(id) {
  const t = new Date();
  const today = iso(t);
  const dow = (t.getDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -dow);
  const first = iso(new Date(t.getFullYear(), t.getMonth(), 1));
  if (id === "today") return [today, today];
  if (id === "yesterday") return [addDays(today, -1), addDays(today, -1)];
  if (id === "week") return [monday, today];
  if (id === "lastweek") return [addDays(monday, -7), addDays(monday, -1)];
  if (id === "month") return [first, today];
  if (id === "lastmonth") return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), addDays(first, -1)];
  return [monday, today];
}
const PRESETS = [["today", "Today"], ["yesterday", "Yesterday"], ["week", "This week"], ["lastweek", "Last week"], ["month", "This month"], ["lastmonth", "Last month"]];
const C = { worked: tokens.primary, off: tokens.warning, total: tokens.text };

function RangeCalendar({ from, to, onPick }) {
  const [month, setMonth] = useState(() => { const d = parse(to); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [anchor, setAnchor] = useState(null); // first click of a new range
  const today = iso(new Date());
  const first = new Date(month);
  const lead = (first.getDay() + 6) % 7;
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => iso(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
  const click = (d) => {
    if (d > today) return;
    if (!anchor) { setAnchor(d); onPick(d, d, false); return; }
    const [a, b] = d < anchor ? [d, anchor] : [anchor, d];
    setAnchor(null);
    onPick(a, b, true);
  };
  return (
    <Box sx={{ p: 1.5, width: 270 }}>
      <Stack direction="row" sx={{ alignItems: "center", mb: 1 }}>
        <IconButton size="small" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeftRounded fontSize="small" /></IconButton>
        <Typography sx={{ flex: 1, textAlign: "center", fontSize: "0.72rem", fontWeight: 700 }}>{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</Typography>
        <IconButton size="small" disabled={iso(new Date(month.getFullYear(), month.getMonth() + 1, 1)) > today} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRightRounded fontSize="small" /></IconButton>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.3 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => <Typography key={i} sx={{ fontSize: 11, color: tokens.secondaryText, textAlign: "center", fontWeight: 600 }}>{w}</Typography>)}
        {cells.map((d, i) => {
          if (!d) return <Box key={`e${i}`} />;
          const inRange = d >= from && d <= to;
          const edge = d === from || d === to;
          const future = d > today;
          return (
            <Box key={d} component="button" type="button" disabled={future} onClick={() => click(d)} aria-label={d}
              sx={{ all: "unset", textAlign: "center", py: 0.6, borderRadius: 1, fontSize: 12, cursor: future ? "default" : "pointer", color: future ? tokens.mutedText : edge ? tokens.card : tokens.text, background: edge ? tokens.primary : inRange ? tokens.primarySoft : "transparent", fontWeight: d === today ? 700 : 500, outline: d === today && !edge ? `1px solid ${tokens.borderStrong}` : "none", "&:hover": future ? {} : { background: edge ? tokens.primaryHover : tokens.muted } }}>
              {Number(d.slice(8))}
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ fontSize: 11, color: tokens.secondaryText, mt: 1 }}>{anchor ? "Now click the end date." : "Click a start date, then an end date."}</Typography>
    </Box>
  );
}

export default function HoursRangeCard() {
  const { data, user } = useStore();
  const [claim, setClaim] = useState(false);
  const [claims, setClaims] = useState(false);
  const code = user.employee_code;
  const [preset, setPreset] = useState("week");
  const [range, setRange] = useState(() => presetRange("week"));
  const [anchorEl, setAnchorEl] = useState(null);
  const [from, to] = range;
  const r = useMemo(() => hoursInRange(data, code, from, to), [data, code, from, to]);
  const len = span(from, to);
  const prev = useMemo(() => hoursInRange(data, code, addDays(from, -len), addDays(from, -1)), [data, code, from, len]);
  const change = prev.worked ? ((r.worked - prev.worked) / prev.worked) * 100 : null;
  const pick = (id) => { setPreset(id); setRange(presetRange(id)); };
  // Bars: one per day up to 31 days, otherwise one per week.
  const bars = useMemo(() => {
    if (r.days.length <= 31) return r.days.map((d) => ({ key: d.date, label: len <= 7 ? nice(d.date, { weekday: "short" }) : String(Number(d.date.slice(8))), tip: `${nice(d.date, { weekday: "short", day: "2-digit", month: "short" })}${d.inT ? ` · in ${d.inT}${d.outT ? ` · out ${d.outT}` : d.open ? " · still in" : ""}` : " · no punch"}`, worked: d.worked, off: d.screenOff, weekend: d.weekend }));
    const out = [];
    for (let i = 0; i < r.days.length; i += 7) {
      const w = r.days.slice(i, i + 7);
      out.push({ key: w[0].date, label: nice(w[0].date), tip: `Week of ${nice(w[0].date)}`, worked: w.reduce((s, x) => s + x.worked, 0), off: w.reduce((s, x) => s + x.screenOff, 0) });
    }
    return out;
  }, [r, len]);
  const max = Math.max(1, ...bars.map((b) => b.worked + b.off));
  const subtitle = from === to ? nice(from, { weekday: "long", day: "2-digit", month: "short", year: "numeric" }) : `${nice(from)} – ${nice(to, { day: "2-digit", month: "short", year: "numeric" })} · ${len} days`;
  const stat = (label, value, color, hint) => (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}><Box sx={{ width: 8, height: 8, borderRadius: "2px", background: color }} /><Typography sx={{ fontSize: 11, color: tokens.secondaryText, fontWeight: 600, letterSpacing: "0.04em" }}>{label.toUpperCase()}</Typography></Stack>
      <Typography sx={{ fontWeight: 700, fontSize: 18, color: tokens.text, mt: 0.3 }}>{fmtHrs(value)}</Typography>
      {hint && <Typography sx={{ fontSize: 11, color: tokens.secondaryText }}>{hint}</Typography>}
    </Box>
  );
  return (
    <Panel
      title="My hours"
      subtitle={subtitle}
      action={
        <Tooltip title="Pick dates on the calendar" describeChild>
          <Button size="small" variant={preset === "custom" ? "contained" : "outlined"} startIcon={<CalendarMonthRounded sx={{ fontSize: 16 }} />} onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ fontSize: "0.6rem", py: 0.3 }}>Custom</Button>
        </Tooltip>
      }
    >
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", px: 2.2, pt: 1.4 }}>
        {PRESETS.map(([id, l]) => <Chip key={id} size="small" label={l} onClick={() => pick(id)} color={preset === id ? "primary" : "default"} variant={preset === id ? "filled" : "outlined"} sx={{ height: 22, fontSize: "0.58rem" }} />)}
      </Stack>
      <Stack direction="row" spacing={1.5} sx={{ px: 2.2, pt: 1.5 }}>
        {stat("Worked", r.worked, C.worked, `${r.present} day(s) present · avg ${fmtHrs(r.avg)}/day${r.claimed ? ` · incl. ${fmtHrs(r.claimed)} claimed` : ""}`)}
        {stat("Screen off", r.screenOff, C.off, r.claimed || r.claimPending ? `${r.claimed ? `${fmtHrs(r.claimed)} approved as work` : ""}${r.claimed && r.claimPending ? " · " : ""}${r.claimPending ? `${fmtHrs(r.claimPending)} awaiting manager` : ""}` : r.measuredDays ? `idle / locked on ${r.measuredDays} day(s)` : "estimated breaks")}
        {stat("Total", r.total, C.total, "first in → last out")}
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap sx={{ px: 2.2, pt: 1.2, alignItems: "center", flexWrap: "wrap" }}>
        <Tooltip title={r.claimable * 60 >= 5 ? "Were you working while the screen was off (meeting, call, field work)? Ask your manager to count it as worked time." : "No unclaimed screen-off time in this range. You can still pick another day."} describeChild>
          <Button size="small" variant="outlined" startIcon={<MoreTimeRounded sx={{ fontSize: 16 }} />} onClick={() => setClaim(true)} sx={{ fontSize: "0.6rem", py: 0.3 }}>Claim screen-off time</Button>
        </Tooltip>
        {myClaims(data, code).length > 0 && <Button size="small" startIcon={<ListAltRounded sx={{ fontSize: 16 }} />} onClick={() => setClaims(true)} sx={{ fontSize: "0.6rem", py: 0.3 }}>My claims ({myClaims(data, code).filter((x) => x.status === "Pending").length} pending)</Button>}
        {r.claimable * 60 >= 5 && <Typography sx={{ fontSize: 11, color: tokens.secondaryText }}>{fmtHrs(r.claimable)} unclaimed in this range</Typography>}
      </Stack>
      {change != null && (
        <Stack direction="row" spacing={0.4} sx={{ alignItems: "center", px: 2.2, pt: 0.8 }}>
          {change >= 0 ? <NorthEastRounded sx={{ fontSize: 13, color: tokens.success }} /> : <SouthEastRounded sx={{ fontSize: 13, color: tokens.danger }} />}
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: change >= 0 ? tokens.success : tokens.danger }}>{Math.abs(change).toFixed(1)}%</Typography>
          <Typography sx={{ fontSize: 11, color: tokens.secondaryText }}>worked vs the previous {len === 1 ? "day" : `${len} days`} ({fmtHrs(prev.worked)})</Typography>
        </Stack>
      )}
      <Box sx={{ px: 2, pt: 1.5, pb: 1.2 }}>
        <Stack direction="row" spacing={bars.length > 14 ? 0.3 : 1} sx={{ alignItems: "flex-end", height: 96 }}>
          {bars.map((b) => (
            <Tooltip key={b.key} title={`${b.tip} · worked ${fmtHrs(b.worked)} · screen off ${fmtHrs(b.off)} · total ${fmtHrs(b.worked + b.off)}`}>
              <Stack sx={{ flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center", minWidth: 0 }}>
                <Box sx={{ width: "100%", maxWidth: 18, height: `${((b.off) / max) * 100}%`, background: C.off, borderRadius: "3px 3px 0 0", opacity: 0.8 }} />
                <Box sx={{ width: "100%", maxWidth: 18, height: `${(b.worked / max) * 100}%`, minHeight: b.worked ? 2 : 0, background: b.weekend ? tokens.primarySoft : C.worked, borderRadius: b.off ? 0 : "3px 3px 0 0" }} />
              </Stack>
            </Tooltip>
          ))}
        </Stack>
        <Stack direction="row" spacing={bars.length > 14 ? 0.3 : 1} sx={{ mt: 0.4 }}>
          {bars.map((b, i) => <Typography key={b.key} sx={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 10, color: tokens.secondaryText, overflow: "hidden" }}>{bars.length > 16 && i % 3 ? "" : b.label}</Typography>)}
        </Stack>
        {r.present === 0 && <Typography sx={{ fontSize: 11, color: tokens.secondaryText, textAlign: "center", mt: 1 }}>No punches in this range.</Typography>}
      </Box>
      {claim && <ClaimDialog days={r.days} onClose={() => setClaim(false)} onDone={() => { setClaim(false); setClaims(true); }} />}
      {claims && <ClaimsDialog onClose={() => setClaims(false)} />}
      <Popover open={!!anchorEl} anchorEl={anchorEl} onClose={() => setAnchorEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <RangeCalendar from={from} to={to} onPick={(a, b, done) => { setPreset("custom"); setRange([a, b]); if (done) setAnchorEl(null); }} />
      </Popover>
    </Panel>
  );
}

// ── Screen-off claims: the employee says the screen was off while they were working; the manager approves; the time
// then counts as worked hours (lib/hrcalc.js → hoursInRange). ──
const myClaims = (data, code) => (data.requests || []).filter((x) => x.type === "screenoff" && x.employee_code === code).sort((a, b) => b.created_at.localeCompare(a.created_at));
const STATUS_TONE = { Pending: "warning", Approved: "success", Rejected: "error", Cancelled: "default" };

function ClaimDialog({ days, onClose, onDone }) {
  const { data, user, createRequest, nameOf, notifyToast } = useStore();
  const code = user.employee_code;
  const me = data.employees.find((e) => e.employee_code === code);
  const win = Number(data.settings.regularize_window_days) || 30;
  // Days with unclaimed screen-off time: the selected range first, then the rest of the claim window.
  const options = useMemo(() => {
    const today = iso(new Date());
    const all = hoursInRange(data, code, addDays(today, -win), today).days.filter((d) => d.claimable * 60 >= 5).reverse();
    const inSel = new Set(days.map((d) => d.date));
    return [...all.filter((d) => inSel.has(d.date)), ...all.filter((d) => !inSel.has(d.date))];
  }, [data, code, days, win]);
  const first = options[0];
  const [f, setF] = useState(() => ({ date: first?.date || "", hours: first ? String(Math.floor(first.claimable)) : "0", mins: first ? String(Math.floor((first.claimable * 60) % 60)) : "0", from_time: "", to_time: "", reason_code: "", reason: "" }));
  const [errors, setErrors] = useState({});
  const day = options.find((d) => d.date === f.date);
  const minutes = (Number(f.hours) || 0) * 60 + (Number(f.mins) || 0);
  const approver = me?.reporting_manager ? nameOf(me.reporting_manager) : "HR (no reporting manager)";
  const pickDay = (date) => { const d = options.find((x) => x.date === date); setF({ ...f, date, hours: String(Math.floor(d.claimable)), mins: String(Math.floor((d.claimable * 60) % 60)) }); };
  const submit = () => {
    if (f.from_time && f.to_time && f.to_time <= f.from_time) return setErrors({ to_time: "Must be after the start time." });
    const res = createRequest("screenoff", { date: f.date, minutes, from_time: f.from_time, to_time: f.to_time, reason_code: f.reason_code, reason: f.reason });
    if (!res.ok) { setErrors(res.errors || {}); return notifyToast(Object.values(res.errors || {})[0] || "Check the form.", "error"); }
    notifyToast(`Claim ${res.id} for ${fmtMins(minutes)} sent to ${approver}.`);
    onDone();
  };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Claim screen-off time as worked</DialogTitle>
      <DialogContent>
        <Stack spacing={1.8} sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: 13, color: tokens.secondaryText }}>If you were working while your screen was off or locked — a meeting, a call, field work, offline work or a system problem — ask your manager to count it. Once <b>{approver}</b> approves, the time moves from screen-off into your worked hours.</Typography>
          {options.length === 0 ? (
            <Alert severity="info" sx={{ fontSize: "0.66rem" }}>There is no unclaimed screen-off time in the last {win} days.</Alert>
          ) : (
            <>
              <FormControl size="small" error={!!errors.date}>
                <InputLabel>Day</InputLabel>
                <Select label="Day" value={f.date} onChange={(e) => pickDay(e.target.value)}>
                  {options.map((d) => <MenuItem key={d.date} value={d.date}>{nice(d.date, { weekday: "short", day: "2-digit", month: "short" })} · {fmtHrs(d.claimable)} unclaimed of {fmtHrs(d.rawScreenOff)} screen-off{d.inT ? ` · ${d.inT}–${d.outT || "now"}` : ""}</MenuItem>)}
                </Select>
                <FormHelperText>{errors.date || (day ? `Worked ${fmtHrs(day.worked)} · screen off ${fmtHrs(day.screenOff)}${day.claimPending ? ` · ${fmtHrs(day.claimPending)} already waiting for approval` : ""}` : " ")}</FormHelperText>
              </FormControl>
              <Stack direction="row" spacing={1.5}>
                <TextField size="small" label="Hrs" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value.replace(/\D/g, "").slice(0, 2) })} sx={{ width: 90, flexShrink: 0 }} error={!!errors.minutes} />
                <TextField size="small" label="Min" value={f.mins} onChange={(e) => setF({ ...f, mins: e.target.value.replace(/\D/g, "").slice(0, 2) })} sx={{ width: 90, flexShrink: 0 }} error={!!errors.minutes} />
                <TextField size="small" type="time" label="From (optional)" value={f.from_time} onChange={(e) => setF({ ...f, from_time: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField size="small" type="time" label="To (optional)" value={f.to_time} onChange={(e) => setF({ ...f, to_time: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} error={!!errors.to_time} helperText={errors.to_time} />
              </Stack>
              {errors.minutes && <Typography sx={{ fontSize: "0.6rem", color: "error.main", mt: -1 }}>{errors.minutes}</Typography>}
              <FormControl size="small" error={!!errors.reason_code}>
                <InputLabel>Reason</InputLabel>
                <Select label="Reason" value={f.reason_code} onChange={(e) => setF({ ...f, reason_code: e.target.value })}>{SCREENOFF_REASONS.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}</Select>
                {errors.reason_code && <FormHelperText>{errors.reason_code}</FormHelperText>}
              </FormControl>
              <TextField size="small" multiline minRows={3} label="What were you working on?" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} error={!!errors.reason} helperText={errors.reason || "e.g. Sprint planning in the conference room with the payments team, 11:00–12:30"} />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!options.length || minutes < 5} onClick={submit}>Send {minutes >= 5 ? fmtMins(minutes) : ""} for approval</Button>
      </DialogActions>
    </Dialog>
  );
}

function ClaimsDialog({ onClose }) {
  const { data, user, nameOf, cancelRequest, notifyToast } = useStore();
  const list = myClaims(data, user.employee_code);
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>My screen-off claims</DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableHead><TableRow><TableCell>Request</TableCell><TableCell>Day</TableCell><TableCell align="right">Claimed</TableCell><TableCell>Reason</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {list.map((x) => {
              const step = x.status === "Pending" ? x.steps.find((s) => s.status === "pending") : x.steps.filter((s) => s.at).slice(-1)[0];
              return (
                <TableRow key={x.request_id}>
                  <TableCell sx={{  fontSize: "0.62rem" }}>{x.request_id}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{nice(x.date, { weekday: "short", day: "2-digit", month: "short" })}{x.from_time ? ` · ${x.from_time}–${x.to_time}` : ""}</TableCell>
                  <TableCell align="right">{fmtMins(x.minutes)}</TableCell>
                  <TableCell sx={{ fontSize: 13, maxWidth: 220 }}>{(SCREENOFF_REASONS.find((r) => r[0] === x.reason_code) || [])[1]}<Typography sx={{ fontSize: 11, color: tokens.secondaryText }}>{x.reason}</Typography></TableCell>
                  <TableCell><Chip size="small" color={STATUS_TONE[x.status] || "default"} label={x.status === "Pending" ? `With ${nameOf(step?.approver)}` : x.status === "Approved" ? "Approved · added to worked" : x.status} sx={{ height: 20, fontSize: "0.56rem" }} />{x.status === "Rejected" && step?.note && <Typography sx={{ fontSize: "0.56rem", color: "error.main", mt: 0.3 }}>{step.note}</Typography>}</TableCell>
                  <TableCell align="right">{x.status === "Pending" && <Button size="small" color="error" onClick={() => { const res = cancelRequest(x.request_id); notifyToast(res?.ok === false ? res.error : "Claim withdrawn.", res?.ok === false ? "error" : "success"); }}>Withdraw</Button>}</TableCell>
                </TableRow>
              );
            })}
            {list.length === 0 && <TableRow><TableCell colSpan={6}>No claims yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}
