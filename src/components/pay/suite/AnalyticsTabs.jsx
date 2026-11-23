// Payroll analytics (Keka-style): Analytics dashboard, Compensation planning, Budget estimation,
// Compare compensation cost, Employee competitiveness and Geographical differentials.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Chip, FormControl, InputLabel, LinearProgress, Link, MenuItem, Select, Stack, Switch, FormControlLabel, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AddRounded, DownloadRounded, TaskAltRounded } from "@mui/icons-material";
import { useStore } from "../../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap, BarChart, HBar, ConfirmDialog } from "../../kit/UI.jsx";
import { weightedScore } from "../../../lib/hrcalc.js";
import { isoDate, fmtDate, downloadCsv } from "../../../lib/utils.js";
import {
  ALL_GROUPS, groupEmployees, payFor, monthTotals, fyCostByEmployee, sumBy, revisionBuckets, fyOf, fyOptions, fyLabel, fyMonths, monthOf, addMonths, monthName,
  fmtMoney, compactInr, toInr, curOf, ctryOf, grossInr, competitiveness, bandFor, cityIndex, ratingBand, RATING_LABEL, onPayrollIn,
} from "../../../lib/payrollSuite.js";
import { COUNTRIES } from "../../../lib/payroll/index.js";
import { Donut, ListDialog, Note, SERIES, usePayGroupState, canRunPayroll, ReadOnlyHint } from "./shared.jsx";

const inrCost = (e, month, revisions, fx) => { const p = payFor(e, month, revisions); return toInr(p.cost, curOf(ctryOf(e)), fx); };

// ── Analytics dashboard ────────────────────────────────
export function AnalyticsHome({ employees }) {
  const { data, user, applyRevisions, proposeRevision, notifyToast } = useStore();
  const { group, picker, currency, inInr } = usePayGroupState(employees);
  const emps = groupEmployees(employees, group);
  const codes = new Set(emps.map((e) => e.employee_code));
  const revisions = data.salaryRevisions || [];
  const today = isoDate();
  const thisMonth = monthOf(today);
  const lastMonth = addMonths(thisMonth, -1);
  const fx = data.fx;
  const money = (v) => fmtMoney(v, currency);
  const [fy, setFy] = useState(fyOf(today));
  const [dlg, setDlg] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const editable = canRunPayroll(user);

  const runFor = (period) => (group === ALL_GROUPS ? null : data.payrollRuns.filter((r) => r.country === group.country && r.period === period).sort((a, b) => (a.computed_at < b.computed_at ? 1 : -1))[0]);
  const lockedRuns = group === ALL_GROUPS ? [] : data.payrollRuns.filter((r) => r.country === group.country && r.status === "Locked").sort((a, b) => (a.period < b.period ? 1 : -1));
  const lastRun = lockedRuns[0];
  const lastProcessed = lastRun ? { month: lastRun.period, amount: lastRun.net, actual: true } : { month: lastMonth, amount: monthTotals(emps, lastMonth, revisions, fx, inInr).net, actual: false };
  const upMonth = runFor(thisMonth)?.status === "Locked" ? addMonths(thisMonth, 1) : thisMonth;
  const upcoming = monthTotals(emps, upMonth, revisions, fx, inInr);
  const buckets = revisionBuckets(revisions.filter((r) => codes.has(r.employee_code)), today);

  const fyRows = useMemo(() => fyCostByEmployee(emps, fy, revisions, fx), [emps.length, fy, revisions, group]); // eslint-disable-line react-hooks/exhaustive-deps
  const conv = (v) => (inInr ? v : v / ((fx && fx[currency]) || 1)); // fyCostByEmployee is INR; show in group currency
  const byDept = sumBy(fyRows, (r) => r.e.department || "Unassigned", (r) => conv(r.cost));
  const byLoc = sumBy(fyRows, (r) => r.e.city || "Not set", (r) => conv(r.cost));
  const trend = fyMonths(fy).map((m) => {
    const t = monthTotals(emps, m, revisions, fx, inInr);
    const past = m < thisMonth;
    return { label: monthName(m).split(" ")[0], actual: past ? t.cost : 0, projected: past ? 0 : t.cost, m };
  });
  const fyTot = fyMonths(fy).reduce((acc, m) => { const t = monthTotals(emps, m, revisions, fx, inInr); acc.net += t.net; acc.ded += t.deductions; acc.er += t.employer; return acc; }, { net: 0, ded: 0, er: 0 });
  const nameOf = (c) => data.employees.find((e) => e.employee_code === c);
  const revCols = [
    ["Employee", (r) => <PersonCell name={nameOf(r.employee_code)?.full_name || r.employee_code} sub={`${r.employee_code} · ${nameOf(r.employee_code)?.designation || ""}`} />],
    ["Reason", (r) => r.reason],
    ["Effective", (r) => fmtDate(r.effective)],
    ["Current gross", (r) => fmtMoney(r.old_gross, curOf(ctryOf(nameOf(r.employee_code) || {}))), "right"],
    ["New gross", (r) => fmtMoney(r.new_gross, curOf(ctryOf(nameOf(r.employee_code) || {}))), "right"],
    ["Change", (r) => <Tag tone="good">+{r.pct}%</Tag>, "right"],
  ];

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }} spacing={1}>
        {picker}
        {editable && <Button size="small" variant="outlined" startIcon={<AddRounded />} onClick={() => setAddOpen(true)}>Add salary revision</Button>}
      </Stack>
      <Grid min={200}>
        <StatCard label={`Last salary processed · ${monthName(lastProcessed.month, "long").toUpperCase()}`} value={money(lastProcessed.amount)} hint={lastProcessed.actual ? "Net pay of the locked run" : "Net pay computed by the engine (no locked run)"} tone="accent" />
        <StatCard label={`Upcoming salary · ${monthName(upMonth, "long").toUpperCase()}`} value={money(upcoming.net)} hint={`${upcoming.headcount} employees · includes approved revisions`} tone="info" />
        <StatCard label="Upcoming revisions · 3 months" value={buckets.upcoming.length} hint="View employees →" tone="good" onClick={() => setDlg("upcoming")} />
        <StatCard label="Pending revisions" value={String(buckets.pending.length).padStart(2, "0")} hint="Past effective date, not yet applied · View employees →" tone={buckets.pending.length ? "warn" : "neutral"} onClick={() => setDlg("pending")} />
      </Grid>

      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h2">Compensation summary</Typography>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <Select value={fy} onChange={(e) => setFy(e.target.value)} inputProps={{ "aria-label": "Financial year" }}>
            {fyOptions(today).map((f) => <MenuItem key={f} value={f}>{fyLabel(f)}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>
      <Grid min={420}>
        <SectionCard title="Compensation distribution by department" subtitle={`Cost to company, ${fyLabel(fy)}`}><Donut data={byDept} format={(v) => (currency === "INR" ? compactInr(v) : money(v))} /></SectionCard>
        <SectionCard title="Compensation distribution by location" subtitle={`Cost to company, ${fyLabel(fy)}`}><Donut data={byLoc} format={(v) => (currency === "INR" ? compactInr(v) : money(v))} /></SectionCard>
      </Grid>
      <Grid min={420}>
        <SectionCard title="Monthly payroll cost" subtitle={`Processed months are actuals from the engine; later months are projected with approved revisions`}>
          <BarChart data={trend} series={[{ key: "actual", label: "Processed", color: SERIES[0] }, { key: "projected", label: "Projected", color: "#86b6ef" }]} format={money} />
        </SectionCard>
        <SectionCard title="Where the payroll goes" subtitle={fyLabel(fy)}>
          <Donut data={[{ label: "Net pay to employees", value: conv(fyTot.net) }, { label: "Employee deductions (tax, PF, ESI, PT…)", value: conv(fyTot.ded) }, { label: "Employer contributions", value: conv(fyTot.er) }]} format={(v) => (currency === "INR" ? compactInr(v) : money(v))} total="Total cost" />
        </SectionCard>
      </Grid>

      <ListDialog open={dlg === "upcoming"} title="Upcoming revisions" subtitle="Approved, effective within the next 3 months. They are picked up automatically in the month they take effect." columns={revCols} rows={buckets.upcoming} onClose={() => setDlg(null)} />
      <ListDialog
        open={dlg === "pending"}
        title="Pending revisions"
        subtitle="The effective date has passed but the employee master still shows the old salary. Applying updates the master and pays arrears for months already processed."
        columns={revCols}
        rows={buckets.pending}
        onClose={() => setDlg(null)}
        actions={editable && buckets.pending.length > 0 && <Button variant="contained" startIcon={<TaskAltRounded />} onClick={() => { const r = applyRevisions(buckets.pending.map((x) => x.id)); notifyToast(r.ok ? `${r.count} revision(s) applied${r.arrears ? ` · arrears ${r.arrears.toLocaleString("en-IN")}` : ""}.` : r.error, r.ok ? "success" : "error"); if (r.ok) setDlg(null); }}>Apply {buckets.pending.length} revision(s)</Button>}
      />
      <AddRevisionDialog open={addOpen} onClose={() => setAddOpen(false)} employees={emps} onSave={(f) => { const r = proposeRevision(f); notifyToast(r.ok ? `Revision ${r.id} saved.` : r.error, r.ok ? "success" : "error"); if (r.ok) setAddOpen(false); }} />
    </Stack>
  );
}

function AddRevisionDialog({ open, onClose, employees, onSave }) {
  const [f, setF] = useState({ employee_code: "", new_gross: "", effective: isoDate().slice(0, 8) + "01", reason: "" });
  const e = employees.find((x) => x.employee_code === f.employee_code);
  const pct = e && f.new_gross ? (((Number(f.new_gross) - e.monthly_gross) / e.monthly_gross) * 100).toFixed(1) : null;
  return (
    <ConfirmDialog open={open} title="Add salary revision" confirmLabel="Save revision" onClose={onClose} onConfirm={() => onSave(f)}>
      <Stack spacing={1.5}>
        <FormControl size="small" fullWidth>
          <InputLabel>Employee</InputLabel>
          <Select label="Employee" value={f.employee_code} onChange={(ev) => setF({ ...f, employee_code: ev.target.value })}>
            {employees.map((x) => <MenuItem key={x.employee_code} value={x.employee_code}>{x.full_name} · {x.employee_code}</MenuItem>)}
          </Select>
        </FormControl>
        {e && <Typography variant="caption" color="text.secondary">Current monthly gross {fmtMoney(e.monthly_gross, curOf(ctryOf(e)))}</Typography>}
        <TextField size="small" label={`New monthly gross${e ? ` (${curOf(ctryOf(e))})` : ""}`} type="number" value={f.new_gross} onChange={(ev) => setF({ ...f, new_gross: ev.target.value })} helperText={pct != null ? `${pct > 0 ? "+" : ""}${pct}%` : " "} />
        <TextField size="small" label="Effective from" type="date" value={f.effective} onChange={(ev) => setF({ ...f, effective: ev.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" label="Reason" value={f.reason} onChange={(ev) => setF({ ...f, reason: ev.target.value })} placeholder="Promotion, market correction…" />
      </Stack>
    </ConfirmDialog>
  );
}

// ── Compensation planning (increment cycle) ────────────
export function CompensationPlanning({ employees }) {
  const { data, user, saveCompCycle, finaliseCompCycle, notifyToast } = useStore();
  const c = data.compCycle;
  const fx = data.fx;
  const editable = canRunPayroll(user) && c.status !== "Finalised";
  const [cfg, setCfg] = useState({ name: c.name, effective: c.effective, budget_pct: c.budget_pct, guideline: { ...c.guideline } });
  const [prop, setProp] = useState(c.proposals || {});
  const [dept, setDept] = useState("ALL");
  const [confirm, setConfirm] = useState(false);
  const minDoj = addMonths(monthOf(cfg.effective), -(c.min_tenure_months || 6));
  const eligible = employees.filter((e) => e.status === "active" && (e.date_of_joining || "").slice(0, 7) <= minDoj);
  const rows = eligible.map((e) => {
    const score = weightedScore(data.perf?.[e.employee_code]);
    const rb = ratingBand(score);
    const comp = competitiveness(e, data.paySettings, fx);
    let guide = Number(cfg.guideline[rb]) || 0;
    if (comp.compa != null && guide > 0) guide += comp.compa < 0.9 ? 2 : comp.compa > 1.15 ? -2 : 0;
    guide = Math.max(0, guide);
    const pct = prop[e.employee_code] ?? guide;
    const g = grossInr(e, fx);
    return { e, code: e.employee_code, score, rb, comp, guide, pct: Number(pct) || 0, base: g * 12, inc: g * 12 * ((Number(pct) || 0) / 100) };
  });
  const shown = rows.filter((r) => dept === "ALL" || r.e.department === dept);
  const base = rows.reduce((s, r) => s + r.base, 0);
  const budget = base * (Number(cfg.budget_pct) / 100);
  const spent = rows.reduce((s, r) => s + r.inc, 0);
  const depts = [...new Set(rows.map((r) => r.e.department))].sort();
  const save = () => { const r = saveCompCycle({ ...cfg, budget_pct: Number(cfg.budget_pct), proposals: prop }); notifyToast(r.ok ? "Draft saved." : r.error, r.ok ? "success" : "error"); };

  return (
    <Stack spacing={2.5}>
      {c.status === "Finalised" && <Alert severity="success">This cycle was finalised on {fmtDate(c.finalised_at)}. Its revisions are in the Analytics tab under upcoming revisions.</Alert>}
      <SectionCard title="Cycle setup" subtitle="Guideline increment by performance rating, adjusted ±2 points for pay position (compa-ratio below 0.90 or above 1.15)">
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ flexWrap: "wrap" }} useFlexGap>
          <TextField size="small" label="Cycle name" value={cfg.name} disabled={!editable} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} sx={{ minWidth: 260 }} />
          <TextField size="small" label="Effective from" type="date" value={cfg.effective} disabled={!editable} onChange={(e) => setCfg({ ...cfg, effective: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" label="Budget (% of payroll)" type="number" value={cfg.budget_pct} disabled={!editable} onChange={(e) => setCfg({ ...cfg, budget_pct: e.target.value })} sx={{ width: 170 }} />
          {[5, 4, 3, 2, 1].map((k) => (
            <TextField key={k} size="small" label={`${RATING_LABEL[k]} %`} type="number" value={cfg.guideline[k]} disabled={!editable} onChange={(e) => setCfg({ ...cfg, guideline: { ...cfg.guideline, [k]: e.target.value } })} sx={{ width: 120 }} />
          ))}
        </Stack>
      </SectionCard>
      <Grid min={190}>
        <StatCard label="Eligible employees" value={rows.length} hint={`Joined on or before ${minDoj}`} />
        <StatCard label="Annual payroll base" value={compactInr(base)} tone="neutral" hint="All pay groups in ₹" />
        <StatCard label={`Budget (${cfg.budget_pct}%)`} value={compactInr(budget)} tone="info" />
        <StatCard label="Allocated" value={compactInr(spent)} hint={`${((spent / Math.max(1, base)) * 100).toFixed(2)}% of payroll`} tone={spent > budget ? "bad" : "good"} />
      </Grid>
      <Box>
        <HBar label="Budget used" value={spent} max={budget} color={spent > budget ? "error.main" : "primary.main"} right={`${((spent / Math.max(1, budget)) * 100).toFixed(0)}% · ${spent > budget ? `${compactInr(spent - budget)} over` : `${compactInr(budget - spent)} left`}`} />
      </Box>
      <SectionCard
        title="Proposed increments"
        subtitle="Edit the % for anyone; the rest follow the guideline"
        noPad
        action={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <FormControl size="small"><Select value={dept} onChange={(e) => setDept(e.target.value)} sx={{ fontSize: "0.7rem" }}><MenuItem value="ALL">All departments</MenuItem>{depts.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}</Select></FormControl>
            {editable && <Button size="small" onClick={() => setProp({})}>Reset to guideline</Button>}
            {editable && <Button size="small" variant="outlined" onClick={save}>Save draft</Button>}
            {editable && <Button size="small" variant="contained" onClick={() => setConfirm(true)}>Finalise cycle</Button>}
            {!canRunPayroll(user) && <ReadOnlyHint />}
          </Stack>
        }
      >
        <TableWrap>
          <Table size="small" sx={{ minWidth: 1040 }}>
            <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Grade</TableCell><TableCell>Rating</TableCell><TableCell align="right">Compa-ratio</TableCell><TableCell align="right">Current gross</TableCell><TableCell align="right">Guideline</TableCell><TableCell align="right">Proposed %</TableCell><TableCell align="right">New gross</TableCell><TableCell align="right">Annual increase (₹)</TableCell></TableRow></TableHead>
            <TableBody>
              {shown.map((r) => {
                const cur = curOf(ctryOf(r.e));
                return (
                  <TableRow key={r.code}>
                    <TableCell><PersonCell name={r.e.full_name} sub={`${r.code} · ${r.e.department}`} /></TableCell>
                    <TableCell>{r.e.grade_code}</TableCell>
                    <TableCell><Tag tone={r.rb >= 4 ? "good" : r.rb === "3" ? "info" : "warn"}>{r.score.toFixed(1)} · {RATING_LABEL[r.rb]}</Tag></TableCell>
                    <TableCell align="right">{r.comp.compa != null ? r.comp.compa.toFixed(2) : "—"}</TableCell>
                    <TableCell align="right">{fmtMoney(r.e.monthly_gross, cur)}</TableCell>
                    <TableCell align="right">{r.guide}%</TableCell>
                    <TableCell align="right">
                      <TextField size="small" type="number" value={r.pct} disabled={!editable} onChange={(ev) => setProp({ ...prop, [r.code]: ev.target.value === "" ? 0 : Number(ev.target.value) })} sx={{ width: 78 }} slotProps={{ htmlInput: { min: 0, max: 50, step: 0.5, "aria-label": `Increment for ${r.e.full_name}` } }} />
                    </TableCell>
                    <TableCell align="right">{fmtMoney(Math.round(r.e.monthly_gross * (1 + r.pct / 100)), cur)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{compactInr(r.inc)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <ConfirmDialog open={confirm} title="Finalise the increment cycle?" text={`This creates ${rows.filter((r) => r.pct > 0).length} approved salary revisions effective ${fmtDate(cfg.effective)} (${compactInr(spent)} a year). Employees are told when the revision is applied.`} confirmLabel="Finalise" onClose={() => setConfirm(false)} onConfirm={() => { saveCompCycle({ ...cfg, budget_pct: Number(cfg.budget_pct), proposals: prop }); const r = finaliseCompCycle(rows.map((x) => ({ code: x.code, pct: x.pct }))); notifyToast(r.ok ? `${r.count} revisions created.` : r.error, r.ok ? "success" : "error"); setConfirm(false); }} />
    </Stack>
  );
}

// ── Budget estimation ──────────────────────────────────
export function BudgetEstimation({ employees }) {
  const { data } = useStore();
  const fx = data.fx;
  const revisions = data.salaryRevisions || [];
  const today = isoDate();
  const nextFy = fyOptions(today)[2];
  const [fy, setFy] = useState(nextFy);
  const [inc, setInc] = useState(data.compCycle?.budget_pct ?? 8);
  const [incMonth, setIncMonth] = useState(4);
  const [attr, setAttr] = useState(12);
  const [backfill, setBackfill] = useState(true);
  const [premium, setPremium] = useState(10);
  const [hireMonths, setHireMonths] = useState(6);
  const [hires, setHires] = useState({});
  const active = employees.filter((e) => e.status === "active");
  const ref = monthOf(today);
  const depts = [...new Set(active.map((e) => e.department))].sort();
  const effIdx = (incMonth + 8) % 12; // April = index 0
  const monthsAfterInc = 12 - effIdx;
  const rows = depts.map((d) => {
    const list = active.filter((e) => e.department === d);
    const monthly = list.reduce((s, e) => s + inrCost(e, ref, revisions, fx), 0);
    const avg = monthly / Math.max(1, list.length);
    // Current FY actual + projected spend for comparison
    const thisFy = fyMonths(fyOf(today)).reduce((s, m) => s + list.filter((e) => onPayrollIn(e, m)).reduce((t, e) => t + inrCost(e, m, revisions, fx), 0), 0);
    const runRate = monthly * 12;
    const withInc = monthly * effIdx + monthly * (1 + inc / 100) * monthsAfterInc;
    const attrition = backfill ? 0 : withInc * (attr / 100) * 0.5;
    const n = Number(hires[d]) || 0;
    const newCost = n * avg * (1 + premium / 100) * hireMonths;
    const projected = withInc - attrition + newCost;
    return { d, hc: list.length, plannedHc: list.length + n - (backfill ? 0 : Math.round(list.length * attr / 100)), monthly, runRate, thisFy, projected, n, incCost: withInc - runRate, attrition, newCost };
  });
  const T = rows.reduce((t, r) => { ["hc", "plannedHc", "runRate", "projected", "incCost", "attrition", "newCost", "n"].forEach((k) => { t[k] = (t[k] || 0) + r[k]; }); t.thisFy = (t.thisFy || 0) + (r.thisFy || 0); return t; }, {});
  const csv = () => downloadCsv(`budget-estimate-${fy}.csv`, ["Department", "Headcount now", "New hires", "Planned headcount", "Current FY spend (INR)", "Run-rate (INR)", "Increment cost", "Attrition saving", "New hire cost", "Projected FY cost"], rows.map((r) => [r.d, r.hc, r.n, r.plannedHc, Math.round(r.thisFy || 0), Math.round(r.runRate), Math.round(r.incCost), Math.round(r.attrition), Math.round(r.newCost), Math.round(r.projected)]));

  return (
    <Stack spacing={2.5}>
      <SectionCard title="Assumptions" subtitle="Base = this month's cost to company from the payroll engine (₹, all pay groups), including approved revisions">
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 220 }}><InputLabel>Plan for</InputLabel><Select label="Plan for" value={fy} onChange={(e) => setFy(e.target.value)}>{fyOptions(today).slice(1).map((f) => <MenuItem key={f} value={f}>{fyLabel(f)}</MenuItem>)}</Select></FormControl>
          <TextField size="small" type="number" label="Increment %" value={inc} onChange={(e) => setInc(Number(e.target.value))} sx={{ width: 120 }} />
          <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Increment from</InputLabel><Select label="Increment from" value={incMonth} onChange={(e) => setIncMonth(e.target.value)}>{[4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map((m) => <MenuItem key={m} value={m}>{new Date(2026, m - 1, 1).toLocaleDateString("en-IN", { month: "long" })}</MenuItem>)}</Select></FormControl>
          <TextField size="small" type="number" label="Attrition % a year" value={attr} onChange={(e) => setAttr(Number(e.target.value))} sx={{ width: 150 }} />
          <FormControlLabel control={<Switch checked={backfill} onChange={(e) => setBackfill(e.target.checked)} />} label={<Typography variant="body2">Backfill leavers</Typography>} />
          <TextField size="small" type="number" label="New-hire premium %" value={premium} onChange={(e) => setPremium(Number(e.target.value))} sx={{ width: 160 }} />
          <TextField size="small" type="number" label="Months new hires are paid" value={hireMonths} onChange={(e) => setHireMonths(Math.max(0, Math.min(12, Number(e.target.value))))} sx={{ width: 200 }} />
        </Stack>
      </SectionCard>
      <Grid min={190}>
        <StatCard label="Current annual run-rate" value={compactInr(T.runRate)} tone="neutral" hint={`${T.hc} employees`} />
        <StatCard label={`Projected ${fyLabel(fy).replace("Financial Year ", "FY ")}`} value={compactInr(T.projected)} tone="info" hint={`${T.plannedHc} planned headcount`} />
        <StatCard label="Change" value={`${T.projected >= T.runRate ? "+" : ""}${(((T.projected - T.runRate) / Math.max(1, T.runRate)) * 100).toFixed(1)}%`} tone={T.projected > T.runRate ? "warn" : "good"} hint={compactInr(T.projected - T.runRate)} />
        <StatCard label="New hires" value={T.n} tone="accent" hint={compactInr(T.newCost)} />
      </Grid>
      <SectionCard title="By department" noPad action={<Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={csv}>CSV</Button>}>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 980 }}>
            <TableHead><TableRow><TableCell>Department</TableCell><TableCell align="right">Headcount</TableCell><TableCell align="right">New hires</TableCell><TableCell align="right">FY {fyOf(today)} spend</TableCell><TableCell align="right">Run-rate</TableCell><TableCell align="right">Increment</TableCell><TableCell align="right">Attrition</TableCell><TableCell align="right">New hires cost</TableCell><TableCell align="right">Projected</TableCell></TableRow></TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.d}>
                  <TableCell sx={{ fontWeight: 600 }}>{r.d}</TableCell>
                  <TableCell align="right">{r.hc} → {r.plannedHc}</TableCell>
                  <TableCell align="right"><TextField size="small" type="number" value={hires[r.d] ?? 0} onChange={(e) => setHires({ ...hires, [r.d]: Math.max(0, Number(e.target.value)) })} sx={{ width: 70 }} slotProps={{ htmlInput: { min: 0, "aria-label": `New hires in ${r.d}` } }} /></TableCell>
                  <TableCell align="right">{compactInr(r.thisFy)}</TableCell>
                  <TableCell align="right">{compactInr(r.runRate)}</TableCell>
                  <TableCell align="right">{compactInr(r.incCost)}</TableCell>
                  <TableCell align="right">{r.attrition ? `−${compactInr(r.attrition)}` : "—"}</TableCell>
                  <TableCell align="right">{r.newCost ? compactInr(r.newCost) : "—"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{compactInr(r.projected)}</TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ "& td": { fontWeight: 700 } }}><TableCell>Total</TableCell><TableCell align="right">{T.hc} → {T.plannedHc}</TableCell><TableCell align="right">{T.n}</TableCell><TableCell align="right">{compactInr(T.thisFy)}</TableCell><TableCell align="right">{compactInr(T.runRate)}</TableCell><TableCell align="right">{compactInr(T.incCost)}</TableCell><TableCell align="right">{T.attrition ? `−${compactInr(T.attrition)}` : "—"}</TableCell><TableCell align="right">{compactInr(T.newCost)}</TableCell><TableCell align="right">{compactInr(T.projected)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <SectionCard title="Run-rate vs projected, by department">
        <BarChart data={rows.map((r) => ({ label: r.d.split(" ")[0], run: r.runRate, proj: r.projected }))} series={[{ key: "run", label: "Run-rate", color: SERIES[0] }, { key: "proj", label: "Projected", color: SERIES[1] }]} format={compactInr} />
      </SectionCard>
      <Note>Increment applies from the chosen month to March; leavers are assumed to go mid-year; new hires join at the department average plus the premium. Statutory contributions follow each country engine at today's rates.</Note>
    </Stack>
  );
}

// ── Compare compensation cost ──────────────────────────
const DIMS = { department: ["Department", (e) => e.department || "Unassigned"], city: ["Location", (e) => e.city || "Not set"], grade: ["Grade", (e) => e.grade_code || "—"], group: ["Pay group", (e) => COUNTRIES[ctryOf(e)]?.name || ctryOf(e)] };

export function CompareCost({ employees }) {
  const { data } = useStore();
  const fx = data.fx;
  const revisions = data.salaryRevisions || [];
  const today = isoDate();
  const active = employees.filter((e) => e.status === "active");
  const [dim, setDim] = useState("department");
  const values = [...new Set(active.map(DIMS[dim][1]))].sort();
  const [a, setA] = useState(values[0]);
  const [b, setB] = useState(values[1] || values[0]);
  const A = values.includes(a) ? a : values[0];
  const B = values.includes(b) ? b : values[1] || values[0];
  const month = monthOf(today);
  const [mA, setMA] = useState(addMonths(month, -12));
  const [mB, setMB] = useState(month);

  const stats = (val) => {
    const list = active.filter((e) => DIMS[dim][1](e) === val);
    const pays = list.map((e) => ({ e, p: payFor(e, month, revisions), cur: curOf(ctryOf(e)) }));
    const inr = (k) => pays.reduce((s, x) => s + toInr(x.p[k], x.cur, fx), 0);
    const grosses = pays.map((x) => toInr(x.p.gross, x.cur, fx)).sort((p, q) => p - q);
    const med = grosses.length ? (grosses.length % 2 ? grosses[(grosses.length - 1) / 2] : (grosses[grosses.length / 2 - 1] + grosses[grosses.length / 2]) / 2) : 0;
    const ben = list.reduce((s, e) => s + (data.benefits?.[e.employee_code] ? 1 : 0), 0);
    return { hc: list.length, gross: inr("gross"), net: inr("net"), employer: inr("employer"), cost: inr("cost"), avg: grosses.length ? inr("gross") / grosses.length : 0, med, min: grosses[0] || 0, max: grosses[grosses.length - 1] || 0, perHead: list.length ? inr("cost") / list.length : 0, ben };
  };
  const SA = stats(A), SB = stats(B);
  const metrics = [["Headcount", "hc", (v) => v], ["Monthly gross", "gross", compactInr], ["Monthly net pay", "net", compactInr], ["Employer contributions", "employer", compactInr], ["Monthly cost to company", "cost", compactInr], ["Cost per head", "perHead", compactInr], ["Average gross", "avg", compactInr], ["Median gross", "med", compactInr], ["Lowest gross", "min", compactInr], ["Highest gross", "max", compactInr]];

  const allMonths = Array.from({ length: 24 }, (_, i) => addMonths(month, -i));
  const periodRows = [...new Set(active.map((e) => e.department))].sort().map((d) => {
    const list = active.filter((e) => e.department === d);
    const c = (m) => list.filter((e) => onPayrollIn(e, m)).reduce((s, e) => s + inrCost(e, m, revisions, fx), 0);
    const hc = (m) => list.filter((e) => onPayrollIn(e, m)).length;
    const x = c(mA), y = c(mB);
    return { d, x, y, hx: hc(mA), hy: hc(mB), diff: y - x, pct: x ? ((y - x) / x) * 100 : null };
  });
  const tx = periodRows.reduce((s, r) => s + r.x, 0), ty = periodRows.reduce((s, r) => s + r.y, 0);

  return (
    <Stack spacing={2.5}>
      <SectionCard title="Compare two groups" subtitle={`This month (${monthName(month, "long")}), in ₹ at the company FX rates`} noPad
        action={
          <Stack direction="row" spacing={1}>
            <FormControl size="small"><Select value={dim} onChange={(e) => { setDim(e.target.value); const v = [...new Set(active.map(DIMS[e.target.value][1]))].sort(); setA(v[0]); setB(v[1] || v[0]); }} sx={{ fontSize: "0.7rem" }}>{Object.entries(DIMS).map(([k, v]) => <MenuItem key={k} value={k}>By {v[0].toLowerCase()}</MenuItem>)}</Select></FormControl>
            <FormControl size="small"><Select value={A} onChange={(e) => setA(e.target.value)} sx={{ fontSize: "0.7rem" }} inputProps={{ "aria-label": "First group" }}>{values.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</Select></FormControl>
            <Typography sx={{ alignSelf: "center" }} variant="body2">vs</Typography>
            <FormControl size="small"><Select value={B} onChange={(e) => setB(e.target.value)} sx={{ fontSize: "0.7rem" }} inputProps={{ "aria-label": "Second group" }}>{values.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</Select></FormControl>
          </Stack>
        }>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead><TableRow><TableCell>Metric</TableCell><TableCell align="right">{A}</TableCell><TableCell align="right">{B}</TableCell><TableCell align="right">Difference</TableCell></TableRow></TableHead>
            <TableBody>
              {metrics.map(([l, k, f]) => {
                const d = SB[k] - SA[k];
                return <TableRow key={k}><TableCell>{l}</TableCell><TableCell align="right">{f(SA[k])}</TableCell><TableCell align="right">{f(SB[k])}</TableCell><TableCell align="right" sx={{ color: d > 0 ? "warning.main" : d < 0 ? "success.main" : "text.secondary" }}>{d === 0 ? "—" : `${d > 0 ? "+" : "−"}${f(Math.abs(d))}`}{SA[k] && k !== "hc" ? ` (${((d / SA[k]) * 100).toFixed(0)}%)` : ""}</TableCell></TableRow>;
              })}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <SectionCard title="Compare two months" subtitle="Cost to company by department (₹). Earlier months use the salary before later revisions." noPad
        action={
          <Stack direction="row" spacing={1}>
            <FormControl size="small"><Select value={mA} onChange={(e) => setMA(e.target.value)} sx={{ fontSize: "0.7rem" }} inputProps={{ "aria-label": "First month" }}>{allMonths.map((m) => <MenuItem key={m} value={m}>{monthName(m, "long")}</MenuItem>)}</Select></FormControl>
            <Typography sx={{ alignSelf: "center" }} variant="body2">vs</Typography>
            <FormControl size="small"><Select value={mB} onChange={(e) => setMB(e.target.value)} sx={{ fontSize: "0.7rem" }} inputProps={{ "aria-label": "Second month" }}>{allMonths.map((m) => <MenuItem key={m} value={m}>{monthName(m, "long")}</MenuItem>)}</Select></FormControl>
          </Stack>
        }>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 700 }}>
            <TableHead><TableRow><TableCell>Department</TableCell><TableCell align="right">Headcount</TableCell><TableCell align="right">{monthName(mA, "long")}</TableCell><TableCell align="right">{monthName(mB, "long")}</TableCell><TableCell align="right">Variance</TableCell></TableRow></TableHead>
            <TableBody>
              {periodRows.map((r) => <TableRow key={r.d}><TableCell sx={{ fontWeight: 600 }}>{r.d}</TableCell><TableCell align="right">{r.hx} → {r.hy}</TableCell><TableCell align="right">{compactInr(r.x)}</TableCell><TableCell align="right">{compactInr(r.y)}</TableCell><TableCell align="right">{r.pct == null ? (r.y ? "New" : "—") : <Tag tone={Math.abs(r.pct) > 10 ? "warn" : "neutral"}>{r.pct >= 0 ? "+" : ""}{r.pct.toFixed(1)}%</Tag>}</TableCell></TableRow>)}
              <TableRow sx={{ "& td": { fontWeight: 700 } }}><TableCell>Total</TableCell><TableCell /><TableCell align="right">{compactInr(tx)}</TableCell><TableCell align="right">{compactInr(ty)}</TableCell><TableCell align="right">{tx ? `${ty >= tx ? "+" : ""}${(((ty - tx) / tx) * 100).toFixed(1)}%` : "—"}</TableCell></TableRow>
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
    </Stack>
  );
}

// ── Employee competitiveness ───────────────────────────
export function EmployeeCompetitiveness({ employees }) {
  const { data } = useStore();
  const fx = data.fx;
  const [pos, setPos] = useState("ALL");
  const india = employees.filter((e) => e.status === "active" && ctryOf(e) === "IN");
  const rows = india.map((e) => ({ e, c: competitiveness(e, data.paySettings, fx), score: weightedScore(data.perf?.[e.employee_code]) })).filter((r) => r.c.band);
  const order = ["Below market", "Approaching market", "At market", "Above market"];
  const count = (p) => rows.filter((r) => r.c.position === p).length;
  const risk = rows.filter((r) => r.score >= 3.7 && ["Below market", "Approaching market"].includes(r.c.position));
  const shown = rows.filter((r) => pos === "ALL" || (pos === "RISK" ? risk.includes(r) : r.c.position === pos)).sort((a, b) => a.c.compa - b.c.compa);
  const avgCompa = rows.reduce((s, r) => s + r.c.compa, 0) / Math.max(1, rows.length);
  const csv = () => downloadCsv("employee-competitiveness.csv", ["Employee code", "Name", "Grade", "City", "Monthly gross", "Band min", "Band mid", "Band max", "Market P25", "Market P50", "Market P75", "Compa-ratio", "Position", "Rating"], rows.map((r) => [r.e.employee_code, r.e.full_name, r.e.grade_code, r.e.city, r.c.gross, Math.round(r.c.band.min), Math.round(r.c.band.mid), Math.round(r.c.band.max), Math.round(r.c.band.p25), Math.round(r.c.band.p50), Math.round(r.c.band.p75), r.c.compa.toFixed(2), r.c.position, r.score.toFixed(1)]));
  return (
    <Stack spacing={2.5}>
      <Grid min={170}>
        <StatCard label="Average compa-ratio" value={avgCompa.toFixed(2)} hint="Gross ÷ band mid-point (1.00 = mid)" tone="accent" />
        {order.map((p) => <StatCard key={p} label={p} value={count(p)} tone={{ "Below market": "bad", "Approaching market": "warn", "At market": "good", "Above market": "info" }[p]} onClick={() => setPos(p)} hint="Filter →" />)}
        <StatCard label="Retention risk" value={risk.length} hint="Rated Exceeds+ and paid under the market median" tone={risk.length ? "bad" : "good"} onClick={() => setPos("RISK")} />
      </Grid>
      <SectionCard title="Pay position against band and market" subtitle="India pay group · bands are location-adjusted by the city cost index (Payroll admin)" noPad
        action={<Stack direction="row" spacing={1}><Chip size="small" label="All" color={pos === "ALL" ? "primary" : "default"} onClick={() => setPos("ALL")} /><Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={csv}>CSV</Button></Stack>}>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 1000 }}>
            <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Grade</TableCell><TableCell align="right">Monthly gross</TableCell><TableCell sx={{ minWidth: 220 }}>Band (min · mid · max)</TableCell><TableCell align="right">Market P50</TableCell><TableCell align="right">Compa-ratio</TableCell><TableCell>Position</TableCell><TableCell>Rating</TableCell></TableRow></TableHead>
            <TableBody>
              {shown.map((r) => {
                const b = r.c.band;
                const pctPos = Math.max(0, Math.min(100, r.c.rangePen * 100));
                return (
                  <TableRow key={r.e.employee_code}>
                    <TableCell><PersonCell name={r.e.full_name} sub={`${r.e.employee_code} · ${r.e.designation}`} /></TableCell>
                    <TableCell>{r.e.grade_code}</TableCell>
                    <TableCell align="right">{fmtMoney(r.c.gross)}</TableCell>
                    <TableCell>
                      <Box sx={{ position: "relative", height: 8, borderRadius: 4, bgcolor: "sunk.main", my: 0.5 }} title={`Range penetration ${pctPos.toFixed(0)}%`}>
                        <Box sx={{ position: "absolute", left: "50%", top: -2, width: 2, height: 12, bgcolor: "text.secondary" }} />
                        <Box sx={{ position: "absolute", left: `calc(${pctPos}% - 5px)`, top: -1, width: 10, height: 10, borderRadius: "50%", bgcolor: "primary.main", border: "2px solid #fff" }} />
                      </Box>
                      <Typography variant="caption" color="text.secondary">{compactInr(b.min)} · {compactInr(b.mid)} · {compactInr(b.max)}</Typography>
                    </TableCell>
                    <TableCell align="right">{fmtMoney(b.p50)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{r.c.compa.toFixed(2)}</TableCell>
                    <TableCell><Tag tone={r.c.tone}>{r.c.position}</Tag></TableCell>
                    <TableCell>{r.score.toFixed(1)}{risk.includes(r) && <Tag tone="bad" sx={{ ml: 0.5 }}>Retention risk</Tag>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrap>
        <Note>Market percentiles come from Payroll admin → Pay bands. Overseas pay groups are not banded yet; add their bands to compare them.</Note>
      </SectionCard>
    </Stack>
  );
}

// ── Geographical differentials ─────────────────────────
export function GeoDifferentials({ employees }) {
  const { data } = useStore();
  const fx = data.fx;
  const S = data.paySettings;
  const active = employees.filter((e) => e.status === "active");
  const cities = [...new Set([...S.cityIndex.map((c) => c.city), ...active.map((e) => e.city).filter(Boolean)])];
  const locRows = cities.map((city) => {
    const list = active.filter((e) => e.city === city);
    const idx = cityIndex(city, S);
    const avg = list.reduce((s, e) => s + grossInr(e, fx), 0) / Math.max(1, list.length);
    const country = S.cityIndex.find((c) => c.city === city)?.country || ctryOf(list[0] || {});
    return { city, country, idx, hc: list.length, avg, adj: avg / (idx / 100) };
  }).sort((a, b) => b.hc - a.hc || a.city.localeCompare(b.city));
  const [code, setCode] = useState(active[0]?.employee_code || "");
  const [target, setTarget] = useState("Bengaluru");
  const e = active.find((x) => x.employee_code === code);
  const from = e ? cityIndex(e.city, S) : 100;
  const to = cityIndex(target, S);
  const gi = e ? grossInr(e, fx) : 0;
  const suggestedInr = gi * (to / from);
  const tCountry = S.cityIndex.find((c) => c.city === target)?.country || "IN";
  const tCur = COUNTRIES[tCountry]?.currency || "INR";
  const suggestedLocal = suggestedInr / ((fx && fx[tCur]) || 1);
  const tBand = e ? bandFor({ ...e, city: target, country_code: tCountry }, S, fx) : null;
  const max = Math.max(...locRows.map((r) => r.idx));
  return (
    <Stack spacing={2.5}>
      <Grid min={420}>
        <SectionCard title="Relocation calculator" subtitle="Suggested gross keeps the same buying power, using the company cost-of-living index">
          <Stack spacing={1.5}>
            <FormControl size="small" fullWidth><InputLabel>Employee</InputLabel><Select label="Employee" value={code} onChange={(ev) => setCode(ev.target.value)}>{active.map((x) => <MenuItem key={x.employee_code} value={x.employee_code}>{x.full_name} · {x.city}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" fullWidth><InputLabel>Move to</InputLabel><Select label="Move to" value={target} onChange={(ev) => setTarget(ev.target.value)}>{S.cityIndex.map((c) => <MenuItem key={c.city} value={c.city}>{c.city} · index {c.index}</MenuItem>)}</Select></FormControl>
            {e && (
              <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "sunk.main" }}>
                <Typography variant="body2">{e.full_name} earns <b>{fmtMoney(e.monthly_gross, curOf(ctryOf(e)))}</b> a month in {e.city} (index {from}).</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>Equivalent in {target} (index {to}): <b>{fmtMoney(suggestedLocal, tCur)}</b>{tCur !== "INR" && ` ≈ ${compactInr(suggestedInr)}`} a month ({to >= from ? "+" : ""}{(((to - from) / from) * 100).toFixed(0)}%).</Typography>
                {tBand && <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>{e.grade_code} band in {target}: {compactInr(tBand.min)} – {compactInr(tBand.max)} (mid {compactInr(tBand.mid)}).</Typography>}
                {tCountry !== ctryOf(e) && <Alert severity="info" sx={{ mt: 1 }}>A move to another country changes tax, social security and the pay group. Model the net pay in Run payroll after updating the employee's country.</Alert>}
              </Box>
            )}
          </Stack>
        </SectionCard>
        <SectionCard title="Cost-of-living index" subtitle="Hyderabad = 100 · edit in Payroll admin">
          <Stack spacing={1}>
            {locRows.filter((r) => r.hc > 0 || r.country === "IN").slice(0, 10).map((r) => <HBar key={r.city} label={`${r.city}${r.hc ? ` · ${r.hc}` : ""}`} value={r.idx} max={max} right={r.idx} />)}
          </Stack>
        </SectionCard>
      </Grid>
      <SectionCard title="Pay by location" subtitle="Average monthly gross in ₹, and the same figure in Hyderabad terms (÷ index) to compare buying power" noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow><TableCell>Location</TableCell><TableCell>Country</TableCell><TableCell align="right">Index</TableCell><TableCell align="right">Employees</TableCell><TableCell align="right">Average gross (₹)</TableCell><TableCell align="right">In Hyderabad terms</TableCell></TableRow></TableHead>
            <TableBody>
              {locRows.filter((r) => r.hc > 0).map((r) => <TableRow key={r.city}><TableCell sx={{ fontWeight: 600 }}>{r.city}</TableCell><TableCell>{COUNTRIES[r.country]?.name || r.country}</TableCell><TableCell align="right">{r.idx}</TableCell><TableCell align="right">{r.hc}</TableCell><TableCell align="right">{compactInr(r.avg)}</TableCell><TableCell align="right">{compactInr(r.adj)}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </TableWrap>
        <Note>Index values are company assumptions, not a published survey. Update them from your benchmarking provider in Payroll admin → Locations.</Note>
      </SectionCard>
    </Stack>
  );
}

