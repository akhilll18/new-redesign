// Payroll reports (CSV) and the India salary TDS certificate: Form 16 up to FY 2025-26, Form 130 from tax year 2026-27.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Card, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, FormControl, IconButton, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { CloseRounded, DownloadRounded, VisibilityRounded, PublishRounded, DescriptionRounded } from "@mui/icons-material";
import { useStore } from "../../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap } from "../../kit/UI.jsx";
import { isoDate, fmtDate, downloadCsv } from "../../../lib/utils.js";
import { DEFAULT_COMPANY } from "../../../data/payslipFields.js";
import {
  ALL_GROUPS, groupEmployees, payFor, monthOf, addMonths, monthName, fmtMoney, curOf, ctryOf, toInr, loanSchedule, perkTaxable, PERK_TYPES, onPayrollIn,
  fyOf, fyOptions, fyLabel, certName, certLaw, certDue, taxCertificate, fyStart, competitiveness,
} from "../../../lib/payrollSuite.js";
import { usePayGroupState, canRunPayroll, ReadOnlyHint, Note } from "./shared.jsx";

// ── Reports ────────────────────────────────────────────
export function PayrollReports({ employees }) {
  const { data } = useStore();
  const { group, picker, inInr } = usePayGroupState(employees);
  const emps = groupEmployees(employees, group);
  const today = isoDate();
  const [month, setMonth] = useState(addMonths(monthOf(today), -1));
  const [preview, setPreview] = useState(null);
  const revisions = data.salaryRevisions || [];
  const fx = data.fx;
  const onRoll = emps.filter((e) => onPayrollIn(e, month));
  const cur = (e) => curOf(ctryOf(e));
  const P = (e, m = month) => payFor(e, m, revisions);
  const isIndia = group !== ALL_GROUPS && group.country === "IN";
  const indiaEmps = onRoll.filter((e) => ctryOf(e) === "IN");
  const emp = (c) => data.employees.find((e) => e.employee_code === c);
  const compName = (c) => data.paySettings.components.find((k) => k.code === c)?.name || c;

  const REPORTS = [
    ["register", "Payroll register", "Every employee's gross, LOP/OT, deductions, net pay, employer cost.", "All", () => [["Employee code", "Name", "Department", "Location", "Currency", "Gross", "Earned", "Deductions", "Net pay", "Employer contributions", "Cost to company"], onRoll.map((e) => { const p = P(e); return [e.employee_code, e.full_name, e.department, e.city, cur(e), p.gross, p.earned, p.deductions, p.net, p.employer, p.cost]; })]],
    ["bank", "Bank transfer statement", "Net pay with bank details for the salary upload file.", "All", () => [["Employee code", "Name", "Bank", "Account number", "IFSC / routing", "Currency", "Net pay", "Narration"], onRoll.map((e) => [e.employee_code, e.full_name, e.bank_name, e.bank_account || "", e.bank_ifsc || "", cur(e), P(e).net, `SALARY ${month}`])]],
    ["pf", "PF ECR summary", "UAN-wise EPF / EPS wages and contributions for the monthly ECR.", "IN", () => [["UAN", "Name", "Gross wages", "EPF wages", "EPS wages", "EE share (12%)", "EPS (8.33%)", "ER EPF (3.67%)"], indiaEmps.map((e) => { const p = P(e); const w = Math.min(p.gross * 0.5, 15000); return [e.uan, e.full_name, p.gross, Math.round(w), Math.round(w), p.pf, Math.round(w * 0.0833), p.pf - Math.round(w * 0.0833)]; })]],
    ["esi", "ESI contribution", "Employees covered by ESI (gross ≤ ₹21,000) with both shares.", "IN", () => [["Employee code", "Name", "Gross", "EE 0.75%", "ER 3.25%"], indiaEmps.filter((e) => P(e).esi > 0).map((e) => { const p = P(e); return [e.employee_code, e.full_name, p.gross, p.esi, Math.ceil(p.earned * 0.0325)]; })]],
    ["pt", "Professional tax", "Deductions by state for the PT return.", "IN", () => [["State", "Employee code", "Name", "Gross", "PT"], indiaEmps.map((e) => [e.region, e.employee_code, e.full_name, P(e).gross, P(e).pt])]],
    ["tds", "TDS on salary", "Monthly tax deducted per employee with PAN, for the quarterly return.", "IN", () => [["PAN", "Employee code", "Name", "Taxable salary", "TDS", "Regime"], indiaEmps.map((e) => [e.pan, e.employee_code, e.full_name, P(e).earned, P(e).tds, e.tax_regime || "new"])]],
    ["ctc", "Annual CTC", "Current annual cost to company per employee (₹).", "All", () => [["Employee code", "Name", "Department", "Grade", "Annual gross (₹)", "Annual employer cost (₹)", "Annual CTC (₹)"], onRoll.map((e) => { const p = P(e, monthOf(today)); return [e.employee_code, e.full_name, e.department, e.grade_code, Math.round(toInr(p.gross * 12, cur(e), fx)), Math.round(toInr(p.employer * 12, cur(e), fx)), Math.round(toInr(p.cost * 12, cur(e), fx))]; })]],
    ["variance", "Month-on-month variance", "Net pay change against the previous month; changes over 10% are flagged.", "All", () => [["Employee code", "Name", "Previous net", "This net", "Change", "Change %", "Flag"], onRoll.map((e) => { const a = onPayrollIn(e, addMonths(month, -1)) ? P(e, addMonths(month, -1)).net : 0; const b = P(e).net; const pct = a ? ((b - a) / a) * 100 : null; return [e.employee_code, e.full_name, a, b, Math.round(b - a), pct == null ? "New joiner" : pct.toFixed(1), pct == null || Math.abs(pct) > 10 ? "Check" : ""]; })]],
    ["dept", "Department cost summary", "Headcount and cost by department in ₹.", "All", () => { const m = {}; onRoll.forEach((e) => { const p = P(e); const k = e.department; m[k] = m[k] || [k, 0, 0, 0, 0]; m[k][1] += 1; m[k][2] += toInr(p.earned, cur(e), fx); m[k][3] += toInr(p.employer, cur(e), fx); m[k][4] += toInr(p.cost, cur(e), fx); }); return [["Department", "Headcount", "Gross (₹)", "Employer (₹)", "CTC (₹)"], Object.values(m).map((r) => r.map((v, i) => (i > 1 ? Math.round(v) : v)))]; }],
    ["loans", "Loan outstanding", "Principal, EMIs recovered and balance for every salary loan.", "All", () => [["Loan", "Employee code", "Name", "Principal", "EMI", "Recovered", "Outstanding"], data.requests.filter((r) => r.type === "loan" && r.status === "Disbursed").map((r) => { const s = loanSchedule(r, data.loanLedger?.[r.request_id]); return [r.request_id, r.employee_code, emp(r.employee_code)?.full_name, s.amount, s.emi, s.recovered, s.outstanding]; })]],
    ["claims", "Component claims register", "All flexible-benefit claims with status and payroll month.", "IN", () => [["Claim", "Employee code", "Name", "Component", "Bill date", "Amount", "Status", "Payroll month"], data.componentClaims.map((c) => [c.id, c.employee_code, emp(c.employee_code)?.full_name, compName(c.component), c.bill_date, c.amount, c.status, c.payroll_month || ""])]],
    ["perks", "Perquisites register", "Active perquisites and their monthly taxable value.", "IN", () => [["Perk", "Employee code", "Name", "Type", "From", "Taxable value / month"], data.perks.filter((p) => p.status === "active").map((p) => [p.id, p.employee_code, emp(p.employee_code)?.full_name, PERK_TYPES[p.type], p.from, perkTaxable(p, emp(p.employee_code), data.paySettings.perkRules)])]],
    ["revisions", "Salary revision history", "Every revision with old and new gross, effective date and status.", "All", () => [["Revision", "Employee code", "Name", "Old gross", "New gross", "Change %", "Effective", "Reason", "Status", "Arrears"], revisions.map((r) => [r.id, r.employee_code, emp(r.employee_code)?.full_name, r.old_gross, r.new_gross, r.pct, r.effective, r.reason, r.status, r.arrears || 0])]],
    ["compa", "Pay competitiveness", "Compa-ratio and market position (India bands).", "IN", () => [["Employee code", "Name", "Grade", "Gross", "Compa-ratio", "Position"], indiaEmps.map((e) => { const c = competitiveness(e, data.paySettings, fx); return [e.employee_code, e.full_name, e.grade_code, e.monthly_gross, c.compa?.toFixed(2) ?? "", c.position]; })]],
  ];
  const visible = REPORTS.filter((r) => r[3] === "All" || isIndia || inInr);
  const months = Array.from({ length: 13 }, (_, i) => addMonths(monthOf(today), -i));
  const file = (r) => `${r[0]}-${group === ALL_GROUPS ? "all" : group.country}-${month}.csv`;

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        {picker}
        <FormControl size="small" sx={{ minWidth: 180 }}><Select value={month} onChange={(e) => setMonth(e.target.value)} inputProps={{ "aria-label": "Month" }}>{months.map((m) => <MenuItem key={m} value={m}>{monthName(m, "long")}</MenuItem>)}</Select></FormControl>
      </Stack>
      {!isIndia && !inInr && <Alert severity="info">Statutory India reports (PF, ESI, PT, TDS) appear for the India pay group. Overseas filings are listed in the Compliance calendar.</Alert>}
      <Grid min={300}>
        {visible.map((r) => (
          <Card key={r[0]} sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><DescriptionRounded fontSize="small" color="primary" /><Typography variant="h3" sx={{ flex: 1 }}>{r[1]}</Typography>{r[3] === "IN" && <Tag tone="info">India</Tag>}</Stack>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{r[2]}</Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" startIcon={<VisibilityRounded />} onClick={() => setPreview(r)}>Preview</Button>
              <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => { const [h, rows] = r[4](); downloadCsv(file(r), h, rows); }}>CSV</Button>
            </Stack>
          </Card>
        ))}
      </Grid>
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="lg" fullWidth>
        {preview && (() => {
          const [h, rows] = preview[4]();
          return (
            <>
              <DialogTitle sx={{ fontWeight: 700 }}>{preview[1]} · {monthName(month, "long")}<Typography variant="caption" component="div" color="text.secondary">{rows.length} row(s){rows.length > 25 ? " · first 25 shown" : ""}</Typography></DialogTitle>
              <DialogContent dividers sx={{ p: 0 }}>
                <TableWrap><Table size="small"><TableHead><TableRow>{h.map((x) => <TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead><TableBody>{rows.slice(0, 25).map((row, i) => <TableRow key={i}>{row.map((v, j) => <TableCell key={j}>{typeof v === "number" ? v.toLocaleString("en-IN") : v}</TableCell>)}</TableRow>)}</TableBody></Table></TableWrap>
              </DialogContent>
              <DialogActions><Button onClick={() => setPreview(null)} color="inherit">Close</Button><Button variant="contained" startIcon={<DownloadRounded />} onClick={() => downloadCsv(file(preview), h, rows)}>Download CSV</Button></DialogActions>
            </>
          );
        })()}
      </Dialog>
    </Stack>
  );
}

// ── Form 16 / Form 130 ─────────────────────────────────
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
export function certHtml(c, statusLabel) {
  const e = c.e;
  const name = certName(c.fy);
  const row = (k, v, b) => `<tr><td>${k}</td><td style="text-align:right;${b ? "font-weight:700" : ""}">${v}</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name} ${c.fy} ${e.employee_code}</title><style>body{font-family:Arial,sans-serif;color:#202922;max-width:820px;margin:24px auto;font-size:13px}h1{font-size:18px;margin:0}h2{font-size:14px;margin:20px 0 6px;border-bottom:2px solid #244d3d;padding-bottom:4px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #dfe5df;padding:6px 8px;text-align:left}th{background:#f8faf7}.muted{color:#78827b;font-size:11px}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #dfe5df;padding-bottom:10px}</style></head><body>
<div class="head"><div><h1>${name}</h1><div class="muted">Certificate of tax deducted at source on salary · ${certLaw(c.fy)}</div></div><div style="text-align:right"><b>${statusLabel}</b><div class="muted">${fyStart(c.fy) >= 2026 ? "Tax year" : "Financial year"} ${c.fy} · ${fyStart(c.fy) >= 2026 ? "" : `AY ${fyStart(c.fy) + 1}-${String((fyStart(c.fy) + 2) % 100).padStart(2, "0")}`}</div></div></div>
<h2>Part A · Employer, employee and tax deposited</h2>
<table><tr><th>Employer</th><th>Employee</th></tr><tr><td><b>${DEFAULT_COMPANY.name}</b><br>${DEFAULT_COMPANY.address.join("<br>")}<br>TAN: <i>set in company settings</i></td><td><b>${e.full_name}</b> (${e.employee_code})<br>${e.designation}<br>PAN: ${e.pan || "—"}<br>Period with employer: ${c.rows[0] ? c.rows[0].month : "—"} to ${c.rows.length ? c.rows[c.rows.length - 1].month : "—"}</td></tr></table>
<table style="margin-top:8px"><tr><th>Quarter</th><th style="text-align:right">Salary paid</th><th style="text-align:right">Tax deducted &amp; deposited</th></tr>${c.quarters.map((q) => `<tr><td>${q.q}</td><td style="text-align:right">${inr(q.paid)}</td><td style="text-align:right">${inr(q.tds)}</td></tr>`).join("")}<tr><th>Total</th><th style="text-align:right">${inr(c.salary)}</th><th style="text-align:right">${inr(c.tds)}</th></tr></table>
<h2>Part B · Salary and tax computation (new regime)</h2>
<table>${row("Salary as per provisions (gross)", inr(c.salary))}${row("Value of perquisites", inr(c.perqs))}${row("Gross salary", inr(c.gross), true)}${row("Less: standard deduction", `−${inr(75000)}`)}${row("Income chargeable under the head Salaries", inr(c.tx.taxable), true)}${row("Tax on total income (slab rates)", inr(c.tx.slab))}${row("Less: rebate / marginal relief", `−${inr(c.tx.rebate)}`)}${row("Surcharge", inr(c.tx.sur))}${row("Health &amp; education cess (4%)", inr(c.tx.cess))}${row("Total tax payable", inr(c.tx.total), true)}${row("Tax deducted at source", inr(c.tds))}${row(c.balance >= 0 ? "Balance tax payable" : "Excess deducted (refund via return)", inr(Math.abs(c.balance)), true)}</table>
<p class="muted">Employee contributions for information: provident fund ${inr(c.pf)}, professional tax ${inr(c.pt)} (not deductible under the new regime). ${fyStart(c.fy) >= 2026 ? "Part C (detailed annexures) is generated from TRACES with the quarterly salary TDS return." : "Part A is to be downloaded from TRACES; this copy is generated from payroll for reconciliation."}</p>
<p class="muted">Generated by EZY HR on ${new Date().toLocaleDateString("en-IN")}. Verify against the TRACES-issued certificate before filing.</p></body></html>`;
}

export function Form16View({ employees }) {
  const { data, user, setTaxCertStatus, notifyToast } = useStore();
  const editable = canRunPayroll(user);
  const today = isoDate();
  const opts = fyOptions(today).slice(0, 2); // last year and this year
  const [fy, setFy] = useState(opts[0]);
  const [sel, setSel] = useState([]);
  const [view, setView] = useState(null);
  const india = employees.filter((e) => e.status === "active" && ctryOf(e) === "IN");
  const certs = data.taxCerts?.[fy] || {};
  const rows = useMemo(() => india.map((e) => ({ c: taxCertificate(e, fy, { revisions: data.salaryRevisions, perks: data.perks, perkRules: data.paySettings.perkRules, today }), st: certs[e.employee_code]?.status || "not_generated", meta: certs[e.employee_code] })).filter((r) => r.c.months > 0), [india.length, fy, data.salaryRevisions, data.perks, certs]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = certName(fy);
  const complete = rows[0]?.c.complete ?? false;
  const due = certDue(fy);
  const n = (st) => rows.filter((r) => r.st === st).length;
  const act = (codes, st) => { const r = setTaxCertStatus(fy, codes, st); notifyToast(r.ok ? `${r.count} ${name}(s) ${st}.` : r.error, r.ok ? "success" : "error"); if (r.ok) setSel([]); };
  const download = (r) => { const blob = new Blob([certHtml(r.c, r.st === "published" ? "Issued" : complete ? "Draft" : "Provisional")], { type: "text/html" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name.replace(" ", "")}-${fy}-${r.c.e.employee_code}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const stTag = (st) => <Tag tone={{ published: "good", generated: "info", not_generated: "neutral" }[st]}>{{ published: "Published", generated: "Generated", not_generated: "Not generated" }[st]}</Tag>;

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Box>
          <Typography variant="h2">{name} · {fyLabel(fy).replace("Financial Year", fyStart(fy) >= 2026 ? "Tax year" : "FY")}</Typography>
          <Typography variant="caption" color="text.secondary">{fyStart(fy) >= 2026 ? "Form 130 replaces Form 16 from tax year 2026-27 (Income-tax Act 2025)." : "Last year issued as Form 16 under the Income-tax Act 1961."} Issue to employees by {fmtDate(due)}.</Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 240 }}><Select value={fy} onChange={(e) => { setFy(e.target.value); setSel([]); }} inputProps={{ "aria-label": "Year" }}>{opts.map((f) => <MenuItem key={f} value={f}>{certName(f)} · {f}</MenuItem>)}</Select></FormControl>
      </Stack>
      {!complete && <Alert severity="info">The {fy} year is still running, so figures are provisional (salary to {monthName(addMonths(monthOf(today), -1), "long")}). You can generate previews now; publishing opens after March payroll is processed.</Alert>}
      <Grid min={180}>
        <StatCard label="Employees" value={rows.length} tone="accent" />
        <StatCard label="Not generated" value={n("not_generated")} tone="neutral" />
        <StatCard label="Generated" value={n("generated")} tone="info" />
        <StatCard label="Published" value={n("published")} tone="good" hint={complete && n("published") < rows.length ? `${rows.length - n("published")} to go · due ${fmtDate(due)}` : undefined} />
      </Grid>
      <SectionCard title={`${name} register`} noPad
        action={
          editable ? (
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" disabled={!sel.length} onClick={() => act(sel, "generated")}>Generate {sel.length || ""}</Button>
              <Button size="small" variant="contained" startIcon={<PublishRounded />} disabled={!sel.length || !complete} onClick={() => act(sel, "published")}>Publish {sel.length || ""}</Button>
              <Button size="small" startIcon={<DownloadRounded />} onClick={() => downloadCsv(`${name.replace(" ", "")}-${fy}-summary.csv`, ["Employee code", "Name", "PAN", "Months", "Gross salary", "Perquisites", "Taxable income", "Tax payable", "TDS", "Balance", "Status"], rows.map((r) => [r.c.e.employee_code, r.c.e.full_name, r.c.e.pan, r.c.months, r.c.salary, r.c.perqs, r.c.tx.taxable, r.c.tx.total, r.c.tds, r.c.balance, r.st]))}>Summary CSV</Button>
            </Stack>
          ) : <ReadOnlyHint />
        }>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 1080 }}>
            <TableHead><TableRow>{editable && <TableCell padding="checkbox"><Checkbox size="small" checked={sel.length > 0 && sel.length === rows.length} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.c.e.employee_code) : [])} /></TableCell>}<TableCell>Employee</TableCell><TableCell>PAN</TableCell><TableCell align="right">Months</TableCell><TableCell align="right">Gross salary</TableCell><TableCell align="right">Perquisites</TableCell><TableCell align="right">Taxable income</TableCell><TableCell align="right">Tax payable</TableCell><TableCell align="right">TDS deducted</TableCell><TableCell align="right">Balance</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.c.e.employee_code} hover>
                  {editable && <TableCell padding="checkbox"><Checkbox size="small" checked={sel.includes(r.c.e.employee_code)} onChange={(e) => setSel(e.target.checked ? [...sel, r.c.e.employee_code] : sel.filter((x) => x !== r.c.e.employee_code))} /></TableCell>}
                  <TableCell><PersonCell name={r.c.e.full_name} sub={r.c.e.employee_code} /></TableCell>
                  <TableCell>{r.c.e.pan || <Tag tone="bad">Missing</Tag>}</TableCell>
                  <TableCell align="right">{r.c.months}</TableCell>
                  <TableCell align="right">{fmtMoney(r.c.salary)}</TableCell>
                  <TableCell align="right">{r.c.perqs ? fmtMoney(r.c.perqs) : "—"}</TableCell>
                  <TableCell align="right">{fmtMoney(r.c.tx.taxable)}</TableCell>
                  <TableCell align="right">{fmtMoney(r.c.tx.total)}</TableCell>
                  <TableCell align="right">{fmtMoney(r.c.tds)}</TableCell>
                  <TableCell align="right" sx={{ color: Math.abs(r.c.balance) > 1000 ? "warning.main" : "text.secondary" }}>{r.c.balance === 0 ? "—" : `${r.c.balance > 0 ? "" : "−"}${fmtMoney(Math.abs(r.c.balance))}`}</TableCell>
                  <TableCell>{stTag(r.st)}{r.meta?.published_at && <Typography variant="caption" component="div" color="text.secondary">{fmtDate(r.meta.published_at)}</Typography>}</TableCell>
                  <TableCell><Stack direction="row" spacing={0.5}><IconButton size="small" aria-label="View" onClick={() => setView(r)}><VisibilityRounded fontSize="small" /></IconButton><IconButton size="small" aria-label="Download" onClick={() => download(r)}><DownloadRounded fontSize="small" /></IconButton></Stack></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        <Note>Balance = tax payable on the year's salary and perquisites minus TDS already deducted. A positive balance is usually recovered in the remaining months; the certificate itself must match the quarterly TDS return filed on TRACES.</Note>
      </SectionCard>
      <Drawer anchor="right" open={!!view} onClose={() => setView(null)} slotProps={{ paper: { sx: { width: { xs: "100%", md: 860 } } } }}>
        {view && (
          <>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="h2" sx={{ flex: 1 }}>{name} · {view.c.e.full_name}</Typography>
              <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => download(view)}>Download</Button>
              <IconButton onClick={() => setView(null)} aria-label="Close"><CloseRounded /></IconButton>
            </Stack>
            <Box component="iframe" title={`${name} preview`} srcDoc={certHtml(view.c, view.st === "published" ? "Issued" : complete ? "Draft" : "Provisional")} sx={{ border: 0, width: "100%", flex: 1, minHeight: "80vh" }} />
          </>
        )}
      </Drawer>
    </Stack>
  );
}

