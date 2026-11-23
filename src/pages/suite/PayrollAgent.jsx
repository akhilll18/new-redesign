// Payroll Agent (v10) — "the month runs itself": attendance & leave flow in → variable pay → salaries in every country →
// statutory deductions (PF, ESI, PT, TDS, LWF, PAYE, social security, pension) → AI review → one-tap approval →
// payslips on the phone → bank payout files → returns filed. Tabs: Run · Variable pay · Bank payouts · Filings & year-end · Global & FX.
import React, { useEffect, useMemo, useRef, useState } from "react";
import ListSelect from "../../components/kit/ListSelect.jsx";
import { Alert, Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import {
  PlayArrowRounded, Groups, Payments, AccountBalance, ReceiptLong, Gavel, TrendingUp, Bolt, EventBusy, PriceChange, Description, CurrencyExchange,
  UploadFile, DownloadRounded, CheckRounded, SendRounded, WarningAmberRounded, Smartphone, Calculate, PersonRemove, AutoAwesome,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, TableWrap, PersonCell, EmptyState } from "../../components/kit/UI.jsx";
import { ModuleHub, Ring, Steps, QuickAction, Pill, StatusPill, money, useWho, TwoCol, Hint, C, Progress, periodLabel } from "../../components/suite/Hub.jsx";
import { computeRun, allDeadlines, bankFileRows, journalLines, formsFor, BANK_FORMATS } from "../../lib/suitePayroll.js";
import { COUNTRIES } from "../../lib/payroll/index.js";
import { indiaPayslipRow } from "../../lib/payslipGen.js";
import { downloadCsv, fmtDate, fmtDateTime, isoDate, monthLabel } from "../../lib/utils.js";

const TABS = [["run", "Run payroll", "/payroll-agent"], ["variable", "Variable pay", "/variable-pay"], ["payouts", "Bank payouts", "/payouts"], ["filings", "Filings & year-end", "/filings"], ["global", "Global & FX", "/global-payroll"]];

export default function PayrollAgent({ tab = "run" }) {
  const { data } = useStore();
  const period = isoDate().slice(0, 7);
  const run = useMemo(() => computeRun(data, { period }), [data, period]);
  const cur = data.suite?.currentRun?.period === period ? data.suite.currentRun : null;
  const countries = run.byCountry.length;
  const brief = {
    run: { text: <>Payroll for <b>{periodLabel(period)}</b>: <b>{run.totals.people}</b> people in <b>{countries}</b> countries, net <b>{money(run.totals.net, "INR", { compact: true })}</b>. {run.errors.length ? <><b>{run.errors.length}</b> blocking issue(s) and </> : null}<b>{run.warns.length}</b> item(s) to check before approval.</>, ask: `Review my ${monthLabel(period)} payroll: ${run.totals.people} people, ${run.errors.length} errors, ${run.warns.length} warnings. What should I fix first?` },
    variable: { text: <>Variable pay this month: <b>{money(run.totals.variable, "INR", { compact: true })}</b> across <b>{run.rows.filter((r) => r.variable).length}</b> people — hourly, overtime, bonus and commission flow straight into the run.</> },
    payouts: { text: <><b>{countries}</b> bank files for {monthLabel(period)} — {run.byCountry.map((b) => b.code).join(", ")}. Net to pay <b>{money(run.totals.net, "INR", { compact: true })}</b>.</> },
    filings: { text: <>Every return and year-end form is generated from the run — PF ECR, ESI, PT, TDS, LWF, 24Q and Form 16 in India; RTI and P60 in the UK; 941 and W-2 in the US, and more.</> },
    global: { text: <>One consolidated payroll in ₹ across <b>{countries}</b> currencies at today's rates. Employer cost <b>{money(run.totals.cost, "INR", { compact: true })}</b>.</> },
  }[tab];
  return (
    <ModuleHub
      eyebrow="PAY & BENEFITS · PAYROLL AGENT"
      live={cur?.status === "running" ? "AGENT RUNNING" : undefined}
      title={`Payroll · ${periodLabel(period)}`}
      subtitle="The Payroll Agent runs the month for you — attendance and leave sync in, salaries and statutory deductions are computed for every country, issues are flagged, and one tap approves payslips, bank payouts and filings."
      tabs={TABS.map((t) => (t[0] === "run" && run.errors.length ? [...t, run.errors.length] : t))}
      tab={tab}
      brief={brief}
    >
      {tab === "run" && <RunTab run={run} period={period} />}
      {tab === "variable" && <VariableTab run={run} period={period} />}
      {tab === "payouts" && <PayoutsTab run={run} period={period} />}
      {tab === "filings" && <FilingsTab run={run} />}
      {tab === "global" && <GlobalTab run={run} />}
    </ModuleHub>
  );
}

// ── Run ─────────────────────────────────────────────────────────────────────────
const AGENT_STEPS = [
  ["sync", "Sync attendance & leave", (r) => `${r.rows.length} people · ${r.rows.reduce((s, x) => s + x.lopDays, 0)} LOP days · overtime from punches`],
  ["variable", "Variable pay", (r) => `${r.rows.filter((x) => x.variable).length} with hourly / OT / bonus / commission`],
  ["calc", "Calculate salaries", (r) => `${r.byCountry.length} countries · ${money(r.totals.gross, "INR", { compact: true })} gross`],
  ["statutory", "Statutory deductions", (r) => `PF ${money(r.stat.PF || 0, "INR", { compact: true })} · ESI · PT · TDS · LWF · PAYE / social`],
  ["review", "AI review", (r) => `${r.errors.length} errors · ${r.warns.length} warnings`],
  ["approve", "One-tap approval", () => "Finance or Super Admin"],
  ["payslips", "Payslips to phones", () => "Released in the app and by email"],
  ["bank", "Bank payouts", (r) => `${r.byCountry.length} bank files`],
  ["file", "File returns", () => "ECR · ESI · PT · TDS · LWF · RTI · 941 …"],
];

function RunTab({ run, period }) {
  const { data, suiteDo, suiteCan, notifyToast, user, createBatch } = useStore();
  const navigate = useNavigate();
  const { isSuper } = useWho();
  const saved = data.suite?.currentRun?.period === period ? data.suite.currentRun : null;
  const [anim, setAnim] = useState(null); // index of the running step while the agent animates
  const timer = useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);
  const canAct = suiteCan("payroll");
  const doneUpTo = saved?.status === "completed" ? 9 : saved?.status === "awaiting_approval" ? 5 : -1;
  const steps = AGENT_STEPS.map(([key, label, sub], i) => ({
    key, label, sub: sub(run),
    status: anim != null ? (i < anim ? "done" : i === anim ? "running" : "todo") : i < doneUpTo ? "done" : i === doneUpTo && saved?.status === "awaiting_approval" ? (run.errors.length ? "error" : "running") : "todo",
  }));

  function startAgent() {
    if (!canAct) return notifyToast("Only Finance (payroll) or a Super Admin can run payroll.", "info");
    let i = 0;
    setAnim(0);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      i += 1;
      if (i >= 5) {
        clearInterval(timer.current);
        setAnim(null);
        suiteDo("payroll", (s, { now }) => { s.currentRun = { period, status: "awaiting_approval", started_at: now, by: user.code, people: run.totals.people, net_inr: Math.round(run.totals.net), cost_inr: Math.round(run.totals.cost), errors: run.errors.length, warns: run.warns.length }; }, { action: "PAYROLL_AGENT_RUN", details: `${period} · ${run.totals.people} people · ${run.errors.length} errors · ${run.warns.length} warnings` });
        notifyToast(run.errors.length ? `Agent finished: ${run.errors.length} issue(s) need you before approval.` : "Agent finished — ready for your one-tap approval.", run.errors.length ? "warning" : "success");
      } else setAnim(i);
    }, 650);
  }

  function approve() {
    if (!canAct) return;
    const india = run.rows.filter((r) => r.code === "IN" && r.pay);
    let batchNote = "Payslips handed to HR for release.";
    if (isSuper || (user.modules || []).includes("payslips")) {
      const taken = new Set(data.payslipBatches.filter((b) => b.period === period && b.status !== "Rejected").flatMap((b) => b.slips.map((s) => s.employee_code)));
      const rows = india.filter((r) => !taken.has(r.e.employee_code)).map((r) => indiaPayslipRow(r.e, { period, totalWorkingDays: 30, lopDays: r.lopDays, otPay: r.otPay }));
      if (rows.length) {
        const b = createBatch({ period, source: "payroll", rows, note: "Created by the Payroll Agent" });
        if (b.ok) batchNote = `Payslip run ${b.id} created with ${rows.length} India payslips.`;
      } else batchNote = "India payslips already exist for this month.";
    }
    const r = suiteDo("payroll", (s, { now, x }) => {
      s.currentRun = { ...(s.currentRun || {}), period, status: "completed", approved_by: user.code, approved_at: now };
      s.agentRuns = [{ id: `RUN-${period}`, period, status: "completed", started_at: s.currentRun.started_at || now, finished_at: now, approved_by: user.code, people: run.totals.people, net_inr: Math.round(run.totals.net), cost_inr: Math.round(run.totals.cost), flags: run.flags.length, minutes: 4 }, ...(s.agentRuns || []).filter((a) => a.period !== period)];
      s.payouts = [
        ...run.byCountry.map((b) => ({ id: `PAY-${period}-${b.code}`, period, country: b.code, bank: x.employees.find((e) => (e.country_code || "IN") === b.code)?.bank_name || "Bank", format: BANK_FORMATS[b.code] || "Bank transfer", count: b.people, amount: Math.round(b.net), currency: b.cur, status: "ready", created_at: now })),
        ...(s.payouts || []).filter((p) => p.period !== period),
      ];
      const queued = ["PF ECR", "ESI challan", "PT return", "TDS challan 281"].map((f, i) => ({ id: `FIL-${period}-IN-${i}`, country: "IN", form: f, period, status: "queued" }));
      s.filings = [...queued, ...(s.filings || []).filter((f) => !(f.period === period && f.status === "queued"))];
      x.employees.filter((e) => e.status === "active").forEach((e) => x.notifications.unshift({ id: `N-${Date.now()}-${e.employee_code}`, to: e.employee_code, text: `Your payslip for ${monthLabel(period)} is ready — open it in the app or under My pay & payslips.`, at: now, read: false, link: "/finances" }));
    }, { action: "PAYROLL_AGENT_APPROVE", details: `${period} approved · net ₹${Math.round(run.totals.net).toLocaleString("en-IN")} · ${run.byCountry.length} bank files queued` });
    if (r.ok) notifyToast(`Approved. ${batchNote} Bank files are ready and returns are queued.`);
  }

  const health = Math.round(((run.rows.length - new Set(run.flags.filter((f) => f.level !== "info").map((f) => f.e.employee_code)).size) / Math.max(1, run.rows.length)) * 100);
  const deadlines = allDeadlines(data).slice(0, 7);
  const qa = [
    [<PlayArrowRounded />, "Run payroll", "Payroll Agent", startAgent, "navy"],
    [<Bolt />, "Variable pay", "Hourly · OT · bonus · commission", () => navigate("/variable-pay"), "glob"],
    [<PriceChange />, "Salary revision", "Increments & arrears", () => navigate("/payroll?tab=admin"), "navy"],
    [<ReceiptLong />, "Generate payslips", "Review & release", () => navigate("/payslips"), "mint"],
    [<EventBusy />, "LOP import", "From leave & attendance", () => navigate("/attendance-admin"), "navy"],
    [<AccountBalance />, "Bank advice", "Payout files", () => navigate("/payouts"), "glob"],
    [<Description />, "Form 16 / W-2 / P60", "Year-end forms", () => navigate("/filings"), "navy"],
    [<PersonRemove />, "F&F settlement", "Exits this month", () => navigate("/exits"), "glob"],
  ];

  return (
    <>
    <PayrollRuns period={period} run={run} saved={saved} canAct={canAct} />
    <TwoCol right={340}>
      <Stack spacing={2}>
        <PayrollDataSources run={run} period={period} />
        <Card sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { md: "center" }, mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.08em", color: C.glob }}>CURRENT CYCLE · {periodLabel(period).toUpperCase()}</Typography>
              <Typography variant="h2" sx={{ mt: 0.3 }}>{saved?.status === "completed" ? "Payroll approved" : saved?.status === "awaiting_approval" ? "Ready for one-tap approval" : anim != null ? "Payroll Agent is working…" : "Payroll not started"}</Typography>
              <Typography variant="body2" color="text.secondary">{run.totals.people} employees · {run.byCountry.length} countries · {run.errors.length} blocking · {run.warns.length} to check{saved?.approved_at ? ` · approved ${fmtDateTime(saved.approved_at)}` : ""}</Typography>
            </Box>
            <Box sx={{ textAlign: { md: "right" } }}>
              <Typography sx={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.08em", color: "text.secondary" }}>NET PAYOUT</Typography>
              <Typography sx={{ fontSize: "1.7rem", fontWeight: 800, color: C.navy, lineHeight: 1.1 }}>{money(run.totals.net, "INR", { compact: true })}</Typography>
              <Typography variant="caption" color="text.secondary">Gross {money(run.totals.gross, "INR", { compact: true })} · Deductions {money(run.totals.ded, "INR", { compact: true })}</Typography>
            </Box>
          </Stack>
          <Steps steps={steps} compact />
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.8, flexWrap: "wrap" }}>
            {saved?.status !== "completed" && <Button variant="contained" startIcon={<AutoAwesome />} onClick={startAgent} disabled={anim != null || !canAct}>{saved ? "Re-run the agent" : "Run the month with Payroll Agent"}</Button>}
            {saved?.status === "awaiting_approval" && <Button variant="contained" color="secondary" startIcon={<CheckRounded />} onClick={approve} disabled={!!run.errors.length || !canAct}>Approve & pay (one tap)</Button>}
            {saved?.status === "completed" && <Button variant="contained" startIcon={<AccountBalance />} onClick={() => navigate("/payouts")}>Send bank files</Button>}
            <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv(`salary-journal-${period}.csv`, ["Ledger", "Dr/Cr", "Amount (INR)"], journalLines(run))}>Salary journal</Button>
            <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv(`payroll-register-${period}.csv`, ["Code", "Name", "Country", "Currency", "Gross", "Deductions", "Net", "Employer cost", "Net (INR)", "Flags"], run.rows.map((r) => [r.e.employee_code, r.e.full_name, r.code, r.cur, r.pay?.earned ?? "", r.pay?.totalDeductions ?? "", r.pay?.net ?? "", r.pay?.cost ?? "", Math.round(r.inr.net), r.flags.map((f) => f.text).join(" | ")]))}>Payroll register</Button>
          </Stack>
          {saved?.status === "awaiting_approval" && run.errors.length > 0 && <Alert severity="error" sx={{ mt: 1.5 }}>Fix the {run.errors.length} blocking issue(s) below — usually a missing bank account — then approve.</Alert>}
          {!canAct && <Hint>You can view this run. Finance (payroll module) or a Super Admin runs and approves it.</Hint>}
        </Card>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 1.2 }}>
          {qa.map(([icon, label, sub, fn, tone]) => <QuickAction key={label} icon={icon} label={label} sub={sub} onClick={fn} tone={tone} />)}
        </Box>

        <SectionCard title="Needs your attention" subtitle="Raised by the agent's review — errors block approval, warnings don't" noPad>
          {run.flags.filter((f) => f.level !== "info").length === 0 ? <EmptyState title="Nothing to fix" text="Every employee passed the checks." /> : (
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Country</TableCell><TableCell>Issue</TableCell><TableCell align="right">Fix</TableCell></TableRow></TableHead>
              <TableBody>{run.flags.filter((f) => f.level !== "info").slice(0, 12).map((f, i) => (
                <TableRow key={i}><TableCell><PersonCell name={f.e.full_name} sub={f.e.employee_code} /></TableCell><TableCell>{f.e.country_code || "IN"}</TableCell>
                  <TableCell><Stack direction="row" spacing={0.8} sx={{ alignItems: "center" }}><WarningAmberRounded sx={{ fontSize: 16, color: f.level === "error" ? "error.main" : "warning.main" }} /><Typography variant="body2">{f.text}</Typography></Stack></TableCell>
                  <TableCell align="right"><Button size="small" onClick={() => navigate(user.role === "superadmin" ? "/employees" : "/people")}>Open record</Button></TableCell></TableRow>
              ))}</TableBody></Table></TableWrap>
          )}
        </SectionCard>

        <SectionCard title="Employees in this run" subtitle="Local currency per country engine; ₹ at today's rate" noPad>
          <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Country</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">Variable</TableCell><TableCell align="right">Deductions</TableCell><TableCell align="right">Net</TableCell><TableCell align="right">Net ₹</TableCell></TableRow></TableHead>
            <TableBody>{run.rows.map((r) => (
              <TableRow key={r.e.employee_code}><TableCell><PersonCell name={r.e.full_name} sub={`${r.e.employee_code} · ${r.e.designation}`} /></TableCell><TableCell>{r.code}</TableCell>
                <TableCell align="right">{r.pay ? money(r.pay.earned, r.cur) : "—"}</TableCell><TableCell align="right">{r.variable ? money(r.variable, r.cur) : "—"}</TableCell>
                <TableCell align="right">{r.pay ? money(r.pay.totalDeductions, r.cur) : "—"}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{r.pay ? money(r.pay.net, r.cur) : "—"}</TableCell><TableCell align="right">{money(r.inr.net, "INR")}</TableCell></TableRow>
            ))}</TableBody></Table></TableWrap>
        </SectionCard>
      </Stack>

      <Stack spacing={2}>
        <SectionCard title="Compliance health" subtitle="People with no blocking or warning flag">
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Ring value={health} color={health >= 90 ? C.mintDeep : health >= 70 ? C.glob : "#B0291F"} sub="on track" />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{health >= 90 ? "On track" : "Needs attention"}</Typography>
              <Typography variant="caption" color="text.secondary" component="div">PF {money(run.stat.PF || 0, "INR", { compact: true })} · ESI {money(run.stat.ESI || 0, "INR", { compact: true })}</Typography>
              <Typography variant="caption" color="text.secondary" component="div">PT {money(run.stat.PT || 0, "INR", { compact: true })} · TDS {money(run.stat.TDS || 0, "INR", { compact: true })} · LWF {money(run.stat.LWF || 0, "INR")}</Typography>
              <Typography variant="caption" color="text.secondary" component="div">Outside India (tax + social) {money(run.intlStat, "INR", { compact: true })}</Typography>
            </Box>
          </Stack>
        </SectionCard>
        <SectionCard title="Statutory deadlines" subtitle="Alerts go out 7, 3 and 1 day before" action={<Button size="small" onClick={() => navigate("/compliance-autopilot")}>All</Button>} noPad>
          {deadlines.map((d) => (
            <Stack key={`${d.country}-${d.name}`} direction="row" spacing={1.2} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", alignItems: "center" }}>
              <Box sx={{ width: 40, textAlign: "center", flexShrink: 0 }}><Typography sx={{ fontWeight: 800, color: d.daysLeft <= 3 ? C.glob : C.navy, lineHeight: 1 }}>{d.due.slice(8)}</Typography><Typography sx={{ fontSize: "0.58rem", color: "text.secondary" }}>{new Date(d.due).toLocaleString("en", { month: "short" })}</Typography></Box>
              <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{d.name}</Typography><Typography variant="caption" color="text.secondary" noWrap component="div">{d.countryName} · {d.authority}</Typography></Box>
              <Pill tone={d.daysLeft <= 3 ? "glob" : "navy"}>{d.daysLeft}d</Pill>
            </Stack>
          ))}
        </SectionCard>
        <SectionCard title="Recent runs" noPad>
          {(data.suite?.agentRuns || []).slice(0, 4).map((a) => (
            <Stack key={a.id} direction="row" sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", justifyContent: "space-between", alignItems: "center" }}>
              <Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{monthLabel(a.period)}</Typography><Typography variant="caption" color="text.secondary">{a.people} people · {a.minutes} min · {a.flags} flags</Typography></Box>
              <Box sx={{ textAlign: "right" }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{money(a.net_inr, "INR", { compact: true })}</Typography><StatusPill status={a.status} /></Box>
            </Stack>
          ))}
        </SectionCard>
      </Stack>
    </TwoCol>
    </>
  );
}

// ── Variable pay ────────────────────────────────────────────────────────────────
function VariableTab({ run, period }) {
  const { data, suiteDo, suiteCan, notifyToast } = useStore();
  const saved = data.suite?.variable?.[period] || {};
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(data.suite?.variable?.[period] || {}), [data.suite?.variable, period]);
  const canAct = suiteCan("variable");
  const set = (code, k, v) => setDraft((d) => ({ ...d, [code]: { hours: 0, hourly_rate: 0, ot_hours: 0, bonus: 0, commission: 0, note: "", ...(d[code] || {}), [k]: k === "note" ? v : Number(v) || 0 } }));
  function save() {
    const r = suiteDo("variable", (s) => { s.variable = { ...(s.variable || {}), [period]: draft }; }, { action: "VARIABLE_PAY_SAVE", details: `${period} · ${Object.keys(draft).length} people` });
    if (r.ok) notifyToast("Variable pay saved — the Payroll Agent will use it.");
  }
  async function onFile(f) {
    if (!f) return;
    const lines = (await f.text()).split(/\r?\n/).filter(Boolean).slice(1);
    const next = { ...draft };
    let n = 0;
    lines.forEach((l) => { const [code, hours, rate, ot, bonus, commission, note] = l.split(",").map((x) => x.trim()); if (data.employees.some((e) => e.employee_code === code)) { next[code] = { hours: +hours || 0, hourly_rate: +rate || 0, ot_hours: +ot || 0, bonus: +bonus || 0, commission: +commission || 0, note: note || "" }; n += 1; } });
    setDraft(next);
    notifyToast(`${n} row(s) loaded from ${f.name}. Review and save.`);
  }
  const fileRef = useRef(null);
  return (
    <SectionCard
      title={`Variable pay inputs · ${periodLabel(period)}`}
      subtitle="Hourly hours × rate, overtime hours (2× in India), one-off bonus and sales commission. Saved inputs feed straight into the run."
      action={<Stack direction="row" spacing={1}>
        <Button size="small" startIcon={<DownloadRounded />} onClick={() => downloadCsv("variable-pay-template.csv", ["employee_code", "hours", "hourly_rate", "ot_hours", "bonus", "commission", "note"], run.rows.map((r) => [r.e.employee_code, 0, 0, 0, 0, 0, ""]))}>Template</Button>
        <Button size="small" startIcon={<UploadFile />} onClick={() => fileRef.current?.click()} disabled={!canAct}>Upload CSV</Button>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <Button size="small" variant="contained" onClick={save} disabled={!canAct}>Save inputs</Button>
      </Stack>}
      noPad
    >
      <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Hours</TableCell><TableCell>Rate / h</TableCell><TableCell>OT hours</TableCell><TableCell>Bonus</TableCell><TableCell>Commission</TableCell><TableCell>Note</TableCell><TableCell align="right">This month</TableCell></TableRow></TableHead>
        <TableBody>{run.rows.map((r) => {
          const v = draft[r.e.employee_code] || {};
          const f = (k, w = 84) => <TextField size="small" type={k === "note" ? "text" : "number"} value={v[k] ?? (k === "note" ? "" : 0)} onChange={(e) => set(r.e.employee_code, k, e.target.value)} disabled={!canAct} sx={{ width: w }} slotProps={{ htmlInput: { min: 0 } }} />;
          return (
            <TableRow key={r.e.employee_code}><TableCell><PersonCell name={r.e.full_name} sub={`${r.code} · ${r.cur}`} /></TableCell>
              <TableCell>{f("hours", 70)}</TableCell><TableCell>{f("hourly_rate")}</TableCell><TableCell>{f("ot_hours", 70)}</TableCell><TableCell>{f("bonus", 96)}</TableCell><TableCell>{f("commission", 96)}</TableCell><TableCell>{f("note", 170)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{r.variable ? money(r.variable, r.cur) : "—"}</TableCell></TableRow>
          );
        })}</TableBody></Table></TableWrap>
    </SectionCard>
  );
}

// ── Bank payouts ────────────────────────────────────────────────────────────────
function PayoutsTab({ run, period }) {
  const { data, suiteDo, suiteCan, notifyToast } = useStore();
  const payouts = data.suite?.payouts || [];
  const canAct = suiteCan("payouts");
  const [utr, setUtr] = useState(null);
  function download(b) {
    downloadCsv(`${b.id}-${(BANK_FORMATS[b.country] || "bank").replace(/[^A-Za-z0-9]+/g, "-")}.csv`, ["#", "Beneficiary", "Bank", "Account", "IFSC / sort / routing", "Currency", "Amount", "Narration", "Email"], bankFileRows(run, b.country));
    if (b.status === "ready") suiteDo("payouts", (s) => { const p = s.payouts.find((x) => x.id === b.id); if (p) p.status = "sent"; }, { action: "BANK_FILE_SENT", details: `${b.id} · ${b.count} transfers` });
  }
  function markPaid() {
    suiteDo("payouts", (s, { now }) => { const p = s.payouts.find((x) => x.id === utr.id); if (p) Object.assign(p, { status: "paid", utr: utr.ref || `UTR${Date.now()}`, paid_at: now }); }, { action: "BANK_PAYOUT_PAID", details: `${utr.id} · ${utr.ref}` });
    notifyToast("Marked paid. Employees can see 'Credited' on their payslip.");
    setUtr(null);
  }
  const current = payouts.filter((p) => p.period === period);
  return (
    <Stack spacing={2}>
      {!current.length && <Alert severity="info" action={<Button size="small" href="#/payroll-agent">Open run</Button>}>Bank files for {monthLabel(period)} are created when the run is approved. Below: what will be paid, by bank format.</Alert>}
      <SectionCard title={`Payout batches · ${periodLabel(period)}`} subtitle="One file per country in the format its banks accept — direct bank transfer for every employee" noPad>
        <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Country</TableCell><TableCell>Bank file format</TableCell><TableCell align="right">Transfers</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell><TableCell align="right" /></TableRow></TableHead>
          <TableBody>{(current.length ? current : run.byCountry.map((b) => ({ id: `PREVIEW-${b.code}`, country: b.code, format: b.bank, count: b.people, amount: b.net, currency: b.cur, status: "draft" }))).map((b) => (
            <TableRow key={b.id}><TableCell>{COUNTRIES[b.country]?.name || b.country}</TableCell><TableCell>{b.format}</TableCell><TableCell align="right">{b.count}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{money(b.amount, b.currency)}</TableCell><TableCell><StatusPill status={b.status} /></TableCell>
              <TableCell align="right"><Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                <Button size="small" startIcon={<DownloadRounded />} onClick={() => download(b)}>{b.status === "ready" ? "Download & send" : "Download"}</Button>
                {b.status === "sent" && <Button size="small" variant="contained" disabled={!canAct} onClick={() => setUtr({ id: b.id, ref: "" })}>Mark paid</Button>}
              </Stack></TableCell></TableRow>
          ))}</TableBody></Table></TableWrap>
      </SectionCard>
      <SectionCard title="Payout history" noPad>
        <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Batch</TableCell><TableCell>Month</TableCell><TableCell>Bank</TableCell><TableCell align="right">Amount</TableCell><TableCell>Reference (UTR)</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
          <TableBody>{payouts.filter((p) => p.period !== period).map((p) => <TableRow key={p.id}><TableCell>{p.id}</TableCell><TableCell>{monthLabel(p.period)}</TableCell><TableCell>{p.bank}</TableCell><TableCell align="right">{money(p.amount, p.currency)}</TableCell><TableCell>{p.utr || "—"}</TableCell><TableCell><StatusPill status={p.status} /></TableCell></TableRow>)}</TableBody></Table></TableWrap>
      </SectionCard>
      <Dialog open={!!utr} onClose={() => setUtr(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm bank credit</DialogTitle>
        <DialogContent><TextField fullWidth label="Bank reference / UTR" value={utr?.ref || ""} onChange={(e) => setUtr({ ...utr, ref: e.target.value })} sx={{ mt: 1 }} /></DialogContent>
        <DialogActions><Button onClick={() => setUtr(null)}>Cancel</Button><Button variant="contained" onClick={markPaid}>Mark paid</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}

// ── Filings & year-end ──────────────────────────────────────────────────────────
function FilingsTab({ run }) {
  const { data, suiteDo, suiteCan, notifyToast } = useStore();
  const navigate = useNavigate();
  const canAct = suiteCan("filings");
  const filings = data.suite?.filings || [];
  const deadlines = allDeadlines(data);
  const [country, setCountry] = useState("IN");
  const codes = run.byCountry.map((b) => b.code);
  const people = run.rows.filter((r) => r.code === country);
  function generate(form) {
    const rows = people.map((r) => {
      const d = Object.fromEntries((r.pay?.deductions || []).map(([k, v]) => [k, v]));
      return [r.e.employee_code, r.e.full_name, r.e.pan || r.e.uan || "", r.cur, r.pay?.earned ?? 0, Object.values(d).reduce((s, v) => s + v, 0), r.pay?.net ?? 0, r.pay?.employerTotal ?? 0];
    });
    downloadCsv(`${country}-${form.replace(/[^A-Za-z0-9]+/g, "-")}-${run.period}.csv`, ["Code", "Name", "Tax / social ID", "Currency", "Wages", "Withheld", "Net", "Employer contribution"], rows);
    const r = suiteDo("filings", (s, { now }) => { s.filings = [{ id: `FIL-${Date.now()}`, country, form, period: run.period, status: "filed", filed_at: now, ack: `ACK-${country}-${Math.floor(Math.random() * 90000 + 10000)}` }, ...(s.filings || []).filter((f) => !(f.country === country && f.form === form && f.period === run.period))]; }, { action: "STATUTORY_FILING", details: `${country} · ${form} · ${run.period}` });
    if (r.ok) notifyToast(`${form} generated and marked filed.`);
  }
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {codes.map((c) => <Button key={c} size="small" variant={c === country ? "contained" : "outlined"} onClick={() => setCountry(c)}>{COUNTRIES[c]?.name || c}</Button>)}
      </Stack>
      <SectionCard title={`Returns & year-end forms · ${COUNTRIES[country]?.name}`} subtitle={`${people.length} employee(s). Each file is built from this month's run — no manual work.`} noPad>
        <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Form</TableCell><TableCell>Frequency</TableCell><TableCell>What</TableCell><TableCell>Next due</TableCell><TableCell>Last filed</TableCell><TableCell align="right" /></TableRow></TableHead>
          <TableBody>{formsFor(country).map(([form, freq, what]) => {
            const last = filings.find((f) => f.country === country && f.form === form && f.status === "filed");
            const due = deadlines.find((d) => d.country === country && d.name.toLowerCase().includes(form.split(" ")[0].toLowerCase()));
            return (
              <TableRow key={form}><TableCell sx={{ fontWeight: 600 }}>{form}</TableCell><TableCell>{freq}</TableCell><TableCell>{what}</TableCell><TableCell>{due ? `${fmtDate(due.due)} (${due.daysLeft}d)` : "—"}</TableCell><TableCell>{last ? `${monthLabel(last.period)} · ${last.ack}` : "—"}</TableCell>
                <TableCell align="right">{/Form 16|130/.test(form) ? <Button size="small" onClick={() => navigate("/payroll?tab=form16")}>Open Form 16</Button> : <Button size="small" variant="outlined" startIcon={<SendRounded />} disabled={!canAct} onClick={() => generate(form)}>Generate & file</Button>}</TableCell></TableRow>
            );
          })}</TableBody></Table></TableWrap>
      </SectionCard>
      <SectionCard title="Filing history" noPad>
        <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Country</TableCell><TableCell>Form</TableCell><TableCell>Period</TableCell><TableCell>Filed</TableCell><TableCell>Acknowledgement</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
          <TableBody>{filings.slice(0, 20).map((f) => <TableRow key={f.id}><TableCell>{f.country}</TableCell><TableCell>{f.form}</TableCell><TableCell>{monthLabel(f.period)}</TableCell><TableCell>{f.filed_at ? fmtDateTime(f.filed_at) : "—"}</TableCell><TableCell>{f.ack || "—"}</TableCell><TableCell><StatusPill status={f.status} /></TableCell></TableRow>)}</TableBody></Table></TableWrap>
      </SectionCard>
    </Stack>
  );
}

// ── Global & FX ─────────────────────────────────────────────────────────────────
function GlobalTab({ run }) {
  const { data } = useStore();
  const [base, setBase] = useState("INR");
  const fx = data.fx || { INR: 1 };
  const conv = (inr) => inr / (fx[base] || 1);
  const max = Math.max(1, ...run.byCountry.map((b) => b.inrCost));
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <TextField select size="small" label="Report in" value={base} onChange={(e) => setBase(e.target.value)} sx={{ width: 160 }}>{["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
        <Typography variant="body2" color="text.secondary">Total employer cost <b>{money(conv(run.totals.cost), base, { compact: true })}</b> · net <b>{money(conv(run.totals.net), base, { compact: true })}</b> · {run.byCountry.length} countries, one system.</Typography>
      </Stack>
      <SectionCard title="Payroll by country" subtitle="Each country is computed by its own engine, then converted at today's rate" noPad>
        <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Country</TableCell><TableCell align="right">People</TableCell><TableCell>Currency</TableCell><TableCell align="right">Net (local)</TableCell><TableCell align="right">Employer cost (local)</TableCell><TableCell align="right">Rate → ₹</TableCell><TableCell align="right">Cost ({base})</TableCell><TableCell sx={{ width: 160 }}>Share</TableCell></TableRow></TableHead>
          <TableBody>{run.byCountry.map((b) => (
            <TableRow key={b.code}><TableCell>{b.name}</TableCell><TableCell align="right">{b.people}</TableCell><TableCell>{b.cur}</TableCell><TableCell align="right">{money(b.net, b.cur)}</TableCell><TableCell align="right">{money(b.cost, b.cur)}</TableCell><TableCell align="right">{fx[b.cur] ?? "—"}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{money(conv(b.inrCost), base)}</TableCell>
              <TableCell><Progress value={(b.inrCost / max) * 100} color={b.code === "IN" ? C.navy : C.glob} right=" " /></TableCell></TableRow>
          ))}</TableBody></Table></TableWrap>
      </SectionCard>
    </Stack>
  );
}

// v10.6 · Which data the Payroll Agent takes, with live counts for this month — so Finance can check every input.
function PayrollDataSources({ run, period }) {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const from = `${period}-01`;
  const appr = (t) => data.requests.filter((r) => r.type === t && ["Approved", "Disbursed", "Paid"].includes(r.status) && String(r.created_at || r.from_date || "").slice(0, 7) <= period);
  const leaves = data.requests.filter((r) => r.type === "leave" && r.status === "Approved" && r.to_date >= from && r.from_date.slice(0, 7) <= period);
  const ts = (data.timesheets || []).filter((t) => String(t.week_start || "").slice(0, 7) === period && ["approved", "paid"].includes(t.status));
  const bankChanges = (data.suite?.selfReq || []).filter((q) => q.type === "bank" && q.status === "approved");
  const rows = [
    ["Employee master", "People & organisation → Employee database", `${data.employees.filter((e) => e.status === "active").length} active · gross, grade, bank, PAN, UAN, tax regime`],
    ["Attendance punches", "Time & workforce → Time & attendance", `${data.punches.filter((p) => p.ts.slice(0, 7) === period).length} punches this month · present days, late marks, overtime`],
    ["Approved leave & LOP", "Leave (approved) · balance exhausted = LOP", `${leaves.length} leave requests · ${run.rows.reduce((s2, x) => s2 + x.lopDays, 0)} LOP days`],
    ["Variable pay", "Payroll Agent → Variable pay", `${run.rows.filter((x) => x.variable).length} people with bonus / commission / OT / hourly`],
    ["Contractor timesheets", "Contract management → Timesheets (HR approved → Finance)", `${ts.length} approved timesheet(s) this month`],
    ["Expense reimbursements", "Expense hub (approved claims)", `${appr("expense").length} approved claims`],
    ["Advances & loan EMIs", "Pay & benefits → recoveries", `${appr("advance").length} advances · ${appr("loan").length} loans`],
    ["Statutory set-up", "Payroll entities & tax (per company / location)", "PF, ESI, PT, LWF, TDS rules from the registration of each location"],
    ["Bank-detail changes", "Inbox → Employee requests (HR approved)", `${bankChanges.length} change(s) applied`],
    ["Last month's run", "Payroll pre-check (variance > 10% flagged)", `${run.warns.length} warning(s) · ${run.errors.length} error(s)`],
  ];
  return (
    <SectionCard title="Data taken for this payroll" subtitle={`${rows.length} sources · live counts for ${monthLabel(period)}`} action={<Button size="small" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show all"}</Button>} noPad>
      {(open ? rows : rows.slice(0, 4)).map(([what, where, n]) => (
        <Stack key={what} direction={{ xs: "column", md: "row" }} spacing={1} sx={{ px: 2, py: 0.9, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="body2" sx={{ fontWeight: 700, width: { md: 190 } }}>{what}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{where}</Typography>
          <Typography variant="body2" sx={{ width: { md: 300 }, textAlign: { md: "right" } }}>{n}</Typography>
        </Stack>
      ))}
    </SectionCard>
  );
}

// v10.6 · Two payroll runs a month: Run 1 = regular payroll (the agent above); Run 2 = off-cycle / supplementary run
// for arrears, joiners after cut-off, full & final settlements, bonus and corrections.
function PayrollRuns({ period, run, saved, canAct }) {
  const { data, suiteDo, notifyToast } = useStore();
  const off = (data.suite?.offCycleRuns || []).filter((r) => r.period === period);
  const [f, setF] = useState({ reason: "Arrears & corrections", people: "", amount: "" });
  const [show, setShow] = useState(false);
  function create() {
    if (!(Number(f.people) > 0) || !(Number(f.amount) > 0)) return notifyToast("Enter the number of people and the amount.", "error");
    const r = suiteDo("payroll", (s, { now, code }) => { s.offCycleRuns = [{ id: `RUN2-${period}-${(s.offCycleRuns || []).filter((x) => x.period === period).length + 1}`, period, reason: f.reason, people: Number(f.people), amount: Number(f.amount), status: "draft", by: code, at: now }, ...(s.offCycleRuns || [])]; }, { action: "PAYROLL_RUN2_CREATE", details: `${period} · ${f.reason}` });
    if (r.ok) { notifyToast("Run 2 created as a draft."); setShow(false); }
  }
  const approve = (id) => suiteDo("payroll", (s, { now }) => { const x = s.offCycleRuns.find((y) => y.id === id); x.status = "approved"; x.approved_at = now; }, { action: "PAYROLL_RUN2_APPROVE", details: id });
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5, mb: 2 }}>
      <Card sx={{ p: 1.8, borderLeft: "5px solid #1F9D63" }}>
        <Typography sx={{ fontSize: "0.58rem", fontWeight: 800, letterSpacing: "1px", color: "#1F9D63" }}>RUN 1 · REGULAR PAYROLL</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>{run.totals.people} people · {money(run.totals.net, "INR", { compact: true })} net</Typography>
        <Typography variant="body2" color="text.secondary">Status: {saved ? String(saved.status).replace(/_/g, " ") : "not started"} · cut-off 25th</Typography>
      </Card>
      <Card sx={{ p: 1.8, borderLeft: "5px solid #F27C22" }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box>
            <Typography sx={{ fontSize: "0.58rem", fontWeight: 800, letterSpacing: "1px", color: "#F27C22" }}>RUN 2 · OFF-CYCLE / SUPPLEMENTARY</Typography>
            <Typography variant="body2" color="text.secondary">Arrears, late joiners, F&F, bonus and corrections after the regular run.</Typography>
          </Box>
          <Button size="small" variant="outlined" disabled={!canAct} onClick={() => setShow(!show)}>New run 2</Button>
        </Stack>
        {show && <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1.2 }}>
          <ListSelect listKey="offcycle_reason" size="small" blank={false} fullWidth={false} label="Reason" value={f.reason} onChange={(v) => setF({ ...f, reason: v })} sx={{ minWidth: 190 }} />
          <TextField size="small" type="number" label="People" value={f.people} onChange={(e) => setF({ ...f, people: e.target.value })} sx={{ width: 90 }} />
          <TextField size="small" type="number" label="Net (₹)" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} sx={{ width: 130 }} />
          <Button variant="contained" onClick={create}>Create</Button>
        </Stack>}
        {off.map((r) => <Stack key={r.id} direction="row" spacing={1} sx={{ mt: 1, alignItems: "center" }}><Typography variant="body2" sx={{ flex: 1 }}><b>{r.id}</b> · {r.reason} · {r.people} people · {money(r.amount, "INR")}</Typography><Pill tone={r.status === "approved" ? "mint" : "warn"}>{r.status}</Pill>{r.status === "draft" && canAct && <Button size="small" onClick={() => approve(r.id)}>Approve</Button>}</Stack>)}
      </Card>
    </Box>
  );
}
