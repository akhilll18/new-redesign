// Payslips: employee "My pay", and the HR → Finance → Super Admin workflow (runs, fields, upload format, email outbox, settings).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, Radio, RadioGroup, Select, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { CloseRounded, PrintRounded, DownloadRounded, UploadFileRounded, AddRounded, SendRounded, CheckRounded, BlockRounded, DeleteOutlineRounded, MailOutlineRounded, EditRounded, PlayArrowRounded, OutboxRounded, ReplayRounded, VisibilityOffRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap, Mono, EmptyState, ConfirmDialog } from "../kit/UI.jsx";
import PayslipDocument, { PRINT_CSS, payslipStandaloneHtml, payslipYtd } from "./PayslipDocument.jsx";
import PayslipDesigner from "./PayslipDesigner.jsx";
import { SECTIONS, FIELD_TYPES, activeComponents, templateColumns, validateUpload, payslipTotals, periodLabel, toCsv, DAY_COLUMNS } from "../../data/payslipFields.js";
import { indiaPayslipRow } from "../../lib/payslipGen.js";
import { localPayslipRow } from "../../lib/statutory.js";
import { COUNTRIES as ENGINE_COUNTRIES } from "../../lib/payroll/index.js";
const COUNTRY_CUR = Object.fromEntries(Object.entries(ENGINE_COUNTRIES).map(([k, v]) => [k, v.currency]));
import { payContext } from "./PayViews.jsx";
import { fmtDateTime, isoDate, saveFile, readFileAsDataUrl } from "../../lib/utils.js";
import { AiInsight } from "../ai/AiInsight.jsx";
import { isContingent } from "../../data/employeeFields.js";

const inr = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// v10.3: an employee's own payslips are shown in their local currency.
const CUR_SYM = { INR: "₹", GBP: "£", USD: "$", EUR: "€", AED: "AED ", SGD: "S$", NAD: "N$", ZAR: "R ", KES: "KSh ", NGN: "₦", BWP: "P ", CAD: "C$", MXN: "MX$", BRL: "R$", SAR: "SAR ", MYR: "RM ", PHP: "₱", IDR: "Rp ", GHS: "GH₵", ZMW: "K " };
const money = (n, cur = "INR") => `${CUR_SYM[cur] || `${cur} `}${(Number(n) || 0).toLocaleString(cur === "INR" ? "en-IN" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUS_TONE = { Draft: "neutral", "Pending Finance": "warn", "Pending Super Admin": "warn", Approved: "info", Released: "good", Rejected: "bad" };
const STAGE_LABEL = { finance: "Waiting for Finance", super: "Waiting for Super Admin" };

function PrintStyle() {
  return <style>{PRINT_CSS}</style>;
}

function usePayslipRole() {
  const { user, data } = useStore();
  const admin = user.role === "admin" ? data.admins.find((a) => a.admin_code === user.code) : null;
  return {
    prepare: user.role === "superadmin" || !!admin?.modules.includes("payslips"),
    finance: !!admin?.modules.includes("payroll"),
    superAdmin: user.role === "superadmin",
    code: user.code,
  };
}

// Count of items waiting for this viewer (sidebar badge).
export function payslipWaiting(data, user) {
  const admin = user.role === "admin" ? data.admins.find((a) => a.admin_code === user.code) : null;
  const fin = !!admin?.modules.includes("payroll");
  const sup = user.role === "superadmin";
  const prep = sup || !!admin?.modules.includes("payslips");
  let n = 0;
  if (fin) n += data.payslipBatches.filter((b) => b.status === "Pending Finance" && b.created_by !== user.code).length + data.payslipComponents.filter((k) => k.stage === "finance" && k.proposed_by !== user.code).length;
  if (sup) n += data.payslipBatches.filter((b) => b.status === "Pending Super Admin").length + data.payslipComponents.filter((k) => k.stage === "super").length;
  if (prep) n += data.payslipBatches.filter((b) => b.status === "Approved").length;
  return n;
}

async function downloadSlip(slip, batch, company, notifyToast, data) {
  const r = await saveFile(`Payslip_${batch.period}_${slip.employee_code}.html`, payslipStandaloneHtml(slip, batch, company, data, data ? payslipYtd(data, slip.employee_code, batch.period) : undefined), "text/html");
  if (r?.declined) notifyToast("Download cancelled.", "info");
}

// ─────────────── Employee: My pay ───────────────
export function MyPayslips() {
  const { data, user, notifyToast } = useStore();
  const frame = useRef(null);
  const [params, setParams] = useSearchParams();
  const mine = data.payslipBatches.filter((b) => b.status === "Released").flatMap((b) => b.slips.filter((s) => s.employee_code === user.employee_code).map((s) => ({ s, b }))).sort((a, z) => z.b.period.localeCompare(a.b.period));
  const selId = params.get("slip") || mine[0]?.s.id;
  const sel = mine.find((m) => m.s.id === selId) || mine[0];
  const year = new Date().getFullYear();
  const ytd = mine.filter((m) => m.b.period.startsWith(String(year))).map((m) => payslipTotals(m.s.values, m.b.components));
  if (!mine.length) return <SectionCard><EmptyState title="No payslips yet" text="Your payslips appear here once HR releases them after Finance and Super Admin approval. You will also get an email." /></SectionCard>;
  const company = data.settings.payslip_company;
  const myCur = ENGINE_COUNTRIES[data.employees.find((e) => e.employee_code === user.employee_code)?.country_code || "IN"]?.currency || "INR";
  const cm = (n) => money(n, myCur);
  return (
    <Stack spacing={2.5}>
      <PrintStyle />
      <Grid min={170}>
        <StatCard label={`Net pay ${year} to date`} value={cm(ytd.reduce((s, t) => s + t.payable, 0))} tone="good" />
        <StatCard label="Gross earnings to date" value={cm(ytd.reduce((s, t) => s + t.gross, 0))} tone="info" />
        <StatCard label={myCur === "INR" ? "Tax deducted (TDS + PT) to date" : "Income tax deducted to date"} value={cm(ytd.reduce((s, t) => s + t.C, 0))} tone="neutral" />
        <StatCard label="Payslips" value={mine.length} tone="accent" />
      </Grid>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "260px 1fr" }, gap: 2.5, alignItems: "start" }}>
        <SectionCard title="Payslips" noPad>
          {mine.map(({ s, b }) => {
            const t = payslipTotals(s.values, b.components);
            const on = sel.s.id === s.id;
            return (
              <Box key={s.id} component="button" onClick={() => setParams({ slip: s.id })} sx={{ all: "unset", cursor: "pointer", display: "flex", justifyContent: "space-between", width: "100%", boxSizing: "border-box", px: 2, py: 1.3, borderBottom: "1px solid #e6ece5", background: on ? "#ebf3ec" : "transparent", "&:hover": { background: "#f8faf7" }, "&:focus-visible": { outline: "2px solid #244d3d" } }}>
                <Box>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{periodLabel(b.period)}</Typography>
                  <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>Released {fmtDateTime(b.released_at)}</Typography>
                </Box>
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{money(t.payable, s.currency || myCur)}</Typography>
              </Box>
            );
          })}
        </SectionCard>
        <Box>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", mb: 1.5 }}>
            <Button size="small" variant="outlined" startIcon={<PrintRounded />} onClick={() => frame.current?.print()}>Print / save as PDF</Button>
            <Button size="small" variant="contained" startIcon={<DownloadRounded />} onClick={() => downloadSlip(sel.s, sel.b, company, notifyToast, data)}>Download</Button>
          </Stack>
          <AiInsight title={`AI explains your ${periodLabel(sel.b.period)} payslip`} audience="the employee who owns this payslip; explain each deduction in plain words" sx={{ mb: 2 }} facts={payslipFacts(sel, mine)} />
          <PayslipDocument frameRef={frame} slip={sel.s} batch={sel.b} company={company} audience="employee" ytd={payslipYtd(data, user.employee_code, sel.b.period)} />
        </Box>
      </Box>
    </Stack>
  );
}

function payslipFacts(sel, mine) {
  const t = payslipTotals(sel.s.values, sel.b.components);
  const lines = activeComponents(sel.b.components).filter((c) => c.type === "amount" && Number(sel.s.values[c.code]));
  const i = mine.findIndex((m) => m.s.id === sel.s.id);
  const prev = mine[i + 1];
  const facts = [`Net pay credited ₹${t.payable} for ${periodLabel(sel.b.period)} (gross earnings ₹${t.gross}, deductions ₹${t.deductions}${t.R ? `, reimbursements ₹${t.R}` : ""})`];
  lines.forEach((c) => facts.push(`${c.label} (${c.section}): ₹${sel.s.values[c.code]}`));
  ["paid_days", "lop_days", "working_days", "days_paid", "lop"].forEach((k) => sel.s.values[k] != null && sel.s.values[k] !== "" && facts.push(`${k.replace(/_/g, " ")}: ${sel.s.values[k]}`));
  if (prev) {
    const p = payslipTotals(prev.s.values, prev.b.components);
    const d = Math.round((t.payable - p.payable) * 100) / 100;
    facts.push(d === 0 ? `Net pay is the same as ${periodLabel(prev.b.period)}` : `Net pay is ₹${Math.abs(d)} ${d > 0 ? "higher" : "lower"} than ${periodLabel(prev.b.period)} (₹${p.payable})`);
  }
  return facts;
}

// ─────────────── Admin / Finance / Super Admin ───────────────
export function PayslipsAdminPage() {
  const role = usePayslipRole();
  const [params, setParams] = useSearchParams();
  // v10.6: merged tabs — runs + email outbox, fields + upload format, design + settings (old ?tab= links still work).
  const MERGE = { outbox: "runs", format: "fields", settings: "design" };
  const raw = params.get("tab") || "runs";
  const tab = MERGE[raw] || raw;
  const set = (t) => setParams({ tab: t });
  const canDesign = role.prepare || role.finance || role.superAdmin;
  const H = ({ children }) => <Typography sx={{  fontWeight: 800, fontSize: "0.86rem", color: "#17404D", mt: 3, mb: 1.2 }}>{children}</Typography>;
  return (
    <>
      <PrintStyle />
      <Box sx={{ mb: 2, borderBottom: "1px solid #e5eae4" }}>
        <Tabs value={tab} onChange={(_, v) => set(v)} variant="scrollable" allowScrollButtonsMobile>
          <Tab value="runs" label="Payslip runs & email outbox" sx={{ fontSize: "0.7rem" }} />
          <Tab value="fields" label="Payslip fields & upload format" sx={{ fontSize: "0.7rem" }} />
          {canDesign && <Tab value="design" label="Payslip design & settings" sx={{ fontSize: "0.7rem" }} />}
        </Tabs>
      </Box>
      {tab === "runs" && <><RunsTab role={role} /><H>Email outbox</H><OutboxTab role={role} /></>}
      {tab === "fields" && <><FieldsTab role={role} /><H>Upload format</H><FormatTab /></>}
      {tab === "design" && canDesign && <><PayslipDesigner />{(role.prepare || role.superAdmin) && <><H>Payslip settings</H><SettingsTab role={role} /></>}</>}
    </>
  );
}

function Chain({ b }) {
  const steps = [
    ["Prepared (HR)", b.created_by, true],
    ["Finance", b.finance_by, ["Pending Super Admin", "Approved", "Released"].includes(b.status)],
    ["Super Admin", b.super_by, ["Approved", "Released"].includes(b.status)],
    ["Released & emailed", b.released_by, b.status === "Released"],
  ];
  const current = { Draft: 0, Rejected: -1, "Pending Finance": 1, "Pending Super Admin": 2, Approved: 3, Released: 4 }[b.status];
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      {steps.map(([l, who, done], i) => (
        <Box key={l} sx={{ flex: 1, p: 1, borderRadius: 1, border: "1px solid", borderColor: done ? "#b9dccb" : i === current ? "#e9c27c" : "#e5eae4", background: done ? "#eef7f2" : i === current ? "#fff7e8" : "#fafbf9" }}>
          <Typography sx={{ fontSize: "0.62rem", fontWeight: 800 }}>{l}</Typography>
          <Typography sx={{ fontSize: "0.58rem", color: "#66716a" }}>{done ? who || "Done" : i === current ? "Waiting" : "—"}</Typography>
        </Box>
      ))}
    </Stack>
  );
}

function RunsTab({ role }) {
  const { data } = useStore();
  const [open, setOpen] = useState(null);
  const [gen, setGen] = useState(false);
  const batches = data.payslipBatches;
  const tot = (b) => b.slips.reduce((s, x) => s + payslipTotals(x.values, b.components).payable * ((data.fx || {})[x.currency] || 1), 0);
  const waiting = batches.filter((b) => (role.finance && b.status === "Pending Finance") || (role.superAdmin && b.status === "Pending Super Admin"));
  return (
    <Stack spacing={2.5}>
      <Grid min={160}>
        <StatCard label="Waiting for your approval" value={waiting.length} tone={waiting.length ? "warn" : "good"} />
        <StatCard label="Ready to release" value={batches.filter((b) => b.status === "Approved").length} tone="info" />
        <StatCard label="Released this year" value={batches.filter((b) => b.status === "Released" && b.period.startsWith(String(new Date().getFullYear()))).reduce((s, b) => s + b.slips.length, 0)} hint="payslips" tone="good" />
        <StatCard label="Emails sent" value={data.emails.length} tone="neutral" />
      </Grid>
      <Alert severity="info" sx={{ fontSize: "0.68rem" }}>
        HR prepares payslips from payroll or by uploading the CSV format → Finance approves → Super Admin approves → HR or Super Admin releases. On release, employees see the payslip under Pay & benefits → My payslips and are emailed. The person who prepares a run cannot approve it.
      </Alert>
      <SectionCard title="Payslip runs" action={role.prepare && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setGen(true)}>Generate payslips</Button>} noPad>
        {batches.length === 0 ? <EmptyState title="No payslip runs yet" text="Generate payslips from payroll or upload a file to start." /> : (
          <TableWrap>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead><TableRow><TableCell>Run</TableCell><TableCell>Month</TableCell><TableCell>Source</TableCell><TableCell align="right">People</TableCell><TableCell align="right">Total net payable</TableCell><TableCell>Prepared</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(b.id)}>
                    <TableCell><Mono>{b.id}</Mono></TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{periodLabel(b.period)}</TableCell>
                    <TableCell>{b.source === "upload" ? "Upload" : "Payroll"}</TableCell>
                    <TableCell align="right">{b.slips.length}</TableCell>
                    <TableCell align="right">{inr(tot(b))}</TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.64rem" }}>{b.created_by}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{fmtDateTime(b.created_at)}</Typography></TableCell>
                    <TableCell><Tag tone={STATUS_TONE[b.status]}>{b.status}</Tag></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
      {gen && <GenerateDialog onClose={() => setGen(false)} onCreated={(id) => { setGen(false); setOpen(id); }} />}
      <BatchDrawer id={open} role={role} onClose={() => setOpen(null)} />
    </Stack>
  );
}

function nextPeriodDefault() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function GenerateDialog({ onClose, onCreated }) {
  const { data, createBatch, notifyToast } = useStore();
  const [period, setPeriod] = useState(nextPeriodDefault());
  const [method, setMethod] = useState("payroll");
  const [twd, setTwd] = useState(30);
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState(null);
  const fileRef = useRef(null);
  const taken = new Set(data.payslipBatches.filter((b) => b.period === period && b.status !== "Rejected").flatMap((b) => b.slips.map((s) => s.employee_code)));
  // v10.3: every country — India from the India engine, everyone else from their own country engine in local currency.
  // v10.6: choose who this run is for — regular employees, contract workers paid through payroll, or both.
  const [scope, setScope] = useState("regular");
  const inScope = (e) => (scope === "regular" ? !isContingent(e) : scope === "contract" ? isContingent(e) && e.payment_route !== "invoice" && e.worker_type !== "agency" : !isContingent(e) || (e.payment_route !== "invoice" && e.worker_type !== "agency"));
  const india = data.employees.filter((e) => e.status === "active" && inScope(e));
  const contingentN = data.employees.filter((e) => e.status === "active" && isContingent(e)).length;
  const eligible = india.filter((e) => !taken.has(e.employee_code));
  const sel = picked || new Set(eligible.map((e) => e.employee_code));
  useEffect(() => { setPicked(null); setResult(null); }, [period, scope]);

  const payrollRows = () =>
    eligible.filter((e) => sel.has(e.employee_code)).map((e) => {
      const ctx = payContext(data, e);
      if ((e.country_code || "IN") !== "IN") {
        try { return localPayslipRow(e, { period, lopDays: ctx.lopDays || 0, otPay: ctx.otPay || 0 }); } catch { return null; }
      }
      return indiaPayslipRow(e, { period, totalWorkingDays: Number(twd) || 30, lopDays: ctx.lopDays, otPay: ctx.otPay });
    }).filter(Boolean);

  function validate() {
    setErr("");
    const r = validateUpload(text, { components: data.payslipComponents, employees: data.employees, period });
    setResult(r);
  }
  async function onFile(f) {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return setErr("Upload a .csv file. In Excel use File → Save As → CSV UTF-8.");
    if (f.size > 1024 * 1024) return setErr("The file is larger than 1 MB.");
    const t = await f.text();
    setText(t);
    setResult(validateUpload(t, { components: data.payslipComponents, employees: data.employees, period }));
  }
  function create() {
    const rows = method === "payroll" ? payrollRows() : result?.rows || [];
    if (method === "upload" && (!result || result.errors.length)) return setErr("Fix the errors in the file first.");
    const r = createBatch({ period, source: method, rows });
    if (!r.ok) return setErr(r.error);
    notifyToast(`Draft run ${r.id} created with ${rows.length} payslip(s). Review it, then send it to Finance.`);
    onCreated(r.id);
  }
  const preview = method === "payroll" ? payrollRows().slice(0, 50) : result?.rows || [];
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Generate payslips</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField size="small" type="month" label="Pay month" value={period} onChange={(e) => setPeriod(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField select size="small" label="Payslips for" value={scope} onChange={(e) => setScope(e.target.value)} sx={{ minWidth: 220 }}>
              <MenuItem value="regular">Regular employees only</MenuItem>
              <MenuItem value="contract">Contract workers (paid through payroll)</MenuItem>
              <MenuItem value="both">Both</MenuItem>
            </TextField>
            <RadioGroup row value={method} onChange={(e) => { setMethod(e.target.value); setResult(null); setErr(""); }}>
              <FormControlLabel value="payroll" control={<Radio size="small" />} label={<Typography variant="body2">From payroll (each country’s engine)</Typography>} />
              <FormControlLabel value="upload" control={<Radio size="small" />} label={<Typography variant="body2">Upload file (any country)</Typography>} />
            </RadioGroup>
          </Stack>
          {method === "payroll" ? (
            <>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <TextField size="small" type="number" label="Total working days" value={twd} onChange={(e) => setTwd(e.target.value)} sx={{ width: 170 }} slotProps={{ htmlInput: { min: 1, max: 31 } }} />
                <Typography sx={{ fontSize: "0.62rem", color: "#66716a" }}>Loss-of-pay days come from approved LOP leave; overtime from punches (grades P1–P2). India: Basic 50%, HRA 40% of basic, PF, ESI, PT and TDS from the India engine. Other countries: gross, social security and income tax (PAYE / withholding) from their own engine, in local currency, with local line names.</Typography>
              </Stack>
              {contingentN > 0 && scope === "regular" && <Alert severity="info" sx={{ fontSize: "0.66rem" }}>{contingentN} contract worker(s) / intern(s) are paid from timesheets: their payslips come from Contract management → Contractor pay runs (posted runs appear here as draft runs).</Alert>}
              {taken.size > 0 && <Alert severity="warning" sx={{ fontSize: "0.66rem" }}>{taken.size} employee(s) already have a payslip for {periodLabel(period)} and are left out.</Alert>}
              <Box sx={{ maxHeight: 180, overflow: "auto", border: "1px solid #e5eae4", borderRadius: 1, p: 1, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" } }}>
                {eligible.map((e) => (
                  <FormControlLabel key={e.employee_code} sx={{ m: 0 }} control={<Checkbox size="small" checked={sel.has(e.employee_code)} onChange={(ev) => { const n = new Set(sel); ev.target.checked ? n.add(e.employee_code) : n.delete(e.employee_code); setPicked(n); }} />} label={<Typography sx={{ fontSize: "0.64rem" }}>{e.full_name} · {e.employee_code}{(e.country_code || "IN") !== "IN" ? ` · ${e.country_code} ${COUNTRY_CUR[e.country_code] || ""}` : ""}</Typography>} />
                ))}
                {eligible.length === 0 && <Typography sx={{ fontSize: "0.65rem", color: "#78827b" }}>Everyone already has a payslip for this month.</Typography>}
              </Box>
            </>
          ) : (
            <>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadTemplate(data, period, notifyToast)}>Download template (.csv)</Button>
                <Button size="small" variant="outlined" startIcon={<UploadFileRounded />} onClick={() => fileRef.current?.click()}>Choose CSV file</Button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
              </Stack>
              <TextField multiline minRows={4} maxRows={10} label="…or paste the CSV here" value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} slotProps={{ htmlInput: { style: {  fontSize: 12 } } }} placeholder={templateColumns(data.payslipComponents).join(",")} />
              <Box><Button size="small" variant="contained" onClick={validate} disabled={!text.trim()}>Check file</Button></Box>
              {result && (
                <>
                  {result.errors.length > 0 ? (
                    <Alert severity="error" sx={{ fontSize: "0.66rem" }}>
                      {result.errors.length} problem(s) — nothing was imported:
                      <Box component="ul" sx={{ m: 0, pl: 2 }}>{result.errors.slice(0, 12).map((x, i) => <li key={i}>Line {x.line}: {x.message}</li>)}</Box>
                      {result.errors.length > 12 && `…and ${result.errors.length - 12} more.`}
                    </Alert>
                  ) : <Alert severity="success" sx={{ fontSize: "0.66rem" }}>{result.rows.length} payslip(s) passed every check.</Alert>}
                  {result.warnings.map((w) => <Alert key={w} severity="warning" sx={{ fontSize: "0.64rem" }}>{w}</Alert>)}
                </>
              )}
            </>
          )}
          {preview.length > 0 && (
            <TableWrap>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead><TableRow><TableCell>Employee</TableCell><TableCell align="right">Days payable</TableCell><TableCell align="right">Earnings (A)</TableCell><TableCell align="right">Contrib. (B)</TableCell><TableCell align="right">Tax & ded. (C)</TableCell><TableCell align="right">Net payable</TableCell></TableRow></TableHead>
                <TableBody>
                  {preview.map((r) => {
                    const t = payslipTotals(r.values, data.payslipComponents);
                    const e = data.employees.find((x) => x.employee_code === r.employee_code);
                    return <TableRow key={r.employee_code}><TableCell><Typography sx={{ fontSize: "0.64rem", fontWeight: 600 }}>{e?.full_name}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{r.employee_code}</Typography></TableCell><TableCell align="right">{r.days_payable}</TableCell><TableCell align="right">{money(t.A, r.currency)}</TableCell><TableCell align="right">{money(t.B, r.currency)}</TableCell><TableCell align="right">{money(t.C, r.currency)}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{money(t.payable, r.currency)}</TableCell></TableRow>;
                  })}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={create} disabled={method === "payroll" ? sel.size === 0 || eligible.length === 0 : !result || result.errors.length > 0 || !result.rows.length}>Create draft run</Button>
      </DialogActions>
    </Dialog>
  );
}

async function downloadTemplate(data, period, notifyToast) {
  const cols = templateColumns(data.payslipComponents);
  const act = activeComponents(data.payslipComponents);
  const rows = data.employees.filter((e) => e.status === "active").map((e) => {
    const r = indiaPayslipRow(e, { period, totalWorkingDays: 30 });
    return cols.map((c) => (c === "employee_code" ? e.employee_code : DAY_COLUMNS.includes(c) ? r[c] : (e.country_code || "IN") === "IN" ? r.values[c] ?? "" : act.find((k) => k.code === c)?.type === "amount" ? "" : ""));
  });
  const res = await saveFile(`payslip-upload-${period}.csv`, `﻿${toCsv(cols, rows)}`, "text/csv;charset=utf-8");
  if (res?.declined) notifyToast("Download cancelled.", "info");
}

function DecideDialog({ open, title, needReason, showRelease, onClose, onConfirm }) {
  const [note, setNote] = useState("");
  const [release, setRelease] = useState(true);
  useEffect(() => { if (open) { setNote(""); setRelease(true); } }, [open]);
  return (
    <ConfirmDialog open={open} title={title} confirmLabel={needReason ? "Confirm rejection" : "Confirm approval"} tone={needReason ? "error" : "primary"} disabled={needReason && !note.trim()} onClose={onClose} onConfirm={() => onConfirm(note, release)}>
      <TextField fullWidth multiline minRows={2} size="small" label={needReason ? "Reason (required, sent to HR)" : "Note (optional)"} value={note} onChange={(e) => setNote(e.target.value)} sx={{ mt: 1 }} />
      {showRelease && <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={release} onChange={(e) => setRelease(e.target.checked)} />} label={<Typography variant="body2">Release now and email employees</Typography>} />}
    </ConfirmDialog>
  );
}

function BatchDrawer({ id, role, onClose }) {
  const { data, submitBatch, decideBatch, releaseBatch, deleteBatch, removeSlip, resendPayslipEmail, notifyToast } = useStore();
  const [slip, setSlip] = useState(null);
  const [dec, setDec] = useState(null);
  const slipFrame = useRef(null);
  const b = data.payslipBatches.find((x) => x.id === id);
  useEffect(() => { setSlip(null); }, [id]);
  if (!b) return null;
  const mineToApprove = b.created_by !== role.code && ((role.finance && b.status === "Pending Finance") || (role.superAdmin && b.status === "Pending Super Admin"));
  const editable = role.prepare && ["Draft", "Rejected"].includes(b.status);
  const tot = b.slips.reduce((acc, s) => { const t = payslipTotals(s.values, b.components); const fx = (data.fx || {})[s.currency] || 1; ["A", "B", "C", "R", "payable"].forEach((k) => { acc[k] += t[k] * fx; }); return acc; }, { A: 0, B: 0, C: 0, R: 0, payable: 0 });
  const mixed = b.slips.some((s) => s.currency && s.currency !== "INR");
  const run = (r, ok) => notifyToast(r.ok ? ok : r.error, r.ok ? "success" : "error");
  const sel = b.slips.find((s) => s.id === slip);
  return (
    <Drawer anchor="right" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", md: 900 } } } }}>
      <Stack direction="row" sx={{ alignItems: "center", px: 2.5, py: 1.5, borderBottom: "1px solid #edf0ec", gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h2">{b.id} · {periodLabel(b.period)}</Typography>
          <Typography sx={{ fontSize: "0.62rem", color: "#78827b" }}>{b.slips.length} payslip(s) · from {b.source === "upload" ? "upload" : "payroll"} · prepared by {b.created_by}</Typography>
        </Box>
        <Tag tone={STATUS_TONE[b.status]}>{b.status}</Tag>
        <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
      </Stack>
      <Stack spacing={2} sx={{ p: 2.5, overflow: "auto" }}>
        <Chain b={b} />
        {b.rejection && b.status === "Rejected" && <Alert severity="error">Rejected by {b.rejection.who} ({b.rejection.by}): {b.rejection.note}. Remove or fix payslips, then send it again.</Alert>}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          {editable && <Button size="small" variant="contained" startIcon={<SendRounded />} onClick={() => run(submitBatch(b.id), "Sent to Finance for approval.")}>Send to Finance</Button>}
          {editable && <Button size="small" color="error" variant="outlined" startIcon={<DeleteOutlineRounded />} onClick={() => { const r = deleteBatch(b.id); run(r, "Run deleted."); if (r.ok) onClose(); }}>Delete run</Button>}
          {mineToApprove && <Button size="small" variant="contained" startIcon={<CheckRounded />} onClick={() => setDec("approve")}>{b.status === "Pending Finance" ? "Approve (Finance)" : "Final approval"}</Button>}
          {mineToApprove && <Button size="small" color="error" variant="outlined" startIcon={<BlockRounded />} onClick={() => setDec("reject")}>Reject</Button>}
          {b.created_by === role.code && ["Pending Finance", "Pending Super Admin"].includes(b.status) && <Typography sx={{ fontSize: "0.62rem", color: "#78827b", alignSelf: "center" }}>You prepared this run, so another person approves it.</Typography>}
          {role.prepare && b.status === "Approved" && <Button size="small" variant="contained" color="secondary" startIcon={<PlayArrowRounded />} onClick={() => run(releaseBatch(b.id), `Released to ${b.slips.length} employee(s)${data.settings.payslip_email_on_release ? " and emailed" : ""}.`)}>Release & email employees</Button>}
        </Stack>
        <Grid min={130}>
          <StatCard label={mixed ? "Earnings (A) · ₹ equivalent" : "Earnings (A)"} value={inr(tot.A)} tone="info" />
          <StatCard label="Contributions (B)" value={inr(tot.B)} tone="neutral" />
          <StatCard label="Taxes & ded. (C)" value={inr(tot.C)} tone="neutral" />
          <StatCard label="Reimbursements" value={inr(tot.R)} tone="neutral" />
          <StatCard label="Net payable" value={inr(tot.payable)} tone="good" />
        </Grid>
        {sel ? (
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap" }} useFlexGap>
              <Button size="small" onClick={() => setSlip(null)}>← All payslips</Button>
              <Box sx={{ flex: 1 }} />
              <Button size="small" variant="outlined" startIcon={<PrintRounded />} onClick={() => slipFrame.current?.print()}>Print</Button>
              <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadSlip(sel, b, data.settings.payslip_company, notifyToast, data)}>Download</Button>
              {b.status === "Released" && role.prepare && <Button size="small" variant="outlined" startIcon={<ReplayRounded />} onClick={() => run(resendPayslipEmail(sel.id), `Email queued to ${sel.emp.email}.`)}>Resend email</Button>}
            </Stack>
            <PayslipDocument frameRef={slipFrame} slip={sel} batch={b} company={data.settings.payslip_company} audience="admin" maskAccount />
          </Box>
        ) : (
          <SectionCard title="Payslips in this run" subtitle="Open one to see it exactly as the employee will" noPad>
            <TableWrap>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead><TableRow><TableCell>Employee</TableCell><TableCell align="right">Days payable</TableCell><TableCell align="right">A</TableCell><TableCell align="right">B</TableCell><TableCell align="right">C</TableCell><TableCell align="right">Net payable</TableCell><TableCell>Email</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>
                  {b.slips.map((s) => {
                    const t = payslipTotals(s.values, b.components);
                    return (
                      <TableRow key={s.id} hover sx={{ cursor: "pointer" }} onClick={() => setSlip(s.id)}>
                        <TableCell><PersonCell name={s.emp.full_name} sub={`${s.employee_code} · ${s.emp.department}`} /></TableCell>
                        <TableCell align="right">{s.days_payable}</TableCell>
                        <TableCell align="right">{money(t.A, s.currency)}</TableCell>
                        <TableCell align="right">{money(t.B, s.currency)}</TableCell>
                        <TableCell align="right">{money(t.C, s.currency)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{money(t.payable, s.currency)}</TableCell>
                        <TableCell>{s.emailed_at ? <Tag tone="good">Sent</Tag> : <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{s.emp.email}</Typography>}</TableCell>
                        <TableCell align="right">{editable && <IconButton size="small" aria-label={`Remove ${s.emp.full_name}`} onClick={(ev) => { ev.stopPropagation(); run(removeSlip(b.id, s.id), "Payslip removed from the run."); }}><DeleteOutlineRounded fontSize="small" /></IconButton>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrap>
          </SectionCard>
        )}
        <SectionCard title="History">
          {b.history.map((h, i) => <Typography key={i} sx={{ fontSize: "0.64rem", py: 0.3 }}><b>{fmtDateTime(h.at)}</b> · {h.by} · {h.action}</Typography>)}
        </SectionCard>
      </Stack>
      <DecideDialog
        open={!!dec}
        title={dec === "reject" ? `Reject ${b.id}?` : b.status === "Pending Finance" ? `Approve ${b.id} for Finance?` : `Give final approval to ${b.id}?`}
        needReason={dec === "reject"}
        showRelease={dec === "approve" && b.status === "Pending Super Admin" && role.superAdmin}
        onClose={() => setDec(null)}
        onConfirm={(note, release) => { const r = decideBatch(b.id, dec, note, { release }); setDec(null); run(r, dec === "reject" ? "Run rejected and sent back to HR." : release && b.status === "Pending Super Admin" ? "Approved, released and emailed." : "Approved."); }}
      />
    </Drawer>
  );
}

// ─────────────── Fields ───────────────
const BLANK_FIELD = { code: "", label: "", section: "earning", type: "amount", required: false, visible: true, order: 10 };

function FieldsTab({ role }) {
  const { data, decideComponent, proposeComponent, notifyToast } = useStore();
  const [edit, setEdit] = useState(null);
  const [dec, setDec] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const list = data.payslipComponents.filter((k) => showAll || !["Rejected", "Retired"].includes(k.status));
  const canDecide = (k) => k.proposed_by !== role.code && ((k.stage === "finance" && role.finance) || (k.stage === "super" && role.superAdmin));
  const run = (r, ok) => notifyToast(r.ok ? ok : r.error, r.ok ? "success" : "error");
  return (
    <Stack spacing={2.5}>
      <Alert severity="info" sx={{ fontSize: "0.68rem" }}>
        These are the lines on every payslip (from your template: earnings, contributions, taxes & deductions, reimbursements) plus any extra detail fields. HR adds or changes a field → Finance approves → Super Admin approves → it becomes Active. “Required” means every payslip and every upload must include it; “Visible to employee” controls whether staff see it. Released payslips keep the fields they were approved with.
      </Alert>
      <SectionCard
        title="Payslip fields"
        action={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <FormControlLabel control={<Switch size="small" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />} label={<Typography sx={{ fontSize: "0.64rem" }}>Show retired / rejected</Typography>} />
            {role.prepare && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setEdit({ ...BLANK_FIELD, isNew: true })}>Add field</Button>}
          </Stack>
        }
        noPad
      >
        <TableWrap>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead><TableRow><TableCell>Code (upload column)</TableCell><TableCell>Label</TableCell><TableCell>Section</TableCell><TableCell>Type</TableCell><TableCell>Required</TableCell><TableCell>Visible</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {Object.keys(SECTIONS).flatMap((sec) => list.filter((k) => k.section === sec).sort((a, b) => a.order - b.order)).map((k) => (
                <TableRow key={k.code}>
                  <TableCell><Mono>{k.code}</Mono></TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.68rem", fontWeight: 700 }}>{k.label}</Typography>
                    {k.draft && k.status === "Active" && <Typography sx={{ fontSize: "0.58rem", color: "#a5671b" }}>{k.draft.retire ? "Proposed: retire" : `Proposed: ${k.draft.label} · ${SECTIONS[k.draft.section].label}${k.draft.required ? " · required" : ""}${k.draft.visible ? "" : " · hidden"}`}</Typography>}
                  </TableCell>
                  <TableCell>{SECTIONS[k.section].label}</TableCell>
                  <TableCell>{FIELD_TYPES.find(([v]) => v === k.type)?.[1]}</TableCell>
                  <TableCell>{k.required ? <Tag tone="info">Required</Tag> : "Optional"}</TableCell>
                  <TableCell>{k.visible ? "Yes" : <Stack direction="row" spacing={0.4} sx={{ alignItems: "center" }}><VisibilityOffRounded sx={{ fontSize: 14 }} /><span>Hidden</span></Stack>}</TableCell>
                  <TableCell>
                    <Tag tone={{ Active: "good", Pending: "warn", Rejected: "bad", Retired: "neutral" }[k.status]}>{k.status}</Tag>
                    {k.stage && <Typography sx={{ fontSize: "0.56rem", color: "#a5671b", mt: 0.3 }}>{STAGE_LABEL[k.stage]}</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {canDecide(k) && <Button size="small" startIcon={<CheckRounded />} onClick={() => setDec({ code: k.code, d: "approve" })}>Approve</Button>}
                    {canDecide(k) && <Button size="small" color="error" onClick={() => setDec({ code: k.code, d: "reject" })}>Reject</Button>}
                    {role.prepare && k.status === "Active" && !k.stage && <IconButton size="small" aria-label={`Change ${k.label}`} onClick={() => setEdit({ ...k })}><EditRounded fontSize="small" /></IconButton>}
                    {role.prepare && k.status === "Active" && !k.stage && <IconButton size="small" aria-label={`Retire ${k.label}`} onClick={() => run(proposeComponent({ ...k, retire: true }), `Retiring ${k.code} sent to Finance for approval.`)}><DeleteOutlineRounded fontSize="small" /></IconButton>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      {edit && <FieldDialog init={edit} onClose={() => setEdit(null)} />}
      <DecideDialog open={!!dec} title={dec?.d === "reject" ? `Reject change to ${dec?.code}?` : `Approve ${dec?.code}?`} needReason={dec?.d === "reject"} onClose={() => setDec(null)} onConfirm={(note) => { run(decideComponent(dec.code, dec.d, note), dec.d === "reject" ? "Change rejected." : "Approved."); setDec(null); }} />
    </Stack>
  );
}

function FieldDialog({ init, onClose }) {
  const { proposeComponent, notifyToast } = useStore();
  const [f, setF] = useState(init);
  const [err, setErr] = useState("");
  const amountSection = f.section !== "detail";
  function save() {
    const r = proposeComponent({ ...f, type: amountSection ? "amount" : f.type });
    if (!r.ok) return setErr(r.error);
    notifyToast(`${f.code.toUpperCase()} sent to Finance for approval.`);
    onClose();
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{init.isNew ? "Add a payslip field" : `Change ${init.code}`}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}
        <Stack spacing={1.8} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Code" value={f.code} disabled={!init.isNew} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} helperText="Becomes the upload column, e.g. NIGHT_ALW" sx={{ flex: 1 }} />
            <TextField size="small" label="Label on payslip" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} sx={{ flex: 2 }} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <FormControl size="small" fullWidth><InputLabel>Section</InputLabel><Select label="Section" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value, type: e.target.value === "detail" ? "text" : "amount" })}>{Object.entries(SECTIONS).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" fullWidth disabled={amountSection}><InputLabel>Type</InputLabel><Select label="Type" value={amountSection ? "amount" : f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{FIELD_TYPES.filter(([v]) => (amountSection ? v === "amount" : v !== "amount")).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</Select></FormControl>
            <TextField size="small" type="number" label="Order" value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })} sx={{ width: 110 }} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <FormControlLabel control={<Switch checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} />} label={<Typography variant="body2">Required on every payslip / upload</Typography>} />
            <FormControlLabel control={<Switch checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} />} label={<Typography variant="body2">Visible to employee</Typography>} />
          </Stack>
          <Alert severity="info" sx={{ fontSize: "0.64rem" }}>Saving sends this to Finance, then Super Admin. It is used on payslips only after both approve.</Alert>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={save}>Send for approval</Button></DialogActions>
    </Dialog>
  );
}

// ─────────────── Upload format ───────────────
function FormatTab() {
  const { data, notifyToast } = useStore();
  const act = activeComponents(data.payslipComponents);
  const cols = [
    ["employee_code", "Employee code from the employee master, e.g. EMP001", true, "EMP001"],
    ["actual_payable_days", "Actual payable days (0–31)", true, "30"],
    ["total_working_days", "Total working days in the month (1–31)", true, "30"],
    ["lop_days", "Loss of pay days (0 to total working days; decimals allowed)", true, "0"],
    ...act.map((k) => [k.code, `${k.label} · ${SECTIONS[k.section].label}${k.type === "amount" ? " · amount in ₹, no symbols" : ` · ${k.type}`}`, k.required, k.type === "amount" ? "0.00" : ""]),
  ];
  const sample = toCsv(cols.map((c) => c[0]), [cols.map((c) => c[3])]);
  return (
    <Stack spacing={2.5}>
      <SectionCard title="CSV upload format" subtitle="One row per employee. Name, bank, PAN, UAN and the other employee details are taken from the employee master, so they are not in the file." action={<Button size="small" variant="contained" startIcon={<DownloadRounded />} onClick={() => downloadTemplate(data, nextPeriodDefault(), notifyToast)}>Download template</Button>} noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 620 }}>
            <TableHead><TableRow><TableCell>Column</TableCell><TableCell>What to enter</TableCell><TableCell>Required</TableCell></TableRow></TableHead>
            <TableBody>{cols.map(([c, d, r]) => <TableRow key={c}><TableCell><Mono>{c}</Mono></TableCell><TableCell>{d}</TableCell><TableCell>{r ? <Tag tone="info">Required</Tag> : "Optional"}</TableCell></TableRow>)}</TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <SectionCard title="Rules checked on upload">
        <Box component="ul" sx={{ m: 0, pl: 2.2, fontSize: "0.68rem", lineHeight: 1.8 }}>
          <li>Header row must contain every required column; unknown columns are ignored with a warning.</li>
          <li>Every employee code must exist in the master and appear once; nobody may already have a payslip for that month in another run.</li>
          <li>Amounts must be numbers (commas allowed), not negative; deductions cannot exceed earnings.</li>
          <li>Totals are calculated, never uploaded: A = earnings, B = contributions, C = taxes & deductions, Net salary = A − B − C, Total net payable = net + reimbursements.</li>
          <li>Any error rejects the whole file, so a run is never half-imported. Save from Excel as “CSV UTF-8”. Maximum 1 MB.</li>
        </Box>
      </SectionCard>
      <SectionCard title="Example">
        <Box component="pre" sx={{ m: 0, p: 1.5, background: "#f4f6f3", borderRadius: 1, fontSize: 11, overflow: "auto" }}>{sample}</Box>
      </SectionCard>
    </Stack>
  );
}

// ─────────────── Email outbox ───────────────
function OutboxTab({ role }) {
  const { data } = useStore();
  const [open, setOpen] = useState(null);
  const sel = data.emails.find((m) => m.id === open);
  return (
    <Stack spacing={2.5}>
      <Alert severity="warning" sx={{ fontSize: "0.68rem" }}>
        This browser demo cannot send real email, so release puts each message here. When the backend is connected, <Mono>POST /api/v1/payslips/runs/:id/release</Mono> sends them through your mail server with the payslip PDF attached. Use “Open in mail app” to send one by hand now.
      </Alert>
      <SectionCard title={`Payslip emails (${data.emails.length})`} noPad>
        {data.emails.length === 0 ? <EmptyState title="No emails yet" text="Emails are queued when a payslip run is released." /> : (
          <TableWrap>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead><TableRow><TableCell>To</TableCell><TableCell>Subject</TableCell><TableCell>Run</TableCell><TableCell>Queued</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {data.emails.slice(0, 200).map((m) => (
                  <TableRow key={m.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(m.id)}>
                    <TableCell><PersonCell name={m.to_name} sub={m.to} /></TableCell>
                    <TableCell sx={{ maxWidth: 320 }}><Typography noWrap sx={{ fontSize: "0.66rem" }}>{m.subject}</Typography></TableCell>
                    <TableCell><Mono>{m.batch_id}</Mono></TableCell>
                    <TableCell>{fmtDateTime(m.at)}</TableCell>
                    <TableCell><Tag tone={m.status === "Sent" ? "good" : "info"}>{m.status}</Tag></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
      <Dialog open={!!sel} onClose={() => setOpen(null)} fullWidth maxWidth="sm">
        {sel && (
          <>
            <DialogTitle sx={{ fontSize: "0.9rem" }}>{sel.subject}</DialogTitle>
            <DialogContent>
              <Typography sx={{ fontSize: "0.64rem", color: "#66716a", mb: 1.5 }}>To {sel.to_name} &lt;{sel.to}&gt; · {fmtDateTime(sel.at)} · attachment Payslip_{sel.slip_id}.pdf</Typography>
              <Box sx={{ whiteSpace: "pre-wrap", fontSize: "0.72rem", p: 1.5, background: "#fbfdfb", borderRadius: 1 }}>{sel.body}</Box>
            </DialogContent>
            <DialogActions>
              <Button startIcon={<MailOutlineRounded />} href={`mailto:${encodeURIComponent(sel.to)}?subject=${encodeURIComponent(sel.subject)}&body=${encodeURIComponent(sel.body)}`} target="_blank" rel="noopener">Open in mail app</Button>
              <Button variant="contained" onClick={() => setOpen(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Stack>
  );
}

// ─────────────── Settings ───────────────
function SettingsTab({ role }) {
  const { data, updatePayslipSettings, notifyToast } = useStore();
  const st = data.settings;
  const [co, setCo] = useState({ ...st.payslip_company, address: st.payslip_company.address.join("\n") });
  const [mail, setMail] = useState({ on: st.payslip_email_on_release, subject: st.payslip_email_subject, body: st.payslip_email_body });
  const logoRef = useRef(null);
  const run = (r, ok) => notifyToast(r.ok ? ok : r.error, r.ok ? "success" : "error");
  return (
    <Stack spacing={2.5}>
      <SectionCard title="Company details on the payslip" subtitle={role.superAdmin ? "Shown at the top of every payslip" : "Only a Super Admin can change these"} action={role.superAdmin && <Button size="small" variant="contained" onClick={() => { if (!co.name.trim()) return notifyToast("Enter the company name.", "error"); run(updatePayslipSettings({ payslip_company: { ...co, name: co.name.trim(), address: co.address.split("\n").map((l) => l.trim()).filter(Boolean) } }), "Company details saved."); }}>Save</Button>}>
        <Stack spacing={1.6}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            {co.logo && <Box component="img" src={co.logo} alt="Logo" sx={{ height: 40 }} />}
            {role.superAdmin && <Button size="small" variant="outlined" onClick={() => logoRef.current?.click()}>Change logo</Button>}
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; if (f.size > 200 * 1024) return notifyToast("Use a logo under 200 KB.", "error"); setCo({ ...co, logo: await readFileAsDataUrl(f) }); }} />
          </Stack>
          <TextField size="small" label="Company name" value={co.name} disabled={!role.superAdmin} onChange={(e) => setCo({ ...co, name: e.target.value })} />
          <TextField size="small" multiline minRows={3} label="Address (one line per row)" value={co.address} disabled={!role.superAdmin} onChange={(e) => setCo({ ...co, address: e.target.value })} />
          <TextField size="small" label="Footer" value={co.footer} disabled={!role.superAdmin} onChange={(e) => setCo({ ...co, footer: e.target.value })} />
        </Stack>
      </SectionCard>
      <SectionCard title="Email to employees" subtitle="Placeholders: {name} {month} {net} {company}" action={<Button size="small" variant="contained" onClick={() => run(updatePayslipSettings({ payslip_email_on_release: mail.on, payslip_email_subject: mail.subject, payslip_email_body: mail.body }), "Email settings saved.")}>Save</Button>}>
        <Stack spacing={1.6}>
          <FormControlLabel control={<Switch checked={mail.on} onChange={(e) => setMail({ ...mail, on: e.target.checked })} />} label={<Typography variant="body2">Email each employee when payslips are released</Typography>} />
          <TextField size="small" label="Subject" value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
          <TextField size="small" multiline minRows={6} label="Message" value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} />
        </Stack>
      </SectionCard>
    </Stack>
  );
}
