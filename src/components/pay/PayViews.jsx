// Payroll and benefits administration. Payroll uses the Sahayog country engines (IN, GB, US, AE, SG).
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, Drawer, FormControl, IconButton, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { CloseRounded, PlayArrowRounded, LockRounded, DownloadRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap, Mono, KeyVal } from "../kit/UI.jsx";
import { COUNTRIES, computePay, complianceChecks, periodContext, toEngineEmp } from "../../lib/payroll/index.js";
import { dayAttendance, wellnessIndex } from "../../lib/hrcalc.js";
import { isoDate, fmtDateTime, downloadCsv } from "../../lib/utils.js";
import { benefitCost } from "../../pages/workforce/MyBenefits.jsx";
import { useCountryChoice } from "../../country/CountryContext.jsx";
import { isContingent } from "../../data/employeeFields.js";

export const money = (n, cur) => (Number.isFinite(n) ? new Intl.NumberFormat("en-IN", { style: "currency", currency: cur, maximumFractionDigits: cur === "INR" ? 0 : 2 }).format(n) : "—");

// LOP days and overtime pay for the current month, from approved leave and punches.
export function payContext(data, e) {
  const today = isoDate();
  const month = today.slice(0, 7);
  const lop = data.requests.filter((r) => r.type === "leave" && r.leave_type === "LOP" && r.status === "Approved" && r.employee_code === e.employee_code && r.from_date.startsWith(month)).reduce((s, r) => s + r.days, 0);
  let otPay = 0;
  if ((e.country_code || "IN") === "IN" && ["P1", "P2"].includes(e.grade_code)) {
    const days = [...new Set(data.punches.filter((p) => p.employee_code === e.employee_code && p.ts.startsWith(month)).map((p) => p.ts.slice(0, 10)))];
    const ot = days.reduce((s, d) => s + dayAttendance(data.punches.filter((p) => p.employee_code === e.employee_code && p.ts.startsWith(d))).ot, 0);
    otPay = Math.round(ot * (e.monthly_gross / (26 * 8)) * 2);
  }
  return periodContext(today, { lopDays: lop, otPay, weeklyHours: 45 });
}

function Payslip({ row, onClose }) {
  if (!row) return null;
  const { e, pay, checks, cur } = row;
  const Kv = ({ title, list, total }) => (
    <Box>
      <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, mb: 0.6 }}>{title}</Typography>
      {list.map(([k, v]) => <Stack key={k} direction="row" sx={{ justifyContent: "space-between", py: 0.3, borderBottom: "1px dashed #edf0ec" }}><Typography sx={{ fontSize: "0.65rem", color: "#56655f" }}>{k}</Typography><Typography sx={{ fontSize: "0.65rem" }}>{typeof v === "number" ? money(v, cur) : v}</Typography></Stack>)}
      {total && <Stack direction="row" sx={{ justifyContent: "space-between", py: 0.6 }}><Typography sx={{ fontSize: "0.68rem", fontWeight: 800 }}>{total[0]}</Typography><Typography sx={{ fontSize: "0.68rem", fontWeight: 800 }}>{money(total[1], cur)}</Typography></Stack>}
    </Box>
  );
  return (
    <Drawer anchor="right" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 560 } } } }}>
      <Stack direction="row" sx={{ alignItems: "center", px: 2.5, py: 1.5, borderBottom: "1px solid #edf0ec" }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Payslip preview · {e.full_name}</Typography>
        <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
      </Stack>
      <Stack spacing={2.2} sx={{ p: 2.5, overflow: "auto" }}>
        <KeyVal cols={3} items={[["Employee", `${e.employee_code} · ${e.designation}`], ["Country / region", `${COUNTRIES[e.country_code || "IN"]?.name} · ${e.region || "—"}`], ["Period", isoDate().slice(0, 7)]]} />
        <Kv title="Earnings" list={pay.earnings.filter(([, v]) => v !== 0)} total={["Earned", pay.earned]} />
        <Kv title="Deductions" list={pay.deductions} total={["Total deductions", pay.totalDeductions]} />
        <Box sx={{ p: 1.5, borderRadius: 1.5, background: "#e8f2ec" }}><Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontWeight: 800, fontSize: "0.8rem" }}>Net pay</Typography><Typography sx={{ fontWeight: 800, fontSize: "0.8rem" }}>{money(pay.net, cur)}</Typography></Stack></Box>
        <Kv title="Employer contributions" list={pay.employer} total={["Cost to company (month)", pay.cost]} />
        <Kv title="How it was calculated" list={pay.steps} />
        {pay.notes?.length > 0 && <Box>{pay.notes.map((n) => <Typography key={n} sx={{ fontSize: "0.6rem", color: "#78827b" }}>• {n}</Typography>)}</Box>}
        <Box>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, mb: 0.6 }}>Compliance checks</Typography>
          {checks.map((c) => <Stack key={c.rule} direction="row" spacing={1} sx={{ py: 0.4 }}><Tag tone={{ pass: "good", warn: "warn", fail: "bad", info: "info" }[c.status]}>{c.block ? "Blocking" : c.status}</Tag><Box><Typography sx={{ fontSize: "0.65rem", fontWeight: 600 }}>{c.rule}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{c.detail} {c.law && `· ${c.law}`}</Typography></Box></Stack>)}
        </Box>
      </Stack>
    </Drawer>
  );
}

export function PayrollView({ employees }) {
  const { data, runPayroll, lockPayroll, notifyToast } = useStore();
  // Contingent workers (contract, freelance, agency …) are paid through Contract management → contractor pay runs.
  const active = employees.filter((e) => e.status === "active" && !isContingent(e));
  const contingentN = employees.filter((e) => e.status === "active" && isContingent(e)).length;
  const countries = Object.keys(COUNTRIES).filter((c) => active.some((e) => (e.country_code || "IN") === c));
  // The header country decides the run; the chips only appear with "All countries" (or a region).
  const choice = useCountryChoice(countries, "IN");
  const country = COUNTRIES[choice.value] ? choice.value : countries[0] || "IN";
  const setCountry = choice.setValue;
  const [open, setOpen] = useState(null);
  const C = COUNTRIES[country];
  const rows = useMemo(
    () =>
      active.filter((e) => (e.country_code || "IN") === country).map((e) => {
        const ee = toEngineEmp(e);
        const ctx = payContext(data, e);
        let pay;
        try {
          pay = computePay(ee, ctx);
        } catch (er) {
          pay = null;
        }
        const checks = complianceChecks(ee, ctx);
        return { e, pay, checks, cur: C.currency, ctx };
      }),
    [data, country, employees], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const tot = (k) => rows.reduce((s, r) => s + (r.pay?.[k] || 0), 0);
  const blocking = rows.reduce((s, r) => s + r.checks.filter((c) => c.block).length, 0);
  const period = isoDate().slice(0, 7);
  const run = data.payrollRuns.find((r) => r.country === country && r.period === period);
  const cur = C.currency;
  return (
    <Stack spacing={2.5}>
      {contingentN > 0 && <Alert severity="info" sx={{ fontSize: "0.66rem" }}>{contingentN} contingent worker(s) are not in this run: contract employees, interns, freelancers, consultants and agency workers are paid from timesheets and milestones in the <b>Contractor pay</b> tab.</Alert>}
      {choice.showChips && <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap" }}>
        {choice.options.map((c) => <Chip key={c} label={`${COUNTRIES[c].name} (${active.filter((e) => (e.country_code || "IN") === c).length})`} color={country === c ? "primary" : "default"} variant={country === c ? "filled" : "outlined"} onClick={() => setCountry(c)} />)}
      </Stack>}
      <Grid min={160}>
        <StatCard label="Employees" value={rows.length} hint={`${C.engine.RATES.effective}`} />
        <StatCard label="Gross earned" value={money(tot("earned"), cur)} tone="info" />
        <StatCard label="Net pay" value={money(tot("net"), cur)} tone="good" />
        <StatCard label="Employer contributions" value={money(tot("employerTotal"), cur)} tone="warn" />
        <StatCard label="Cost to company" value={money(tot("cost"), cur)} tone="neutral" hint={cur !== "INR" ? `≈ ₹${Math.round(tot("cost") * (data.fx[cur] || 1)).toLocaleString("en-IN")}` : undefined} />
      </Grid>
      {blocking > 0 && <Alert severity="error">{blocking} blocking compliance failure(s) in {C.name}. Fix the employee's local settings (for example the work state) before running payroll.</Alert>}
      <SectionCard
        title={`${C.name} payroll · ${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`}
        subtitle={run ? `${run.status} · computed ${fmtDateTime(run.computed_at)}${run.locked_at ? ` · locked ${fmtDateTime(run.locked_at)}` : ""}` : "Not run yet this month"}
        action={
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv(`payroll-${country}-${period}.csv`, ["Employee code", "Name", "Gross", "Earned", "Deductions", "Net", "Employer", "Cost", "Currency"], rows.map((r) => [r.e.employee_code, r.e.full_name, r.pay?.gross, r.pay?.earned, r.pay?.totalDeductions, r.pay?.net, r.pay?.employerTotal, r.pay?.cost, cur]))}>Register CSV</Button>
            <Button size="small" variant="contained" startIcon={<PlayArrowRounded />} disabled={run?.status === "Locked"} onClick={() => { const r = runPayroll(country, { headcount: rows.length, gross: tot("earned"), net: tot("net"), employer: tot("employerTotal"), cost: tot("cost"), currency: cur, blocking }); notifyToast(r.ok ? `${C.name} payroll computed as a draft.` : r.error, r.ok ? "success" : "error"); }}>{run ? "Re-run" : "Run payroll"}</Button>
            {run && run.status !== "Locked" && <Button size="small" variant="contained" color="secondary" startIcon={<LockRounded />} onClick={() => { const r = lockPayroll(run.id); notifyToast(r.ok ? "Payroll locked; payslips released." : r.error, r.ok ? "success" : "error"); }}>Lock and release payslips</Button>}
          </Stack>
        }
        noPad
      >
        <TableWrap>
          <Table size="small" sx={{ minWidth: 980 }}>
            <TableHead><TableRow><TableCell>Employee</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">LOP / OT</TableCell><TableCell align="right">Earned</TableCell><TableCell align="right">Deductions</TableCell><TableCell align="right">Net pay</TableCell><TableCell align="right">Employer</TableCell><TableCell align="right">CTC (month)</TableCell><TableCell>Checks</TableCell></TableRow></TableHead>
            <TableBody>
              {rows.map((r) => {
                const fail = r.checks.filter((c) => c.status === "fail").length;
                const warn = r.checks.filter((c) => c.status === "warn").length;
                return (
                  <TableRow key={r.e.employee_code} hover sx={{ cursor: "pointer" }} onClick={() => r.pay && setOpen(r)}>
                    <TableCell><PersonCell name={r.e.full_name} sub={`${r.e.employee_code} · ${r.e.region || "no region"}`} /></TableCell>
                    <TableCell align="right">{money(r.pay?.gross, cur)}</TableCell>
                    <TableCell align="right"><Typography sx={{ fontSize: "0.62rem" }}>{r.ctx.lopDays ? `${r.ctx.lopDays} d LOP` : "—"}{r.ctx.otPay ? ` · OT ${money(r.ctx.otPay, cur)}` : ""}</Typography></TableCell>
                    <TableCell align="right">{money(r.pay?.earned, cur)}</TableCell>
                    <TableCell align="right">{money(r.pay?.totalDeductions, cur)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{money(r.pay?.net, cur)}</TableCell>
                    <TableCell align="right">{money(r.pay?.employerTotal, cur)}</TableCell>
                    <TableCell align="right">{money(r.pay?.cost, cur)}</TableCell>
                    <TableCell><Stack direction="row" spacing={0.4}>{fail ? <Tag tone="bad">{fail} fail</Tag> : null}{warn ? <Tag tone="warn">{warn} warn</Tag> : null}{!fail && !warn && <Tag tone="good">Pass</Tag>}</Stack></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrap>
        <Typography sx={{ p: 1.5, fontSize: "0.6rem", color: "#78827b" }}>Click a row for the payslip and the calculation steps. Rates come from src/lib/payroll/{country.toLowerCase()}.js; confirm them with your payroll adviser at each statutory change.</Typography>
      </SectionCard>
      <SectionCard title="Run history" noPad>
        {data.payrollRuns.length === 0 ? <Typography sx={{ p: 2, fontSize: "0.65rem", color: "#78827b" }}>No runs yet.</Typography> : (
          <TableWrap>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead><TableRow><TableCell>Run</TableCell><TableCell>Country</TableCell><TableCell>Period</TableCell><TableCell align="right">People</TableCell><TableCell align="right">Net</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>{data.payrollRuns.map((r) => <TableRow key={r.id}><TableCell><Mono>{r.id}</Mono></TableCell><TableCell>{COUNTRIES[r.country]?.name}</TableCell><TableCell>{r.period}</TableCell><TableCell align="right">{r.headcount}</TableCell><TableCell align="right">{money(r.net, r.currency)}</TableCell><TableCell><Tag tone={r.status === "Locked" ? "good" : "info"}>{r.status}</Tag></TableCell></TableRow>)}</TableBody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
      <Payslip row={open} onClose={() => setOpen(null)} />
    </Stack>
  );
}

export function BenefitsAdminView({ employees }) {
  const { data, updateBenefits, updateSettings, notifyToast } = useStore();
  const rows = employees.filter((e) => e.status === "active" && (e.country_code || "IN") === "IN").map((e) => ({ e, b: data.benefits[e.employee_code] || { tier: "S", nps: 0, meal: false } })).map((r) => ({ ...r, c: benefitCost(r.e, r.b, data.healthTiers) }));
  const total = rows.reduce((s, r) => s + r.c.total, 0);
  const payroll = rows.reduce((s, r) => s + r.e.monthly_gross * 12, 0);
  const set = (code, patch) => { const r = updateBenefits(code, patch); if (!r.ok) notifyToast(r.error, "error"); };
  return (
    <Stack spacing={2.5}>
      <Grid min={160}>
        <StatCard label="Annual benefits cost" value={`₹${Math.round(total).toLocaleString("en-IN")}`} hint="Employer share" />
        <StatCard label="Per employee" value={`₹${Math.round(total / Math.max(1, rows.length)).toLocaleString("en-IN")}`} tone="info" />
        <StatCard label="As % of payroll" value={`${((total / Math.max(1, payroll)) * 100).toFixed(1)}%`} tone="neutral" />
        <StatCard label="Family cover" value={`${rows.filter((r) => r.b.tier === "F").length} of ${rows.length}`} tone="good" />
        <StatCard label="NPS participants" value={rows.filter((r) => r.b.nps > 0).length} tone="accent" />
      </Grid>
      <SectionCard title="Enrolment (India)" subtitle="Change a selection to save and recost" action={<Button size="small" variant="outlined" onClick={() => { updateSettings({ benefits_window_open: !data.settings.benefits_window_open }); notifyToast(data.settings.benefits_window_open ? "Enrolment window closed." : "Enrolment window opened."); }}>{data.settings.benefits_window_open ? "Close enrolment window" : "Open enrolment window"}</Button>} noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 980 }}>
            <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Health tier</TableCell><TableCell align="right">Premium</TableCell><TableCell align="right">Employer pays</TableCell><TableCell align="right">Employee / month</TableCell><TableCell align="right">Life cover</TableCell><TableCell>Employer NPS</TableCell><TableCell align="right">Employer cost / yr</TableCell></TableRow></TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.e.employee_code}>
                  <TableCell><PersonCell name={r.e.full_name} sub={r.e.employee_code} /></TableCell>
                  <TableCell><FormControl size="small"><Select value={r.b.tier} onChange={(ev) => set(r.e.employee_code, { tier: ev.target.value })} sx={{ fontSize: "0.62rem" }}>{Object.entries(data.healthTiers || {}).map(([k, v]) => <MenuItem key={k} value={k}>{v.l}</MenuItem>)}</Select></FormControl></TableCell>
                  <TableCell align="right">₹{r.c.prem.toLocaleString("en-IN")}</TableCell>
                  <TableCell align="right">₹{Math.round(r.c.er).toLocaleString("en-IN")}</TableCell>
                  <TableCell align="right">₹{Math.round(r.c.ee / 12).toLocaleString("en-IN")}</TableCell>
                  <TableCell align="right">₹{(r.c.cover / 100000).toFixed(1)} L</TableCell>
                  <TableCell><FormControl size="small"><Select value={r.b.nps} onChange={(ev) => set(r.e.employee_code, { nps: ev.target.value })} sx={{ fontSize: "0.62rem" }}>{[0, 5, 10, 14].map((v) => <MenuItem key={v} value={v}>{v ? `${v}%` : "None"}</MenuItem>)}</Select></FormControl></TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>₹{r.c.total.toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
    </Stack>
  );
}

export function WellnessAdminView() {
  const { data } = useStore();
  const month = isoDate().slice(0, 7);
  const ps = data.pulses.filter((p) => p.month === month);
  const byDept = {};
  ps.forEach((p) => { (byDept[p.dept] = byDept[p.dept] || []).push(p); });
  // Teams with fewer than 3 responses are merged into "Other teams" so no one can be identified.
  const small = Object.entries(byDept).filter(([, v]) => v.length < 3);
  const groups = Object.entries(byDept).filter(([, v]) => v.length >= 3);
  if (small.length) groups.push(["Other teams (merged)", small.flatMap(([, v]) => v)]);
  const avg = (list, k) => list.reduce((s, p) => s + p[k], 0) / Math.max(1, list.length);
  const rows = groups.map(([d, list]) => ({ d, n: list.length, st: avg(list, "stress"), sl: avg(list, "sleep"), ac: avg(list, "activity"), en: avg(list, "energy"), part: list.filter((p) => p.in_programme).length, ix: list.reduce((s, p) => s + wellnessIndex(p), 0) / list.length }));
  const overall = ps.length ? ps.reduce((s, p) => s + wellnessIndex(p), 0) / ps.length : 0;
  const responded = (data.pulseSubmitted[month] || []).length;
  const activeN = data.employees.filter((e) => e.status === "active").length;
  return (
    <Stack spacing={2.5}>
      <Grid min={160}>
        <StatCard label="Wellness index" value={Math.round(overall)} hint="0–100, company-wide" tone={overall >= 65 ? "good" : overall >= 50 ? "warn" : "bad"} />
        <StatCard label="Responses this month" value={`${responded}/${activeN}`} tone="info" />
        <StatCard label="In programmes" value={`${Math.round((ps.filter((p) => p.in_programme).length / Math.max(1, ps.length)) * 100)}%`} tone="neutral" />
        <StatCard label="Wellness budget" value={`₹${data.programs.reduce((s, p) => s + p.b, 0).toLocaleString("en-IN")}`} tone="accent" hint="Annual" />
      </Grid>
      <SectionCard title="Pulse by team" subtitle="Index = ((6 − stress) + sleep + activity + energy) ÷ 4, rescaled to 0–100. Teams under 3 responses are merged." noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow><TableCell>Team</TableCell><TableCell align="right">Responses</TableCell><TableCell align="right">Stress</TableCell><TableCell align="right">Sleep</TableCell><TableCell align="right">Activity</TableCell><TableCell align="right">Energy</TableCell><TableCell align="right">Index</TableCell><TableCell>Signal</TableCell></TableRow></TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.d}>
                  <TableCell sx={{ fontWeight: 700 }}>{r.d}</TableCell>
                  <TableCell align="right">{r.n}</TableCell>
                  <TableCell align="right">{r.st.toFixed(1)}</TableCell>
                  <TableCell align="right">{r.sl.toFixed(1)}</TableCell>
                  <TableCell align="right">{r.ac.toFixed(1)}</TableCell>
                  <TableCell align="right">{r.en.toFixed(1)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{Math.round(r.ix)}</TableCell>
                  <TableCell><Tag tone={r.ix >= 65 ? "good" : r.ix >= 50 ? "warn" : "bad"}>{r.ix >= 65 ? "Healthy" : r.ix >= 50 ? "Watch" : "Support needed"}</Tag></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <SectionCard title="Programmes" noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 560 }}>
            <TableHead><TableRow><TableCell>Programme</TableCell><TableCell align="right">Annual budget</TableCell><TableCell align="right">Uptake</TableCell><TableCell align="right">Cost per head</TableCell></TableRow></TableHead>
            <TableBody>{data.programs.map((p) => <TableRow key={p.n}><TableCell sx={{ fontWeight: 700 }}>{p.n}</TableCell><TableCell align="right">₹{p.b.toLocaleString("en-IN")}</TableCell><TableCell align="right">{p.p} {p.u}</TableCell><TableCell align="right">₹{Math.round(p.b / p.p).toLocaleString("en-IN")}</TableCell></TableRow>)}</TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
    </Stack>
  );
}
