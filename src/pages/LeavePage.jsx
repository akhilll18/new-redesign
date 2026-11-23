// Employee leave (Keka-style): pending requests, request leave, stats, balances, holidays, history.
import React, { useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, InputLabel, LinearProgress, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { AddRounded, CelebrationRounded, AttachFileRounded } from "@mui/icons-material";
import { useStore } from "../store/AppStore.jsx";
import { PageHeader, SectionCard, Grid, Mono, TableWrap, EmptyState, Tag, FlagList, KeyVal } from "../components/kit/UI.jsx";
import { RequestDrawer, RequestStatus } from "../components/kit/Requests.jsx";
import { validateLeave, leaveDays } from "../lib/requests.js";
import { fmtDate, isoDate, readFileAsDataUrl, monthLabel } from "../lib/utils.js";
import { holidaysFor, leaveTypesFor, packFor } from "../country/countryPacks.js";
import { isZeroLeaveWorker } from "../lib/statutory.js";
import { LeaveRulesBox, LopNotice, WhatsAppLeaveCard } from "./v106/SelfService.jsx";
import { WORKER_TYPE_BY, workerTypeOf } from "../data/employeeFields.js";

const blank = { leave_type: "CL", from_date: "", to_date: "", half_day: "none", reason: "", contact: "", attachment: null };

export function LeaveRequestDialog({ open, onClose, preset }) {
  const { data, user, createRequest, notifyToast, leaveBalanceOf } = useStore();
  const [form, setForm] = useState(blank);
  const [tried, setTried] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => {
    if (open) {
      // Default to the first working day at least a week out.
      let t = Date.now() + 7 * 86400000;
      const hol = new Set(holidaysFor(data, user).map((h) => h.date));
      while ([0, 6].includes(new Date(t).getDay()) || hol.has(isoDate(t))) t += 86400000;
      const d = isoDate(t);
      setForm({ ...blank, from_date: d, to_date: d, ...(preset || {}) });
      setTried(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const ctx = { emp: user, leaveTypes: leaveTypesFor(data, user), holidays: holidaysFor(data, user), requests: data.requests };
  const { errors, flags, days } = validateLeave(form, ctx);
  const balances = leaveBalanceOf(user.employee_code);
  // v10.4: intern, contract and freelance workers request leave with a zero balance (no balances shown).
  const requestOnly = isZeroLeaveWorker(data.employees.find((e) => e.employee_code === user.employee_code), data.settings);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const show = (k) => tried && errors[k];

  function submit() {
    setTried(true);
    if (Object.keys(errors).length) return;
    const r = createRequest("leave", form);
    if (!r.ok) return notifyToast(Object.values(r.errors)[0], "error");
    notifyToast(`Leave ${r.id} sent to ${user.reporting_manager ? "your manager" : "HR"} for approval.`);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Request leave</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl size="small" fullWidth error={!!show("leave_type")}>
            <InputLabel>Leave type *</InputLabel>
            <Select label="Leave type *" value={form.leave_type} onChange={(e) => set("leave_type", e.target.value)}>
              {balances.map((b) => (
                <MenuItem key={b.code} value={b.code}>
                  {requestOnly ? b.name : `${b.name} · ${b.available == null ? "unpaid" : `${b.available} left`}`}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{show("leave_type") || `Notice needed: ${leaveTypesFor(data, user).find((t) => t.code === form.leave_type)?.min_notice_days ?? 0} day(s)`}</FormHelperText>
          </FormControl>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="From *" type="date" value={form.from_date} onChange={(e) => setForm((f) => ({ ...f, from_date: e.target.value, to_date: f.to_date < e.target.value ? e.target.value : f.to_date }))} error={!!show("from_date")} helperText={show("from_date") || " "} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="To *" type="date" value={form.to_date} onChange={(e) => set("to_date", e.target.value)} error={!!show("to_date")} helperText={show("to_date") || " "} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: form.from_date } }} />
          </Stack>
          <Box>
            <Typography sx={{ fontSize: "0.6rem", color: "#78827b", mb: 0.5 }}>Half day (single day only)</Typography>
            <ToggleButtonGroup exclusive size="small" value={form.half_day} onChange={(_, v) => v && set("half_day", v)}>
              <ToggleButton value="none" sx={{ fontSize: "0.62rem" }}>Full day</ToggleButton>
              <ToggleButton value="first" sx={{ fontSize: "0.62rem" }}>First half</ToggleButton>
              <ToggleButton value="second" sx={{ fontSize: "0.62rem" }}>Second half</ToggleButton>
            </ToggleButtonGroup>
            {show("half_day") && <FormHelperText error>{errors.half_day}</FormHelperText>}
          </Box>
          <Alert severity={days ? "info" : "warning"}>
            {days ? `${days} working day(s), excluding weekends and company holidays.` : "Pick dates that include at least one working day."}
          </Alert>
          <TextField label="Reason *" multiline minRows={2} value={form.reason} onChange={(e) => set("reason", e.target.value)} error={!!show("reason")} helperText={show("reason") || `${form.reason.length}/300 · your manager sees this`} slotProps={{ htmlInput: { maxLength: 300 } }} />
          <TextField label="Contact while away" value={form.contact} onChange={(e) => set("contact", e.target.value)} helperText="Optional phone number" />
          <Box>
            <Button size="small" variant="outlined" startIcon={<AttachFileRounded />} onClick={() => fileRef.current?.click()}>
              {form.attachment ? form.attachment.name : "Attach document (medical certificate)"}
            </Button>
            <input ref={fileRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > data.settings.max_file_mb * 1048576) return notifyToast(`Files must be under ${data.settings.max_file_mb} MB.`, "error"); set("attachment", { name: f.name, size: f.size, type: f.type, data_url: await readFileAsDataUrl(f) }); }} />
            {show("attachment") && <FormHelperText error>{errors.attachment}</FormHelperText>}
          </Box>
          <FlagList flags={flags} dense />
          <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>Approval: {user.reporting_manager ? "your reporting manager, then HR" : "HR"} ({data.settings.workflow.leave === "manager" ? "manager only" : "two steps"}).</Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit}>Send request</Button>
      </DialogActions>
    </Dialog>
  );
}

function MiniBars({ data, max }) {
  return (
    <Stack direction="row" spacing={0.6} sx={{ alignItems: "flex-end", height: 90, borderBottom: "1px solid #e5eae4" }}>
      {data.map((d) => (
        <Stack key={d.label} sx={{ flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
          <Box title={`${d.label}: ${d.value}`} sx={{ width: "70%", maxWidth: 18, height: `${(d.value / Math.max(1, max)) * 100}%`, minHeight: d.value ? 3 : 1, background: d.value ? "#244d3d" : "#e6ece5", borderRadius: "3px 3px 0 0" }} />
        </Stack>
      ))}
    </Stack>
  );
}

export default function LeavePage() {
  const { data, user, leaveBalanceOf, leaveTypeBy, nameOf } = useStore();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get("new") === "1");
  const [policy, setPolicy] = useState(false);
  const mine = data.requests.filter((r) => r.type === "leave" && r.employee_code === user.employee_code);
  const pendingList = mine.filter((r) => r.status === "Pending");
  const balances = leaveBalanceOf(user.employee_code);
  const approved = mine.filter((r) => r.status === "Approved");
  const year = new Date().getFullYear();

  const stats = useMemo(() => {
    const wk = [0, 0, 0, 0, 0, 0, 0];
    const months = Array(12).fill(0);
    approved.forEach((r) => {
      for (let d = new Date(`${r.from_date}T12:00:00`); d <= new Date(`${r.to_date}T12:00:00`); d = new Date(d.getTime() + 86400000)) {
        if (d.getDay() % 6 === 0) continue;
        wk[(d.getDay() + 6) % 7] += r.half_day !== "none" ? 0.5 : 1;
        if (d.getFullYear() === year) months[d.getMonth()] += r.half_day !== "none" ? 0.5 : 1;
      }
    });
    return { wk, months };
  }, [approved, year]);
  const upcomingHolidays = holidaysFor(data, user).filter((h) => h.date >= isoDate()).slice(0, 5);
  const meRec = data.employees.find((e) => e.employee_code === user.employee_code);

  // v10.4: intern, contract and freelance workers keep only "Request leave" — zero balance, no stats, accruals or policy tables.
  if (isZeroLeaveWorker(meRec, data.settings)) {
    const all = [...mine].sort((a, b) => b.created_at?.localeCompare?.(a.created_at) || 0);
    return (
      <>
        <PageHeader eyebrow={`ME · REQUEST LEAVE · ${(WORKER_TYPE_BY[workerTypeOf(meRec)]?.short || "").toUpperCase()}`} title="Request leave" subtitle={`Ask for time off. Requests go to ${user.reporting_manager ? nameOf(user.reporting_manager) : "HR"} for approval. Approved days follow your contract terms.`} actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setOpen(true)}>Request leave</Button>} />
        <Stack spacing={2}>
          <LeaveRulesBox />
          <Alert severity="info" sx={{ fontSize: "0.68rem" }}>As {/^[aeiou]/i.test(WORKER_TYPE_BY[workerTypeOf(meRec)]?.label || "") ? "an" : "a"} {WORKER_TYPE_BY[workerTypeOf(meRec)]?.label.toLowerCase()} your paid leave balance is <b>0 days</b> on every leave type. You can still raise a leave request — your manager and HR decide how the days are treated under your terms.</Alert>
          <SectionCard title="Request-level options" subtitle="Pick what you need; each opens a request to your manager">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.2 }}>
              {[
                ["Planned time off", "Days off you know about in advance", { leave_type: (leaveTypeBy.LOP ? "LOP" : leaveTypeBy.CL ? "CL" : Object.keys(leaveTypeBy)[0]) }],
                ["Sick / medical", "Unwell today or recently (up to 7 days back)", { leave_type: leaveTypeBy.SL ? "SL" : (leaveTypeBy.LOP ? "LOP" : Object.keys(leaveTypeBy)[0]), from_date: isoDate(), to_date: isoDate() }],
                ["Half day", "Morning or afternoon off", { leave_type: (leaveTypeBy.LOP ? "LOP" : Object.keys(leaveTypeBy)[0]), half_day: "first" }],
                ["Unpaid leave", "Time away without pay", { leave_type: leaveTypeBy.LOP ? "LOP" : Object.keys(leaveTypeBy)[0] }],
              ].map(([t, sub, preset]) => (
                <Box key={t} role="button" onClick={() => setOpen(preset)} sx={{ p: 1.5, border: "1px solid #e3e9e5", borderRadius: 1.5, cursor: "pointer", "&:hover": { borderColor: "#0B8C8C", background: "#f3faf8" } }}>
                  <Typography sx={{ fontSize: "0.74rem", fontWeight: 700 }}>{t}</Typography>
                  <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{sub}</Typography>
                  <Typography sx={{ fontSize: "0.58rem", color: "#0B8C8C", fontWeight: 700, mt: 0.6 }}>Balance 0 · Request</Typography>
                </Box>
              ))}
            </Box>
          </SectionCard>
          <SectionCard title="My leave requests" noPad>
            {all.length === 0 ? (
              <Box sx={{ p: 2.5 }}><EmptyState title="No leave requests yet" text="Use Request leave to ask for time off." action={<Button variant="contained" onClick={() => setOpen(true)}>Request leave</Button>} /></Box>
            ) : all.map((r) => (
              <Stack key={r.request_id} direction="row" spacing={1.5} onClick={() => setParams({ req: r.request_id })} sx={{ px: 2, py: 1.4, borderBottom: "1px solid #f0f2ef", alignItems: "center", cursor: "pointer", "&:hover": { background: "#f7faf7" } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{leaveTypeBy[r.leave_type]?.name} · {r.days} day(s)</Typography>
                  <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{fmtDate(r.from_date)}{r.to_date !== r.from_date ? ` – ${fmtDate(r.to_date)}` : ""} · <Mono>{r.request_id}</Mono></Typography>
                </Box>
                <RequestStatus r={r} />
              </Stack>
            ))}
          </SectionCard>
        </Stack>
        <LeaveRequestDialog open={!!open} preset={typeof open === "object" ? open : null} onClose={() => { setOpen(false); if (params.get("new")) setParams({}); }} />
        <RequestDrawer id={params.get("req")} onClose={() => setParams({})} />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="ME · LEAVE" title="Leave" subtitle={`Leave year Jan ${year} – Dec ${year}. Requests go to ${user.reporting_manager ? nameOf(user.reporting_manager) : "HR"} first.`} actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setOpen(true)}>Request leave</Button>} />
      <LopNotice balances={balances} />
      <WhatsAppLeaveCard />
      <Stack spacing={2.5}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 280px" }, gap: 2 }}>
          <SectionCard title="Pending leave requests" noPad>
            {pendingList.length === 0 ? (
              <Stack direction="row" spacing={1.5} sx={{ p: 2.5, alignItems: "center" }}>
                <Box sx={{ width: 40, height: 40, borderRadius: "50%", background: "#f1eefb", color: "#7b5fc7", display: "grid", placeItems: "center" }}><CelebrationRounded /></Box>
                <Box>
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 700 }}>Hurray! No pending leave requests</Typography>
                  <Typography sx={{ fontSize: "0.62rem", color: "#78827b" }}>Request leave on the right.</Typography>
                </Box>
              </Stack>
            ) : (
              pendingList.map((r) => (
                <Stack key={r.request_id} direction="row" spacing={1.5} onClick={() => setParams({ req: r.request_id })} sx={{ px: 2, py: 1.4, borderBottom: "1px solid #f0f2ef", alignItems: "center", cursor: "pointer", "&:hover": { background: "#f7faf7" } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{leaveTypeBy[r.leave_type]?.name} · {r.days} day(s)</Typography>
                    <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{fmtDate(r.from_date)}{r.to_date !== r.from_date ? ` – ${fmtDate(r.to_date)}` : ""} · <Mono>{r.request_id}</Mono></Typography>
                  </Box>
                  <RequestStatus r={r} />
                </Stack>
              ))
            )}
          </SectionCard>
          <SectionCard>
            <Stack spacing={1.2} sx={{ alignItems: "center", py: 1 }}>
              <Button variant="contained" fullWidth onClick={() => setOpen(true)}>Request leave</Button>
              <Button size="small" onClick={() => setPolicy(true)}>Leave policy explanation</Button>
            </Stack>
          </SectionCard>
        </Box>

        <Typography variant="h2">My leave stats</Typography>
        <Grid min={240}>
          <SectionCard title="Weekly pattern" subtitle="Approved days by weekday">
            <MiniBars data={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((l, i) => ({ label: l, value: stats.wk[i] }))} max={Math.max(...stats.wk)} />
            <Stack direction="row" spacing={0.6} sx={{ mt: 0.5 }}>{["M", "T", "W", "T", "F", "S", "S"].map((l, i) => <Typography key={i} sx={{ flex: 1, textAlign: "center", fontSize: "0.55rem", color: "#8a948d" }}>{l}</Typography>)}</Stack>
          </SectionCard>
          <SectionCard title="Consumed leave types">
            {balances.filter((b) => b.taken).length === 0 ? <Typography sx={{ fontSize: "0.65rem", color: "#78827b" }}>No data to display.</Typography> : balances.filter((b) => b.taken).map((b) => (
              <Box key={b.code} sx={{ mb: 1 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontSize: "0.65rem" }}>{b.name}</Typography><Typography sx={{ fontSize: "0.65rem", fontWeight: 700 }}>{b.taken}</Typography></Stack>
                <LinearProgress variant="determinate" value={b.entitled ? (b.taken / b.entitled) * 100 : 100} sx={{ height: 6, borderRadius: 3 }} />
              </Box>
            ))}
          </SectionCard>
          <SectionCard title="Monthly stats" subtitle={String(year)}>
            <MiniBars data={stats.months.map((v, i) => ({ label: monthLabel(`${year}-${String(i + 1).padStart(2, "0")}`), value: v }))} max={Math.max(...stats.months)} />
            <Stack direction="row" spacing={0.6} sx={{ mt: 0.5 }}>{"JFMAMJJASOND".split("").map((l, i) => <Typography key={i} sx={{ flex: 1, textAlign: "center", fontSize: "0.55rem", color: "#8a948d" }}>{l}</Typography>)}</Stack>
          </SectionCard>
        </Grid>

        <Typography variant="h2">Leave balances</Typography>
        <Grid min={200}>
          {balances.map((b) => (
            <SectionCard key={b.code}>
              <Stack spacing={1}>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{b.name}</Typography>
                  <Button size="small" sx={{ fontSize: "0.58rem", minWidth: 0, p: 0 }} onClick={() => setOpen({ leave_type: b.code })}>Apply</Button>
                </Stack>
                <Typography variant="h4">{b.available == null ? "∞" : b.available}<Typography component="span" sx={{ fontSize: "0.65rem", color: "#78827b", ml: 0.5 }}>{b.available == null ? "unpaid" : `of ${b.entitled} days`}</Typography></Typography>
                {b.entitled != null && <LinearProgress variant="determinate" value={b.entitled ? ((b.taken + b.pending) / b.entitled) * 100 : 0} sx={{ height: 6, borderRadius: 3 }} />}
                <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>Taken {b.taken} · Pending {b.pending}{b.carry_forward ? ` · carry forward up to ${b.carry_forward}` : ""}</Typography>
              </Stack>
            </SectionCard>
          ))}
        </Grid>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2 }}>
          <SectionCard title="Leave history" noPad>
            {mine.length === 0 ? <EmptyState title="No leave yet" /> : (
              <TableWrap>
                <Table size="small" sx={{ minWidth: 620 }}>
                  <TableHead><TableRow><TableCell>Request</TableCell><TableCell>Type</TableCell><TableCell>Dates</TableCell><TableCell align="right">Days</TableCell><TableCell>Applied</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                  <TableBody>
                    {mine.map((r) => (
                      <TableRow key={r.request_id} hover sx={{ cursor: "pointer" }} onClick={() => setParams({ req: r.request_id })}>
                        <TableCell><Mono>{r.request_id}</Mono></TableCell>
                        <TableCell>{leaveTypeBy[r.leave_type]?.name}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(r.from_date)}{r.to_date !== r.from_date ? ` – ${fmtDate(r.to_date)}` : ""}</TableCell>
                        <TableCell align="right">{r.days}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</TableCell>
                        <TableCell><RequestStatus r={r} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </SectionCard>
          <SectionCard title="Upcoming holidays" noPad>
            {upcomingHolidays.map((h) => (
              <Stack key={h.date} direction="row" spacing={1.5} sx={{ px: 2, py: 1.2, borderBottom: "1px solid #f0f2ef", alignItems: "center" }}>
                <Box sx={{ width: 40, textAlign: "center" }}>
                  <Typography sx={{ fontSize: "0.95rem", fontWeight: 800,  lineHeight: 1 }}>{h.date.slice(8)}</Typography>
                  <Typography sx={{ fontSize: "0.55rem", color: "#78827b" }}>{monthLabel(h.date.slice(0, 7))}</Typography>
                </Box>
                <Typography sx={{ flex: 1, fontSize: "0.7rem", fontWeight: 600 }}>{h.name}</Typography>
                {h.type === "floater" && <Tag tone="accent">Floater leave</Tag>}
              </Stack>
            ))}
          </SectionCard>
        </Box>
      </Stack>

      <LeaveRequestDialog open={!!open} preset={typeof open === "object" ? open : null} onClose={() => { setOpen(false); if (params.get("new")) setParams({}); }} />
      <RequestDrawer id={params.get("req")} onClose={() => setParams({})} />
      <Dialog open={policy} onClose={() => setPolicy(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Leave policy · {user.leave_policy === "intern" ? "Intern" : `Standard ${packFor(user.country_code || "IN")?.name || "India"}`}</DialogTitle>
        <DialogContent>
          <TableWrap>
            <Table size="small">
              <TableHead><TableRow><TableCell>Type</TableCell><TableCell align="right">Per year</TableCell><TableCell align="right">Notice</TableCell><TableCell>Rules</TableCell></TableRow></TableHead>
              <TableBody>
                {leaveTypesFor(data, user).map((t) => (
                  <TableRow key={t.code}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell align="right">{t.annual ?? "—"}</TableCell>
                    <TableCell align="right">{t.min_notice_days} d</TableCell>
                    <TableCell sx={{ fontSize: "0.6rem" }}>{[t.carry_forward ? `Carry forward up to ${t.carry_forward}` : "", t.doc_after_days ? `Certificate after ${t.doc_after_days} days` : "", t.floater_only ? "Only on floater holidays" : "", t.annual == null ? "Unpaid; deducted from salary" : ""].filter(Boolean).join(" · ") || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
          <KeyVal items={[["Pro-rating", "Joiners this year get entitlement for the months remaining."], ["Approval", data.settings.workflow.leave === "manager" ? "Reporting manager" : "Reporting manager, then HR"]]} />
        </DialogContent>
        <DialogActions><Button onClick={() => setPolicy(false)}>Close</Button></DialogActions>
      </Dialog>
    </>
  );
}


