// Contract management (v8.7) for HR, Finance and the Super Admin: overview, contracts register with the full lifecycle
// (draft → approval → e-sign → amend / renew / hold / terminate), timesheets & milestones, contractor pay runs that post into
// payslips and invoices, invoices & payments, staffing vendors, compliance alerts and settings.
// Reference: SAP Fieldglass work orders / SuccessFactors EC contingent workforce, Oracle HCM contingent worker assignments.
import { listOptions } from "../../lib/optionLists.js";
import React, { useMemo, useRef, useState } from "react";
import { useCountryFilter } from "../../country/CountryContext.jsx";
import { useSearchParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControl, FormControlLabel, IconButton, InputAdornment, InputLabel,
  LinearProgress, MenuItem, Select, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  AddRounded, CloseRounded, PrintRounded, DownloadRounded, SendRounded, CheckRounded, BlockRounded, EditRounded, AutorenewRounded, PauseRounded, PlayArrowRounded,
  StopCircleRounded, DescriptionRounded, NotificationsActiveRounded, SearchRounded, WarningAmberRounded, PaidRounded, DeleteOutlineRounded, OpenInNewRounded, VerifiedRounded,
} from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap, Mono, EmptyState, KeyVal, HBar, ConfirmDialog } from "../kit/UI.jsx";
import DocFrame from "../pay/DocFrame.jsx";
import { AiButton, AiResult, useAiRun } from "../collab/aiKit.jsx";
import {
  CONTRACT_STATUS, TS_STATUS, MS_STATUS, RUN_STATUS, INVOICE_STATUS, BILLING_CYCLES, WORK_LOCATIONS, AMENDMENT_TYPES, TERMINATION_REASONS, DEFAULT_CONTRACT_SETTINGS,
  contractState, daysLeft, rateText, money, timesheetTotals, timesheetValue, contractFlags, allContractFlags, contractSpend, contractHoursLogged, approverOf, addDays,
  chainOf, contractFromEmployee, currencyOf, weekDays, fillTemplate, contractVars, rateOn,
} from "../../lib/contracts.js";
import { contractDocumentHtml, invoiceHtml } from "../../lib/contractDocs.js";
import { adviceDesign } from "../../data/payslipDesign.js";
import { WORKER_TYPES, WORKER_TYPE_BY, PAY_BASIS, PAY_ROUTES, TDS_SECTIONS, RATE_UNIT, isContingent, workerTypeOf, SELF_EMPLOYED } from "../../data/employeeFields.js";
import { periodLabel } from "../../data/payslipFields.js";
import { fmtDate, fmtDateTime, isoDate, downloadCsv, saveFile } from "../../lib/utils.js";

const tabSx = { minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontSize: "0.7rem" } };
export const StateTag = ({ c, settings }) => { const st = contractState(c, settings); return <Tag tone={CONTRACT_STATUS[st]?.tone}>{CONTRACT_STATUS[st]?.label || st}</Tag>; };
const WTag = ({ type }) => <Tag tone={WORKER_TYPE_BY[type]?.tone || "neutral"}>{WORKER_TYPE_BY[type]?.short || type}</Tag>;
const ROUTE_LABEL = { payroll: "Payroll", invoice: "Invoice", vendor: "Vendor" };

export function useContractRole() {
  const { user, data } = useStore();
  const adm = user.role === "admin" ? data.admins.find((a) => a.admin_code === user.code) : null;
  const sup = user.role === "superadmin";
  return {
    manage: sup || !!adm?.modules.some((m) => ["contracts", "payroll"].includes(m)),
    approve: sup || ((data.contractSettings?.approval_by || "finance") === "finance" && !!adm?.modules.includes("payroll")),
    finance: sup || !!adm?.modules.includes("payroll"),
    super: sup,
    code: user.code,
  };
}
/** Sidebar badge: contracts waiting for this approver + high-severity alerts for HR. */
export function contractsWaiting(data, user) {
  const adm = user.role === "admin" ? data.admins.find((a) => a.admin_code === user.code) : null;
  const sup = user.role === "superadmin";
  const approve = sup || ((data.contractSettings?.approval_by || "finance") === "finance" && !!adm?.modules.includes("payroll"));
  let n = 0;
  if (approve) n += (data.contracts || []).filter((c) => c.status === "pending_approval" && c.created_by !== user.code).length + (data.contractRuns || []).filter((r) => r.status === "pending_approval" && r.created_by !== user.code).length;
  if (sup || adm?.modules.includes("contracts")) n += allContractFlags(data).filter((f) => f.level === "high").length;
  return n;
}

function useDocs() {
  const { data } = useStore();
  const company = data.settings.payslip_company;
  const design = adviceDesign(data);
  return { company, design, contractHtml: (c) => contractDocumentHtml(data, c, company, design), invoiceHtml: (i) => invoiceHtml(data, i, company, design) };
}

export function DocDialog({ open, title, html, filename, onClose }) {
  const ref = useRef(null);
  const { notifyToast } = useStore();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flex: 1 }}>{title}</Box>
        <Button size="small" variant="outlined" startIcon={<PrintRounded />} onClick={() => ref.current?.print()}>Print / PDF</Button>
        <Button size="small" variant="contained" startIcon={<DownloadRounded />} onClick={async () => { const r = await saveFile(filename, html, "text/html"); if (r?.declined) notifyToast("Download cancelled.", "info"); }}>Download</Button>
        <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ background: "#f8faf7", pt: 2 }}>{open && <DocFrame ref={ref} html={html} title={title} />}</DialogContent>
    </Dialog>
  );
}

// ═══════════════════════ Hub ═══════════════════════
const TABS0 = [["overview", "Overview"], ["contracts", "Contracts"], ["timesheets", "Timesheets & milestones"], ["pay", "Contractor pay runs"], ["invoices", "Invoices & payments"], ["vendors", "Staffing vendors"], ["compliance", "Compliance"], ["settings", "Settings"]];

export default function ContractsHub() {
  const [sp, setSp] = useSearchParams();
  const { user } = useStore();
  // v10.6: Finance doesn't work weekly timesheets — it sees only overtime that HR approved and sent on ("OT approvals").
  const isFinance = user.role === "admin" && adminKindOf106(user) === "finance";
  const TABS = TABS0.map((t) => (t[0] === "timesheets" && isFinance ? ["timesheets", "OT approvals (from HR)"] : t));
  const tab = TABS.some((t) => t[0] === sp.get("tab")) ? sp.get("tab") : "overview";
  const [open, setOpen] = useState(sp.get("id") || null);
  const go = (t) => setSp({ tab: t }, { replace: true });
  return (
    <>
      <Box sx={{ mb: 2.5, borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, v) => go(v)} variant="scrollable" allowScrollButtonsMobile sx={tabSx}>
          {TABS.map(([k, l]) => <Tab key={k} value={k} label={l} />)}
        </Tabs>
      </Box>
      {tab === "overview" && <OverviewTab onOpen={setOpen} go={go} />}
      {tab === "contracts" && <ContractsTab onOpen={setOpen} />}
      {tab === "timesheets" && (isFinance ? <OtFinanceQueue /> : <><OtFinanceQueue hrView /><TimesheetsTab onOpen={setOpen} /></>)}
      {tab === "pay" && <ContractPayRuns />}
      {tab === "invoices" && <InvoicesTab />}
      {tab === "vendors" && <><RaiseInvoiceGuide go={go} /><VendorsTab /></>}
      {tab === "compliance" && <ComplianceTab onOpen={setOpen} />}
      {tab === "settings" && <SettingsTab />}
      <ContractDrawer id={open} onClose={() => setOpen(null)} onOpen={setOpen} />
    </>
  );
}

// ─────────────── Overview ───────────────
function OverviewTab({ onOpen, go }) {
  const { data, nameOf } = useStore();
  const s = data.contractSettings || DEFAULT_CONTRACT_SETTINGS;
  const contracts = data.contracts || [];
  const live = contracts.filter((c) => ["active", "expiring", "upcoming"].includes(contractState(c, s)));
  const expiring = live.filter((c) => contractState(c, s) === "expiring").sort((a, b) => a.end_date.localeCompare(b.end_date));
  const pendingTs = (data.timesheets || []).filter((t) => t.status === "submitted");
  const month = isoDate().slice(0, 7);
  const hoursMonth = (data.timesheets || []).filter((t) => ["approved", "processed"].includes(t.status)).flatMap((t) => t.entries).filter((e) => e.date.startsWith(month)).reduce((a, e) => a + (Number(e.hours) || 0) + (Number(e.ot_hours) || 0), 0);
  const lastRun = (data.contractRuns || []).find((r) => r.status === "posted");
  const runCost = (r) => r ? r.lines.reduce((a, l) => a + (l.route === "vendor" ? l.invoice_base : l.gross), 0) : 0;
  const openInv = (data.contractInvoices || []).filter((i) => i.status === "approved");
  const flags = allContractFlags(data);
  const byType = WORKER_TYPES.filter((w) => w.id !== "permanent").map((w) => ({ w, n: live.filter((c) => c.worker_type === w.id).length, cost: live.filter((c) => c.worker_type === w.id).reduce((a, c) => a + (data.employees.find((e) => e.employee_code === c.employee_code)?.monthly_gross || 0), 0) })).filter((x) => x.n);
  const permanent = data.employees.filter((e) => e.status === "active" && !isContingent(e)).length;
  const ai = useAiRun();
  const facts = [
    `${live.length} live contracts (${byType.map((x) => `${x.n} ${x.w.short}`).join(", ")}); ${permanent} permanent employees; contingent share ${Math.round((live.length / Math.max(1, live.length + permanent)) * 100)}%`,
    ...expiring.map((c) => `${nameOf(c.employee_code)} (${c.id}, ${WORKER_TYPE_BY[c.worker_type]?.short}) ends ${c.end_date} — ${daysLeft(c)} days; renewal option ${c.renewal_option}; ${chainOf(data, c).length - 1} renewal(s) so far`),
    ...flags.filter((f) => f.level !== "low").map((f) => `${f.level.toUpperCase()} · ${nameOf(f.employee_code)} (${f.contract_id}): ${f.text}`),
    `${pendingTs.length} timesheets waiting for approval; ${openInv.length} unpaid invoices worth ${money(openInv.reduce((a, i) => a + i.net_payable, 0))}`,
    lastRun ? `Last contractor run ${lastRun.id} for ${periodLabel(lastRun.period)} cost ${money(runCost(lastRun))}` : "No contractor run posted yet",
  ];
  const offline = `**Contingent workforce brief**\n\n${facts.map((f) => `- ${f}`).join("\n")}\n\n**Do next**\n- Decide on renewals for contracts ending within 30 days${expiring.length ? ` (${expiring.map((c) => nameOf(c.employee_code)).join(", ")})` : ""}.\n- Clear high-severity alerts first (NDA, licence, budget).\n- Approve pending timesheets before the month-end contractor run.`;
  return (
    <Stack spacing={2.5}>
      <Grid min={165}>
        <StatCard label="Live contracts" value={live.length} hint={`${Math.round((live.length / Math.max(1, live.length + permanent)) * 100)}% of the workforce`} tone="accent" onClick={() => go("contracts")} />
        <StatCard label="Ending in 30 days" value={expiring.length} tone={expiring.length ? "warn" : "good"} hint="Renewal decisions due" onClick={() => go("contracts")} />
        <StatCard label="Timesheets to approve" value={pendingTs.length} tone={pendingTs.length ? "warn" : "good"} onClick={() => go("timesheets")} />
        <StatCard label="Hours approved this month" value={Math.round(hoursMonth)} tone="info" />
        <StatCard label="Last contractor run" value={money(runCost(lastRun))} hint={lastRun ? periodLabel(lastRun.period) : "None yet"} tone="neutral" onClick={() => go("pay")} />
        <StatCard label="Compliance alerts" value={flags.filter((f) => f.level !== "low").length} hint={`${flags.filter((f) => f.level === "high").length} high`} tone={flags.some((f) => f.level === "high") ? "bad" : "good"} onClick={() => go("compliance")} />
      </Grid>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.3fr 1fr" }, gap: 2.5, alignItems: "start" }}>
        <SectionCard title="Contracts ending soon" subtitle={`Alerts ${s.renewal_alert_days} and ${s.final_alert_days} days before the end date`} noPad>
          {expiring.length === 0 ? <EmptyState title="No contracts ending in the next 30 days" text="Renewal alerts appear here and on the approver's notifications." /> : (
            <TableWrap>
              <Table size="small">
                <TableHead><TableRow><TableCell>Worker</TableCell><TableCell>Type</TableCell><TableCell>Ends</TableCell><TableCell>On expiry</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>
                  {expiring.map((c) => (
                    <TableRow key={c.id} hover sx={{ cursor: "pointer" }} onClick={() => onOpen(c.id)}>
                      <TableCell><PersonCell name={nameOf(c.employee_code)} sub={`${c.id} · ${c.title}`} /></TableCell>
                      <TableCell><WTag type={c.worker_type} /></TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(c.end_date)} <Typography component="span" sx={{ fontSize: "0.6rem", color: daysLeft(c) <= 7 ? "error.main" : "warning.main", fontWeight: 700 }}>· {daysLeft(c)} d</Typography></TableCell>
                      <TableCell>{c.renewal_option === "auto" ? "Auto-renew" : c.renewal_option === "end" ? "Ends" : !c.renewal_option || c.renewal_option === "review" ? "Review" : c.renewal_option}{c.renewal_request ? <Tag tone="info" sx={{ ml: 0.5 }}>Worker asked</Tag> : null}</TableCell>
                      <TableCell align="right"><Button size="small" onClick={(e) => { e.stopPropagation(); onOpen(c.id); }}>Decide</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </SectionCard>
        <SectionCard title="Contingent workforce mix" subtitle="Live contracts and their monthly-equivalent cost">
          <Stack spacing={1.4}>
            {byType.map((x) => <HBar key={x.w.id} label={`${x.w.short} · ${x.n}`} value={x.cost} max={Math.max(...byType.map((y) => y.cost))} right={money(x.cost)} />)}
            {byType.length === 0 && <Typography variant="body2" color="text.secondary">No live contracts.</Typography>}
          </Stack>
        </SectionCard>
      </Box>
      {/* v10.6: the AI contingent-workforce brief was removed from Contract management. */}
    </Stack>
  );
}

// ─────────────── Contracts register ───────────────
function ContractsTab({ onOpen }) {
  const { data, nameOf, decideContract, notifyToast } = useStore();
  const role = useContractRole();
  const s = data.contractSettings || DEFAULT_CONTRACT_SETTINGS;
  const [q, setQ] = useState("");
  const [wt, setWt] = useState("");
  const [st, setSt] = useState("live");
  const [form, setForm] = useState(null);
  const [reject, setReject] = useState(null);
  const [note, setNote] = useState("");
  const inCountry = useCountryFilter();
  const list = useMemo(() => (data.contracts || []).filter((c) => {
    const empRec = data.employees.find((e) => e.employee_code === c.employee_code);
    if (empRec && !inCountry(empRec)) return false;
    const state = contractState(c, s);
    if (st === "live" && !["active", "expiring", "upcoming", "suspended", "pending_approval", "draft"].includes(state)) return false;
    if (st && st !== "live" && state !== st) return false;
    if (wt && c.worker_type !== wt) return false;
    return !q || [c.id, c.title, nameOf(c.employee_code), c.employee_code, c.po_number].join(" ").toLowerCase().includes(q.toLowerCase());
  }), [data.contracts, data.employees, q, wt, st, s, nameOf, inCountry]);
  const pending = (data.contracts || []).filter((c) => c.status === "pending_approval");
  return (
    <Stack spacing={2}>
      {role.approve && pending.length > 0 && (
        <Alert severity="warning" icon={<WarningAmberRounded />} sx={{ fontSize: "0.68rem", alignItems: "center" }}>
          <b>{pending.length} contract(s) waiting for your approval:</b>{" "}
          {pending.map((c) => (
            <Box key={c.id} component="span" sx={{ mr: 1.5, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
              <Button size="small" onClick={() => onOpen(c.id)}>{c.id} · {nameOf(c.employee_code)} · {rateText(c)}</Button>
              {c.created_by !== role.code || role.super ? <><Button size="small" variant="contained" color="success" onClick={() => { const r = decideContract(c.id, true); notifyToast(r.ok ? `${c.id} approved. The worker is asked to e-sign.` : r.error, r.ok ? "success" : "error"); }}>Approve</Button><Button size="small" color="error" onClick={() => { setReject(c); setNote(""); }}>Reject</Button></> : <Tag tone="neutral">You prepared it</Tag>}
            </Box>
          ))}
        </Alert>
      )}
      <SectionCard noPad>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ p: 1.5, alignItems: { md: "center" } }}>
          <TextField placeholder="Search worker, contract, PO" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: { md: 280 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
          <FormControl size="small" sx={{ minWidth: 160 }}><InputLabel>Worker type</InputLabel><Select label="Worker type" value={wt} onChange={(e) => setWt(e.target.value)}><MenuItem value="">All types</MenuItem>{WORKER_TYPES.filter((w) => w.id !== "permanent").map((w) => <MenuItem key={w.id} value={w.id}>{w.label}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}><InputLabel>Status</InputLabel><Select label="Status" value={st} onChange={(e) => setSt(e.target.value)}><MenuItem value="live">Live & in progress</MenuItem><MenuItem value="">All</MenuItem>{Object.entries(CONTRACT_STATUS).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}</Select></FormControl>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv("contracts.csv", ["contract", "worker_code", "worker", "worker_type", "title", "pay_basis", "rate", "currency", "route", "start", "end", "status", "po", "budget", "spent", "hours_logged"], list.map((c) => [c.id, c.employee_code, nameOf(c.employee_code), c.worker_type, c.title, c.pay_basis, rateOn(c, isoDate()), c.currency, c.payment_route, c.start_date, c.end_date, contractState(c, s), c.po_number, c.budget_amount, contractSpend(data, c), contractHoursLogged(data, c)]))}>Export</Button>
          {role.manage && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm({})}>New contract</Button>}
        </Stack>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 1100 }}>
            <TableHead><TableRow><TableCell>Contract</TableCell><TableCell>Worker</TableCell><TableCell>Type</TableCell><TableCell>Rate</TableCell><TableCell>Term</TableCell><TableCell>Paid via</TableCell><TableCell sx={{ width: 150 }}>Budget used</TableCell><TableCell>Signed</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
            <TableBody>
              {list.map((c) => {
                const spent = contractSpend(data, c);
                const pct = c.budget_amount ? Math.min(100, (spent / Number(c.budget_amount)) * 100) : null;
                const left = daysLeft(c);
                const flags = contractFlags(data, c).filter((f) => f.level !== "low");
                return (
                  <TableRow key={c.id} hover sx={{ cursor: "pointer" }} onClick={() => onOpen(c.id)}>
                    <TableCell><Mono>{c.id}</Mono><Typography sx={{ fontSize: "0.6rem", color: "#78827b", maxWidth: 220 }} noWrap>{c.title}</Typography></TableCell>
                    <TableCell><PersonCell name={nameOf(c.employee_code)} sub={c.employee_code} /></TableCell>
                    <TableCell><WTag type={c.worker_type} /></TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{rateText(c)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(c.start_date)} – {c.end_date ? fmtDate(c.end_date) : "open"}{left != null && left >= 0 && left <= 60 && <Typography sx={{ fontSize: "0.58rem", color: left <= 7 ? "error.main" : "warning.main", fontWeight: 700 }}>{left} days left</Typography>}</TableCell>
                    <TableCell>{ROUTE_LABEL[c.payment_route]}</TableCell>
                    <TableCell>{pct == null ? <Typography variant="caption" color="text.secondary">No cap</Typography> : <Tooltip title={`${money(spent, c.currency)} of ${money(c.budget_amount, c.currency)}`}><Box><LinearProgress variant="determinate" value={pct} color={pct >= 100 ? "error" : pct >= 80 ? "warning" : "primary"} sx={{ height: 6, borderRadius: 3 }} /><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{Math.round(pct)}%</Typography></Box></Tooltip>}</TableCell>
                    <TableCell>{c.signed?.worker ? <Tooltip title={`E-signed ${fmtDateTime(c.signed.worker.at)}`}><VerifiedRounded color="success" fontSize="small" /></Tooltip> : <Typography variant="caption" color="text.secondary">—</Typography>}</TableCell>
                    <TableCell><Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}><StateTag c={c} settings={s} />{flags.length > 0 && <Tooltip title={flags.map((f) => f.text).join(" · ")}><WarningAmberRounded sx={{ fontSize: 16, color: flags.some((f) => f.level === "high") ? "error.main" : "warning.main" }} /></Tooltip>}</Stack></TableCell>
                  </TableRow>
                );
              })}
              {list.length === 0 && <TableRow><TableCell colSpan={9}><EmptyState title="No contracts match" text="Change the filters, or create a contract for a contract, freelance, consultant, agency, intern, temporary or apprentice worker." /></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      {form && <ContractFormDialog init={form} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); onOpen(id); }} />}
      <ConfirmDialog open={!!reject} title={`Reject ${reject?.id}`} text="HR sees your reason and can correct the draft." confirmLabel="Reject" tone="error" disabled={!note.trim()} onClose={() => setReject(null)} onConfirm={() => { const r = decideContract(reject.id, false, note); notifyToast(r.ok ? "Rejected and returned to HR." : r.error, r.ok ? "success" : "error"); if (r.ok) setReject(null); }}>
        <TextField fullWidth multiline minRows={2} label="Reason" value={note} onChange={(e) => setNote(e.target.value)} sx={{ mt: 1 }} />
      </ConfirmDialog>
    </Stack>
  );
}

// ─────────────── Contract form ───────────────
export function ContractFormDialog({ init, onClose, onSaved }) {
  const { data, saveContract, notifyToast } = useStore();
  const workers = data.employees.filter((e) => isContingent(e) && e.status !== "rejected");
  const [f, setF] = useState(() => (init?.id ? { ...init } : { pay_basis: "hourly", payment_route: "payroll", tds_section: "192", std_hours_week: 40, ot_multiplier: 1.5, notice_days: 15, renewal_option: "review", nda_signed: "no", billing_cycle: "monthly", work_location: "hybrid", gst_registered: "no", milestones: [], ...init }));
  const [errors, setErrors] = useState({});
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const pickWorker = (code) => {
    const e = data.employees.find((y) => y.employee_code === code);
    if (!e) return;
    const base = contractFromEmployee(e);
    setF((x) => ({ ...x, ...base, title: x.title || `${e.designation} – ${WORKER_TYPE_BY[workerTypeOf(e)]?.short} contract`, milestones: x.milestones || [] }));
  };
  const wt = f.worker_type;
  const cur = f.currency || "INR";
  function save(submit) {
    const r = saveContract({ ...f, rate: Number(f.rate), budget_amount: f.budget_amount === "" ? "" : Number(f.budget_amount) }, { submit });
    if (!r.ok) { setErrors(r.errors || {}); return notifyToast(r.error, "error"); }
    notifyToast(submit ? `${r.id} sent for approval.` : `${r.id} saved as draft.`);
    onSaved(r.id);
  }
  const T = (k, label, props = {}) => <TextField size="small" fullWidth label={label} value={f[k] ?? ""} onChange={(e) => set(k, props.type === "number" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)} error={!!errors[k]} helperText={errors[k] || props.help || " "} slotProps={{ inputLabel: props.type === "date" ? { shrink: true } : undefined, input: props.adorn }} type={props.type === "date" ? "date" : "text"} multiline={props.multiline} minRows={props.multiline ? 2 : undefined} />;
  const S = (k, label, opts, help) => <FormControl size="small" fullWidth error={!!errors[k]}><InputLabel>{label}</InputLabel><Select label={label} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)}>{opts.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</Select><Typography sx={{ fontSize: "0.58rem", color: errors[k] ? "error.main" : "#78827b", minHeight: 18, px: 1.5, pt: 0.3 }}>{errors[k] || help || " "}</Typography></FormControl>;
  const msSum = (f.milestones || []).reduce((a, m) => a + (Number(m.amount) || 0), 0);
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{f.id ? `Edit ${f.id}` : f.kind === "renewal" ? "Renewal" : "New contract"}</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>Like a SAP Fieldglass work order / Oracle contingent assignment: the worker must exist in the employee database with a contingent worker type. Saved drafts go to Finance (or the Super Admin) for approval, then the worker e-signs.</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 2 }}>
          <FormControl size="small" fullWidth error={!!errors.employee_code} disabled={!!f.id}>
            <InputLabel>Worker *</InputLabel>
            <Select label="Worker *" value={f.employee_code || ""} onChange={(e) => pickWorker(e.target.value)}>
              {workers.map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name} · {e.employee_code} · {WORKER_TYPE_BY[workerTypeOf(e)]?.short}</MenuItem>)}
            </Select>
            <Typography sx={{ fontSize: "0.58rem", color: errors.employee_code ? "error.main" : "#78827b", minHeight: 18, px: 1.5, pt: 0.3 }}>{errors.employee_code || (workers.length ? "Terms are copied from the employee record; change them here." : "Add the worker in the employee database first (worker type: contract, freelance …).")}</Typography>
          </FormControl>
          {T("title", "Title / statement of work *")}
          {S("pay_basis", "Pay basis *", PAY_BASIS)}
          {T("rate", f.pay_basis === "milestone" ? "Total fee *" : "Rate *", { type: "number", adorn: { startAdornment: <InputAdornment position="start">{cur}</InputAdornment>, endAdornment: <InputAdornment position="end">{RATE_UNIT[f.pay_basis]}</InputAdornment> } })}
          {T("start_date", "Start date *", { type: "date" })}
          {T("end_date", "End date *", { type: "date", help: "Required for every contingent engagement" })}
          {f.pay_basis !== "milestone" && T("std_hours_week", "Standard hours / week", { type: "number" })}
          {f.pay_basis !== "milestone" && S("ot_multiplier", "Overtime rate", listOptions(data, "ot_multiplier").map(([v, l]) => [Number(v), l]))}
          {S("payment_route", "Paid through *", PAY_ROUTES.filter(([k]) => (SELF_EMPLOYED.includes(wt) ? k === "invoice" : wt === "agency" ? k === "vendor" : k !== "vendor" || wt === "agency")))}
          {f.payment_route === "vendor" ? S("vendor_id", "Staffing vendor *", (data.contractVendors || []).map((v) => [v.id, `${v.name} · ${v.markup_pct}%`])) : S("tds_section", "Tax withholding (TDS)", TDS_SECTIONS.map(([k, l]) => [k, l]))}
          {f.payment_route === "invoice" && S("gst_registered", "GST registered", [["no", "No"], ["yes", "Yes (+ GST on fees)"]])}
          {f.payment_route === "invoice" && f.gst_registered === "yes" && T("gstin", "GSTIN *")}
          {S("timesheet_approver", "Timesheet / milestone approver", [["", "Reporting manager"], ...data.employees.filter((e) => e.status === "active" && e.employee_code !== f.employee_code && !isContingent(e)).map((e) => [e.employee_code, `${e.full_name} (${e.employee_code})`])])}
          {T("notice_days", "Notice (days)", { type: "number" })}
          {S("renewal_option", "On expiry", listOptions(data, "renewal_option"))}
          {S("nda_signed", "NDA / IP assignment", [["no", "Not yet"], ["yes", "Signed"]])}
          {T("po_number", "PO / SOW number")}
          {T("cost_centre", "Cost centre")}
          {T("budget_amount", "Budget cap (optional)", { type: "number", adorn: { startAdornment: <InputAdornment position="start">{cur}</InputAdornment> }, help: "Alerts at 80% and 100%" })}
          {S("work_location", "Work location", WORK_LOCATIONS)}
          {S("billing_cycle", "Billing cycle", BILLING_CYCLES)}
          <Box sx={{ gridColumn: "1 / -1" }}>{T("deliverables", "Scope & deliverables", { multiline: true })}</Box>
        </Box>
        {f.pay_basis === "milestone" && (
          <Box sx={{ mt: 1 }}>
            <Stack direction="row" sx={{ alignItems: "center", mb: 1 }}><Typography variant="h3" sx={{ flex: 1 }}>Milestones</Typography><Typography variant="caption" color={Math.round(msSum) === Math.round(Number(f.rate) || 0) ? "success.main" : "warning.main"}>{money(msSum, cur)} of {money(f.rate || 0, cur)}</Typography><Button size="small" startIcon={<AddRounded />} onClick={() => set("milestones", [...(f.milestones || []), { id: `MS-${Date.now().toString(36)}`, title: "", due: f.end_date || "", amount: "", status: "planned" }])}>Add</Button></Stack>
            {(f.milestones || []).map((m, i) => (
              <Stack key={m.id} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
                <TextField size="small" label="Milestone" value={m.title} onChange={(e) => set("milestones", f.milestones.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} sx={{ flex: 2 }} />
                <TextField size="small" type="date" label="Due" value={m.due} onChange={(e) => set("milestones", f.milestones.map((y, j) => (j === i ? { ...y, due: e.target.value } : y)))} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField size="small" label="Amount" value={m.amount} onChange={(e) => set("milestones", f.milestones.map((y, j) => (j === i ? { ...y, amount: e.target.value.replace(/[^\d.]/g, "") } : y)))} sx={{ width: 140 }} />
                <IconButton onClick={() => set("milestones", f.milestones.filter((_, j) => j !== i))} aria-label="Remove"><DeleteOutlineRounded /></IconButton>
              </Stack>
            ))}
            {errors.milestones && <Alert severity="error" sx={{ fontSize: "0.66rem" }}>{errors.milestones}</Alert>}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="outlined" onClick={() => save(false)}>Save draft</Button>
        <Button variant="contained" startIcon={<SendRounded />} onClick={() => save(true)}>Save & send for approval</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────── Contract drawer ───────────────
function ContractDrawer({ id, onClose, onOpen }) {
  const { data, nameOf, submitContract, decideContract, setContractHold, remindTimesheet, deleteContractDraft, decideTimesheets, decideMilestone, notifyToast } = useStore();
  const role = useContractRole();
  const docs = useDocs();
  const s = data.contractSettings || DEFAULT_CONTRACT_SETTINGS;
  const c = (data.contracts || []).find((x) => x.id === id);
  const [dlg, setDlg] = useState(null);
  const [note, setNote] = useState("");
  const ai = useAiRun();
  if (!c) return <Drawer anchor="right" open={false} onClose={onClose} />;
  const emp = data.employees.find((e) => e.employee_code === c.employee_code) || {};
  const st = contractState(c, s);
  const flags = contractFlags(data, c);
  const sheets = (data.timesheets || []).filter((t) => t.contract_id === c.id).sort((a, b) => b.week_start.localeCompare(a.week_start));
  const runs = (data.contractRuns || []).flatMap((r) => r.lines.filter((l) => l.contract_id === c.id).map((l) => ({ r, l })));
  const spent = contractSpend(data, c);
  const chain = chainOf(data, c);
  const renewal = (data.contracts || []).find((x) => x.parent_id === c.id && x.status !== "rejected");
  const run = (r, ok) => { notifyToast(r.ok ? ok : r.error, r.ok ? "success" : "error"); return r.ok; };
  const live = ["active", "expiring", "suspended", "upcoming", "expired"].includes(st) && !["terminated", "renewed"].includes(c.status);
  const aiFacts = [
    `${emp.full_name} (${WORKER_TYPE_BY[c.worker_type]?.label}), ${c.title}, ${rateText(c)}, ${c.start_date} to ${c.end_date}, ${daysLeft(c)} days left, renewal option ${c.renewal_option}`,
    `Contracts in this chain: ${chain.length} (${chain.map((x) => `${x.id} ${x.start_date}→${x.end_date}`).join("; ")})`,
    `Hours approved: ${contractHoursLogged(data, c)}; spent ${money(spent, c.currency)}${c.budget_amount ? ` of budget ${money(c.budget_amount, c.currency)}` : ""}`,
    `Timesheets: ${sheets.length} (${sheets.filter((t) => t.status === "rejected").length} sent back); milestones: ${(c.milestones || []).map((m) => `${m.title} ${m.status}`).join(", ") || "none"}`,
    ...flags.map((f) => `Alert (${f.level}): ${f.text}`),
    c.renewal_request ? `Worker asked about renewal: ${c.renewal_request.note}` : "Worker has not asked about renewal",
  ];
  const offline = `**Recommendation: ${flags.some((f) => ["tenure", "renewals"].includes(f.code)) ? "renew only with a review of the engagement model (consider converting to a permanent role)" : daysLeft(c) != null && daysLeft(c) <= (s.renewal_alert_days || 30) ? "decide on renewal now" : "no action needed yet"}.**\n\n${aiFacts.map((f) => `- ${f}`).join("\n")}\n\n**Before renewing:** confirm budget and PO, check the rate against market, and clear any open alerts.`;
  return (
    <Drawer anchor="right" open={!!id} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", md: 720 } } } }}>
      <Stack direction="row" sx={{ alignItems: "center", px: 2.5, py: 1.5, borderBottom: "1px solid #edf0ec", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h2" noWrap>{c.id} · {nameOf(c.employee_code)}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">{c.title}</Typography>
        </Box>
        <WTag type={c.worker_type} /><StateTag c={c} settings={s} />
        <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
      </Stack>
      <Box sx={{ overflow: "auto", p: 2.5 }}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
          <Button size="small" variant="outlined" startIcon={<DescriptionRounded />} onClick={() => setDlg("doc")}>View contract</Button>
          {role.manage && ["draft", "rejected"].includes(c.status) && <Button size="small" variant="outlined" startIcon={<EditRounded />} onClick={() => setDlg("edit")}>Edit</Button>}
          {role.manage && ["draft", "rejected"].includes(c.status) && <Button size="small" variant="contained" startIcon={<SendRounded />} onClick={() => run(submitContract(c.id), "Sent for approval.")}>Send for approval</Button>}
          {role.manage && ["draft", "rejected"].includes(c.status) && <Button size="small" color="error" startIcon={<DeleteOutlineRounded />} onClick={() => { if (run(deleteContractDraft(c.id), "Draft deleted.")) onClose(); }}>Delete</Button>}
          {role.approve && c.status === "pending_approval" && <Button size="small" variant="contained" color="success" startIcon={<CheckRounded />} onClick={() => run(decideContract(c.id, true, note), "Approved. The worker is asked to e-sign.")}>Approve</Button>}
          {role.approve && c.status === "pending_approval" && <Button size="small" color="error" startIcon={<BlockRounded />} onClick={() => setDlg("reject")}>Reject</Button>}
          {role.manage && live && c.status !== "suspended" && <Button size="small" variant="outlined" startIcon={<EditRounded />} onClick={() => setDlg("amend")}>Amend</Button>}
          {role.manage && live && !renewal && <Button size="small" variant="outlined" startIcon={<AutorenewRounded />} onClick={() => setDlg("renew")}>Renew</Button>}
          {renewal && <Button size="small" startIcon={<OpenInNewRounded />} onClick={() => onOpen(renewal.id)}>Renewal {renewal.id}</Button>}
          {role.manage && c.status === "active" && <Button size="small" variant="outlined" startIcon={<PauseRounded />} onClick={() => setDlg("hold")}>Hold</Button>}
          {role.manage && c.status === "suspended" && <Button size="small" variant="outlined" startIcon={<PlayArrowRounded />} onClick={() => run(setContractHold(c.id, false), "Contract resumed.")}>Resume</Button>}
          {role.manage && ["active", "suspended"].includes(c.status) && <Button size="small" color="error" variant="outlined" startIcon={<StopCircleRounded />} onClick={() => setDlg("terminate")}>Terminate</Button>}
          {role.manage && ["hourly", "daily"].includes(c.pay_basis) && live && <Button size="small" startIcon={<NotificationsActiveRounded />} onClick={() => run(remindTimesheet(c.id), "Reminder sent.")}>Remind timesheet</Button>}
        </Stack>
        {c.status === "rejected" && <Alert severity="error" sx={{ mb: 2, fontSize: "0.68rem" }}>Rejected: {c.rejection}</Alert>}
        {c.status === "terminated" && <Alert severity="info" sx={{ mb: 2, fontSize: "0.68rem" }}>Terminated ({TERMINATION_REASONS.find(([k]) => k === c.termination?.reason)?.[1]}) · last day {fmtDate(c.termination?.last_day)}{c.termination?.note ? ` · ${c.termination.note}` : ""}</Alert>}
        {flags.length > 0 && <Stack spacing={0.8} sx={{ mb: 2 }}>{flags.map((f) => <Alert key={f.code + f.text} severity={f.level === "high" ? "error" : f.level === "medium" ? "warning" : "info"} sx={{ fontSize: "0.66rem", py: 0 }}>{f.text}</Alert>)}</Stack>}
        <KeyVal cols={3} items={[
          ["Worker", `${emp.full_name} · ${c.employee_code}`], ["Department", c.department || emp.department], ["Approver", nameOf(approverOf(c, emp)) || "—"],
          ["Rate now", rateText(c)], ["Standard hours", c.pay_basis === "milestone" ? "—" : `${c.std_hours_week} h/week · OT ${c.ot_multiplier}×`], ["Paid through", c.payment_route === "vendor" ? `Vendor · ${(data.contractVendors || []).find((v) => v.id === c.vendor_id)?.name || "—"}` : ROUTE_LABEL[c.payment_route]],
          ["Term", `${fmtDate(c.start_date)} – ${c.end_date ? fmtDate(c.end_date) : "open"}`], ["Days left", daysLeft(c) ?? "—"], ["Notice", `${c.notice_days} days`],
          ["TDS / GST", `${c.tds_section}${c.gst_registered === "yes" ? ` · GST ${c.gstin || emp.gstin || ""}` : ""}`], ["PO / cost centre", `${c.po_number || "—"} · ${c.cost_centre || "—"}`], ["NDA / e-sign", `${c.nda_signed === "yes" ? "NDA signed" : "NDA pending"} · ${c.signed?.worker ? `signed ${fmtDate(c.signed.worker.at)}` : "not signed"}`],
          ["Hours approved", contractHoursLogged(data, c)], ["Spent", money(spent, c.currency)], ["Budget", c.budget_amount ? `${money(c.budget_amount, c.currency)} · ${Math.round((spent / Number(c.budget_amount)) * 100)}% used` : "No cap"],
          ["Chain", chain.map((x) => x.id).join(" → ")], ["On expiry", c.renewal_option], ["Location", c.work_location],
          c.deliverables && ["Scope & deliverables", c.deliverables, { full: true, pre: true }],
        ]} />
        {(c.rate_history || []).length > 1 && <><Divider sx={{ my: 2 }} /><Typography variant="h3" sx={{ mb: 1 }}>Rate history</Typography><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>{c.rate_history.map((h) => <Tag key={h.from} tone="info">{fmtDate(h.from)}: {money(h.rate, c.currency)}</Tag>)}</Stack></>}
        {(c.amendments || []).length > 0 && (
          <><Divider sx={{ my: 2 }} /><Typography variant="h3" sx={{ mb: 1 }}>Amendments</Typography>
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>No.</TableCell><TableCell>Type</TableCell><TableCell>Change</TableCell><TableCell>Effective</TableCell><TableCell>Reason</TableCell></TableRow></TableHead><TableBody>{c.amendments.map((a) => <TableRow key={a.id}><TableCell>{a.id}</TableCell><TableCell>{AMENDMENT_TYPES.find(([k]) => k === a.type)?.[1]}</TableCell><TableCell>{a.from} → {a.to}</TableCell><TableCell>{fmtDate(a.effective)}</TableCell><TableCell>{a.note}</TableCell></TableRow>)}</TableBody></Table></TableWrap></>
        )}
        {(c.milestones || []).length > 0 && (
          <><Divider sx={{ my: 2 }} /><Typography variant="h3" sx={{ mb: 1 }}>Milestones</Typography>
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Milestone</TableCell><TableCell>Due</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead><TableBody>{c.milestones.map((m) => (
              <TableRow key={m.id}><TableCell>{m.title}{m.note && <Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{m.note}</Typography>}</TableCell><TableCell>{fmtDate(m.due)}</TableCell><TableCell align="right">{money(m.amount, c.currency)}</TableCell><TableCell><Tag tone={MS_STATUS[m.status]?.tone}>{MS_STATUS[m.status]?.label}</Tag></TableCell>
                <TableCell align="right">{m.status === "submitted" && (role.manage || role.code === approverOf(c, emp)) && <><Button size="small" color="success" onClick={() => run(decideMilestone(c.id, m.id, true), "Milestone accepted.")}>Accept</Button><Button size="small" color="error" onClick={() => { setDlg({ ms: m.id }); setNote(""); }}>Send back</Button></>}</TableCell></TableRow>
            ))}</TableBody></Table></TableWrap></>
        )}
        {sheets.length > 0 && (
          <><Divider sx={{ my: 2 }} /><Typography variant="h3" sx={{ mb: 1 }}>Timesheets</Typography>
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Week of</TableCell><TableCell align="right">Hours</TableCell><TableCell align="right">OT</TableCell><TableCell align="right">Value</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead><TableBody>{sheets.slice(0, 10).map((t) => {
              const tot = timesheetTotals(t);
              return <TableRow key={t.id}><TableCell>{fmtDate(t.week_start)}</TableCell><TableCell align="right">{tot.hours}</TableCell><TableCell align="right">{tot.ot || "—"}</TableCell><TableCell align="right">{c.pay_basis === "monthly" ? (tot.ot ? money(timesheetValue(c, t).ot, c.currency) : "—") : money(timesheetValue(c, t).total, c.currency)}</TableCell><TableCell><Tag tone={TS_STATUS[t.status]?.tone}>{TS_STATUS[t.status]?.label}</Tag></TableCell><TableCell align="right">{t.status === "submitted" && (role.manage || t.approver === role.code) && <Button size="small" color="success" onClick={() => run(decideTimesheets([t.id], true), "Approved.")}>Approve</Button>}</TableCell></TableRow>;
            })}</TableBody></Table></TableWrap></>
        )}
        {runs.length > 0 && (
          <><Divider sx={{ my: 2 }} /><Typography variant="h3" sx={{ mb: 1 }}>Payments</Typography>
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Run</TableCell><TableCell>Month</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">Net</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{runs.map(({ r, l }) => <TableRow key={r.id}><TableCell><Mono>{r.id}</Mono></TableCell><TableCell>{periodLabel(r.period)}</TableCell><TableCell align="right">{money(l.gross, l.currency)}</TableCell><TableCell align="right">{money(l.net, l.currency)}</TableCell><TableCell><Tag tone={RUN_STATUS[r.status]?.tone}>{RUN_STATUS[r.status]?.label}</Tag></TableCell></TableRow>)}</TableBody></Table></TableWrap></>
        )}
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" sx={{ alignItems: "center", mb: 1 }}><Typography variant="h3" sx={{ flex: 1 }}>AI renewal advice</Typography><AiButton busy={ai.busy} onClick={() => ai.run({ task: "contract-renewal", instruction: "You advise HR on a contingent worker's contract (SAP Fieldglass / Oracle HCM practice). Recommend renew / extend / convert to permanent / let end, with reasons, a suggested rate and term, and risks (co-employment, budget, compliance). Max 150 words.", input: aiFacts.join("\n"), offline })}>Advise</AiButton></Stack>
        <AiResult ai={ai} title="Renewal advice" />
        <Divider sx={{ my: 2 }} />
        <Typography variant="h3" sx={{ mb: 1 }}>History</Typography>
        <Stack spacing={0.6}>{[...(c.history || [])].reverse().map((h, i) => <Typography key={i} sx={{ fontSize: "0.62rem" }}><Box component="span" sx={{ color: "#78827b" }}>{fmtDateTime(h.at)} · {nameOf(h.by)} —</Box> {h.action}</Typography>)}</Stack>
      </Box>
      <DocDialog open={dlg === "doc"} title={`Contract ${c.id}`} html={dlg === "doc" ? docs.contractHtml(c) : ""} filename={`Contract_${c.id}_${c.employee_code}.html`} onClose={() => setDlg(null)} />
      {dlg === "edit" && <ContractFormDialog init={c} onClose={() => setDlg(null)} onSaved={() => setDlg(null)} />}
      {dlg === "amend" && <AmendDialog c={c} onClose={() => setDlg(null)} />}
      {dlg === "renew" && <RenewDialog c={c} onClose={() => setDlg(null)} onDone={(nid) => { setDlg(null); onOpen(nid); }} />}
      {dlg === "terminate" && <TerminateDialog c={c} onClose={() => setDlg(null)} />}
      <ConfirmDialog open={dlg === "reject" || dlg === "hold" || !!dlg?.ms} title={dlg === "hold" ? "Put the contract on hold" : dlg?.ms ? "Send the milestone back" : `Reject ${c.id}`} text={dlg === "hold" ? "The worker cannot log time until it resumes." : "Your reason is shared."} confirmLabel={dlg === "hold" ? "Put on hold" : "Send"} tone="error" disabled={!note.trim()} onClose={() => setDlg(null)}
        onConfirm={() => { const r = dlg === "hold" ? setContractHold(c.id, true, note) : dlg?.ms ? decideMilestone(c.id, dlg.ms, false, note) : decideContract(c.id, false, note); if (run(r, "Done.")) { setDlg(null); setNote(""); } }}>
        <TextField fullWidth multiline minRows={2} label="Reason" value={note} onChange={(e) => setNote(e.target.value)} sx={{ mt: 1 }} />
      </ConfirmDialog>
    </Drawer>
  );
}

function AmendDialog({ c, onClose }) {
  const { amendContract, notifyToast } = useStore();
  const [a, setA] = useState({ type: "rate", rate: rateOn(c, isoDate()), effective: isoDate(), end_date: c.end_date ? addDays(c.end_date, 90) : "", std_hours_week: c.std_hours_week, budget_amount: c.budget_amount || "", deliverables: c.deliverables || "", note: "", override: false });
  const set = (k, v) => setA((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Amend {c.id}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.6} sx={{ pt: 1 }}>
          <FormControl size="small"><InputLabel>Change</InputLabel><Select label="Change" value={a.type} onChange={(e) => set("type", e.target.value)}>{AMENDMENT_TYPES.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}</Select></FormControl>
          {a.type === "rate" && <Stack direction="row" spacing={1.5}><TextField size="small" label={`New rate ${RATE_UNIT[c.pay_basis]}`} value={a.rate} onChange={(e) => set("rate", e.target.value.replace(/[^\d.]/g, ""))} /><TextField size="small" type="date" label="Effective from" value={a.effective} onChange={(e) => set("effective", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Stack>}
          {a.type === "rate" && <Typography variant="caption" color="text.secondary">Timesheet days on or after the effective date are paid at the new rate; earlier days keep the old rate (rate history).</Typography>}
          {a.type === "extension" && <><TextField size="small" type="date" label="New end date" value={a.end_date} onChange={(e) => set("end_date", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><FormControlLabel control={<Checkbox size="small" checked={a.override} onChange={(e) => set("override", e.target.checked)} />} label={<Typography variant="body2">I have reviewed the co-employment risk of repeated extensions</Typography>} /></>}
          {a.type === "hours" && <TextField size="small" label="Standard hours / week" value={a.std_hours_week} onChange={(e) => set("std_hours_week", e.target.value.replace(/[^\d.]/g, ""))} />}
          {a.type === "budget" && <TextField size="small" label="New budget cap" value={a.budget_amount} onChange={(e) => set("budget_amount", e.target.value.replace(/[^\d.]/g, ""))} />}
          {a.type === "scope" && <TextField size="small" multiline minRows={3} label="Scope & deliverables" value={a.deliverables} onChange={(e) => set("deliverables", e.target.value)} />}
          <TextField size="small" multiline minRows={2} label="Reason (shown on the contract) *" value={a.note} onChange={(e) => set("note", e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={() => { const r = amendContract(c.id, a); notifyToast(r.ok ? "Amendment recorded; the worker was notified." : r.error, r.ok ? "success" : "error"); if (r.ok) onClose(); }}>Save amendment</Button></DialogActions>
    </Dialog>
  );
}
function RenewDialog({ c, onClose, onDone }) {
  const { renewContract, notifyToast } = useStore();
  const start = addDays(c.end_date || isoDate(), 1);
  const [f, setF] = useState({ start_date: start, end_date: addDays(start, 181), rate: rateOn(c, isoDate()), title: c.title, note: "" });
  const pct = ((Number(f.rate) - rateOn(c, isoDate())) / Math.max(1, rateOn(c, isoDate()))) * 100;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Renew {c.id}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.6} sx={{ pt: 1 }}>
          <Typography variant="caption" color="text.secondary">Creates a new contract linked to this one and sends it for approval. When it is approved, {c.id} is marked Renewed and the employee record is updated.</Typography>
          <TextField size="small" label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Stack direction="row" spacing={1.5}>
            <TextField size="small" type="date" label="Start" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
            <TextField size="small" type="date" label="End" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
          </Stack>
          <TextField size="small" label={`Rate ${RATE_UNIT[c.pay_basis]}`} value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value.replace(/[^\d.]/g, "") })} helperText={Number.isFinite(pct) && pct ? `${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs current` : "Same rate"} />
          <TextField size="small" multiline minRows={2} label="Note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={() => { const r = renewContract(c.id, f); notifyToast(r.ok ? `Renewal ${r.id} sent for approval.` : r.error, r.ok ? "success" : "error"); if (r.ok) onDone(r.id); }}>Create renewal</Button></DialogActions>
    </Dialog>
  );
}
function TerminateDialog({ c, onClose }) {
  const { terminateContract, notifyToast } = useStore();
  const [f, setF] = useState({ reason: "", last_day: addDays(isoDate(), Number(c.notice_days) || 15), note: "" });
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Terminate {c.id}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.6} sx={{ pt: 1 }}>
          <Alert severity="warning" sx={{ fontSize: "0.66rem" }}>Notice period is {c.notice_days} days. Approved time up to the last day is paid in the next contractor run.</Alert>
          <FormControl size="small"><InputLabel>Reason</InputLabel><Select label="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>{TERMINATION_REASONS.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}</Select></FormControl>
          <TextField size="small" type="date" label="Last working day" value={f.last_day} onChange={(e) => setF({ ...f, last_day: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" multiline minRows={2} label="Note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" color="error" onClick={() => { const r = terminateContract(c.id, f); notifyToast(r.ok ? "Contract terminated; the worker was notified." : r.error, r.ok ? "success" : "error"); if (r.ok) onClose(); }}>Terminate</Button></DialogActions>
    </Dialog>
  );
}

// ─────────────── Timesheets & milestones ───────────────
export function TimesheetApprovals({ scope = "all", onOpen }) {
  const { data, nameOf, user, decideTimesheets, decideMilestone, notifyToast, suiteDo } = useStore();
  const sendOtToFinance = (ids) => suiteDo("admin106", (s, { x, now, code }) => { s.otFinance = { ...(s.otFinance || {}) }; ids.forEach((id) => { s.otFinance[id] = { status: "pending", hr_by: code, hr_at: now }; }); (x.admins || []).filter((a) => a.status === "active" && (a.modules || []).includes("payroll")).forEach((a) => x.notifications.unshift({ id: `N-${Date.now()}-${a.admin_code}`, to: a.admin_code, text: `${ids.length} contractor timesheet(s) with overtime approved by HR — waiting for Finance.`, at: now, read: false, link: "/contracts?tab=timesheets" })); }, { action: "OT_TO_FINANCE", details: ids.join(",") });
  const role = useContractRole();
  const [status, setStatus] = useState("submitted");
  const [sel, setSel] = useState([]);
  const [view, setView] = useState(null);
  const [back, setBack] = useState(null);
  const [note, setNote] = useState("");
  const contracts = data.contracts || [];
  const cBy = Object.fromEntries(contracts.map((c) => [c.id, c]));
  const mine = (t) => scope === "all" || t.approver === user.code;
  const list = (data.timesheets || []).filter((t) => mine(t) && (!status || t.status === status)).sort((a, b) => b.week_start.localeCompare(a.week_start));
  const ms = contracts.flatMap((c) => (c.milestones || []).filter((m) => m.status === "submitted").map((m) => ({ c, m }))).filter(({ c }) => scope === "all" || approverOf(c, data.employees.find((e) => e.employee_code === c.employee_code)) === user.code);
  const can = (t) => role.manage || t.approver === user.code;
  const run = (r, ok) => { notifyToast(r.ok ? ok : r.error, r.ok ? "success" : "error"); return r.ok; };
  return (
    <Stack spacing={2.5}>
      {ms.length > 0 && (
        <SectionCard title="Milestones waiting for acceptance" noPad>
          <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Worker</TableCell><TableCell>Milestone</TableCell><TableCell align="right">Amount</TableCell><TableCell>Submitted</TableCell><TableCell /></TableRow></TableHead><TableBody>
            {ms.map(({ c, m }) => <TableRow key={m.id}><TableCell><PersonCell name={nameOf(c.employee_code)} sub={c.id} /></TableCell><TableCell>{m.title}<Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{m.note}</Typography></TableCell><TableCell align="right">{money(m.amount, c.currency)}</TableCell><TableCell>{fmtDateTime(m.submitted_at)}</TableCell><TableCell align="right"><Button size="small" color="success" onClick={() => run(decideMilestone(c.id, m.id, true), "Milestone accepted.")}>Accept</Button><Button size="small" color="error" onClick={() => { setBack({ c, m }); setNote(""); }}>Send back</Button></TableCell></TableRow>)}
          </TableBody></Table></TableWrap>
        </SectionCard>
      )}
      <SectionCard noPad title="Timesheets" subtitle="Approved time is paid in the month-end contractor pay run" action={
        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ minWidth: 150 }}><Select value={status} onChange={(e) => { setStatus(e.target.value); setSel([]); }}><MenuItem value="">All</MenuItem>{Object.entries(TS_STATUS).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}</Select></FormControl>
          {sel.length > 0 && <><Button size="small" variant="contained" color="success" onClick={() => { const withOt = (data.timesheets || []).filter((t) => sel.includes(t.id) && timesheetTotals(t).ot > 0); if (run(decideTimesheets(sel, true), `${sel.length} approved.${withOt.length ? ` ${withOt.length} with overtime sent to Finance.` : ""}`)) { if (withOt.length) sendOtToFinance(withOt.map((t) => t.id)); setSel([]); } }}>Approve {sel.length}</Button><Button size="small" color="error" onClick={() => { setBack({ ids: sel }); setNote(""); }}>Send back</Button></>}
        </Stack>
      }>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead><TableRow><TableCell padding="checkbox" /><TableCell>Worker</TableCell><TableCell>Week of</TableCell><TableCell align="right">Hours</TableCell><TableCell align="right">Overtime</TableCell><TableCell align="right">Value</TableCell><TableCell>Approver</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {list.map((t) => {
                const c = cBy[t.contract_id];
                const tot = timesheetTotals(t);
                const over = c && tot.hours > Number(c.std_hours_week || 40);
                return (
                  <TableRow key={t.id} hover>
                    <TableCell padding="checkbox">{t.status === "submitted" && can(t) && <Checkbox size="small" checked={sel.includes(t.id)} onChange={(e) => setSel(e.target.checked ? [...sel, t.id] : sel.filter((x) => x !== t.id))} />}</TableCell>
                    <TableCell><PersonCell name={nameOf(t.employee_code)} sub={`${t.contract_id} · ${WORKER_TYPE_BY[c?.worker_type]?.short || ""}`} /></TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(t.week_start)}</TableCell>
                    <TableCell align="right">{tot.hours}{over && <Tooltip title={`Above the contract's ${c.std_hours_week} h/week`}><WarningAmberRounded sx={{ fontSize: 13, color: "warning.main", ml: 0.3, verticalAlign: "middle" }} /></Tooltip>}</TableCell>
                    <TableCell align="right">{tot.ot || "—"}</TableCell>
                    <TableCell align="right">{c ? money(c.pay_basis === "monthly" ? timesheetValue(c, t).ot : timesheetValue(c, t).total, c.currency) : "—"}</TableCell>
                    <TableCell>{nameOf(t.approver) || "—"}</TableCell>
                    <TableCell><Tag tone={TS_STATUS[t.status]?.tone}>{TS_STATUS[t.status]?.label}</Tag></TableCell>
                    <TableCell align="right"><Button size="small" onClick={() => setView(t)}>Open</Button>{onOpen && <Button size="small" onClick={() => onOpen(t.contract_id)}>Contract</Button>}</TableCell>
                  </TableRow>
                );
              })}
              {list.length === 0 && <TableRow><TableCell colSpan={9}><EmptyState title={status === "submitted" ? "Nothing waiting for approval" : "No timesheets"} text="Contract workers submit weekly timesheets from My contract." /></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      {view && <TimesheetViewDialog t={view} c={cBy[view.contract_id]} canDecide={view.status === "submitted" && can(view)} onClose={() => setView(null)} onBack={() => { setBack({ ids: [view.id] }); setNote(""); setView(null); }} />}
      <ConfirmDialog open={!!back} title="Send back" text="The worker sees your note and can correct and resubmit." confirmLabel="Send back" tone="error" disabled={!note.trim()} onClose={() => setBack(null)}
        onConfirm={() => { const r = back.ids ? decideTimesheets(back.ids, false, note) : decideMilestone(back.c.id, back.m.id, false, note); if (run(r, "Sent back.")) { setBack(null); setSel([]); } }}>
        <TextField fullWidth multiline minRows={2} label="What needs to change" value={note} onChange={(e) => setNote(e.target.value)} sx={{ mt: 1 }} />
      </ConfirmDialog>
    </Stack>
  );
}
function TimesheetViewDialog({ t, c, canDecide, onClose, onBack }) {
  const { nameOf, decideTimesheets, notifyToast } = useStore();
  const tot = timesheetTotals(t);
  const v = c ? timesheetValue(c, t) : { base: 0, ot: 0, total: 0 };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{nameOf(t.employee_code)} · week of {fmtDate(t.week_start)}</DialogTitle>
      <DialogContent>
        <Table size="small"><TableHead><TableRow><TableCell>Day</TableCell><TableCell align="right">Hours</TableCell><TableCell align="right">OT</TableCell><TableCell>Work</TableCell></TableRow></TableHead><TableBody>
          {weekDays(t.week_start).map((d) => { const e = t.entries.find((x) => x.date === d) || {}; return <TableRow key={d}><TableCell>{new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}</TableCell><TableCell align="right">{e.hours || "—"}</TableCell><TableCell align="right">{e.ot_hours || "—"}</TableCell><TableCell sx={{ fontSize: "0.62rem" }}>{e.task}</TableCell></TableRow>; })}
          <TableRow><TableCell sx={{ fontWeight: 800 }}>Total</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{tot.hours}</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{tot.ot}</TableCell><TableCell sx={{ fontWeight: 800 }}>{c ? `${money(c.pay_basis === "monthly" ? v.ot : v.total, c.currency)}${c.pay_basis === "monthly" ? " overtime (monthly fee paid separately)" : ""}` : ""}</TableCell></TableRow>
        </TableBody></Table>
        {t.note && <Alert severity="info" sx={{ mt: 1.5, fontSize: "0.66rem" }}>{t.note}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {canDecide && <Button color="error" onClick={onBack}>Send back</Button>}
        {canDecide && <Button variant="contained" color="success" onClick={() => { const r = decideTimesheets([t.id], true); notifyToast(r.ok ? "Approved." : r.error, r.ok ? "success" : "error"); if (r.ok) onClose(); }}>Approve</Button>}
      </DialogActions>
    </Dialog>
  );
}
const TimesheetsTab = ({ onOpen }) => <TimesheetApprovals scope="all" onOpen={onOpen} />;

// ─────────────── Contractor pay runs (also shown in Payroll → Contractor pay) ───────────────
export function ContractPayRuns() {
  const { data, nameOf, contractPreviewRun, createContractRun, submitContractRun, decideContractRun, postContractRun, deleteContractRun, notifyToast } = useStore();
  const role = useContractRole();
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [open, setOpen] = useState(null);
  const [reject, setReject] = useState(null);
  const [note, setNote] = useState("");
  const preview = useMemo(() => contractPreviewRun(period), [period, data.timesheets, data.contracts, data.contractRuns]); // eslint-disable-line react-hooks/exhaustive-deps
  const runs = data.contractRuns || [];
  const total = (ls, k) => ls.reduce((a, l) => a + (Number(l[k]) || 0), 0);
  const run = (r, ok) => { notifyToast(r.ok ? ok : r.error, r.ok ? "success" : "error"); return r.ok; };
  const sel = runs.find((r) => r.id === open);
  const LineTable = ({ lines }) => (
    <TableWrap>
      <Table size="small" sx={{ minWidth: 980 }}>
        <TableHead><TableRow><TableCell>Worker</TableCell><TableCell>Route</TableCell><TableCell align="right">Units</TableCell><TableCell align="right">Rate</TableCell><TableCell align="right">Base</TableCell><TableCell align="right">Overtime</TableCell><TableCell align="right">Milestones</TableCell><TableCell align="right">Markup</TableCell><TableCell align="right">GST</TableCell><TableCell align="right">TDS</TableCell><TableCell align="right">Net / cost</TableCell></TableRow></TableHead>
        <TableBody>
          {lines.map((l) => (
            <TableRow key={l.contract_id}>
              <TableCell><PersonCell name={l.name} sub={`${l.contract_id} · ${l.basis}`} /></TableCell>
              <TableCell><Tag tone={l.route === "payroll" ? "good" : l.route === "vendor" ? "warn" : "accent"}>{ROUTE_LABEL[l.route]}</Tag></TableCell>
              <TableCell align="right">{l.basis === "monthly" ? `${Math.round(l.units * 100)}%` : l.basis === "milestone" ? `${l.milestone_ids.length} ms` : `${l.units} ${l.basis === "daily" ? "d" : "h"}`}</TableCell>
              <TableCell align="right">{l.basis === "milestone" ? "—" : money(l.rate, l.currency)}</TableCell>
              <TableCell align="right">{money(l.base, l.currency)}</TableCell>
              <TableCell align="right">{l.ot ? `${money(l.ot, l.currency)} (${l.ot_hours} h)` : "—"}</TableCell>
              <TableCell align="right">{l.milestones ? money(l.milestones, l.currency) : "—"}</TableCell>
              <TableCell align="right">{l.markup ? money(l.markup, l.currency) : "—"}</TableCell>
              <TableCell align="right">{l.gst ? money(l.gst, l.currency) : "—"}</TableCell>
              <TableCell align="right">{l.tds ? money(l.tds, l.currency) : l.route === "payroll" ? "via payroll" : "—"}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{money(l.net, l.currency)}{l.budget_left != null && l.budget_left < 0 && <Typography sx={{ fontSize: "0.56rem", color: "error.main" }}>over budget</Typography>}</TableCell>
            </TableRow>
          ))}
          <TableRow><TableCell colSpan={4} sx={{ fontWeight: 800 }}>Total · {lines.length} contract(s)</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{money(total(lines, "base"))}</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{money(total(lines, "ot"))}</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{money(total(lines, "milestones"))}</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{money(total(lines, "markup"))}</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{money(total(lines, "gst"))}</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{money(total(lines, "tds"))}</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{money(total(lines, "net"))}</TableCell></TableRow>
        </TableBody>
      </Table>
    </TableWrap>
  );
  return (
    <Stack spacing={2.5}>
      <Alert severity="info" sx={{ fontSize: "0.66rem" }}>
        One run per month pays every contingent worker from approved timesheets, accepted milestones and monthly contract fees. When Finance approves and posts the run:
        contract employees and interns on payroll go into a <b>draft payslip run</b> (Payslips → normal Finance → Super Admin → release, using their assigned payslip design);
        freelancers and consultants get a <b>self-billed invoice</b> (GST + TDS 194J); agency workers are billed on the <b>vendor's invoice</b> with markup (TDS 194C).
      </Alert>
      {role.manage && (
        <SectionCard title="Prepare a run" subtitle="Preview of what will be paid" action={<Stack direction="row" spacing={1}><TextField size="small" type="month" label="Pay month" value={period} onChange={(e) => setPeriod(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><Button variant="contained" sx={{ whiteSpace: "nowrap" }} disabled={!preview.length} onClick={() => { const r = createContractRun(period); if (run(r, `Draft run ${r.id} created.`)) setOpen(r.id); }}>Create draft run</Button></Stack>} noPad>
          {preview.length ? <LineTable lines={preview} /> : <EmptyState title={`Nothing to pay for ${periodLabel(period)}`} text="Approve timesheets and milestones first. Monthly contracts already paid this month are left out." />}
        </SectionCard>
      )}
      <SectionCard title="Runs" noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow><TableCell>Run</TableCell><TableCell>Month</TableCell><TableCell align="right">Contracts</TableCell><TableCell align="right">Payroll</TableCell><TableCell align="right">Invoices</TableCell><TableCell align="right">Vendor</TableCell><TableCell>Status</TableCell><TableCell>Posted to</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(r.id)}>
                  <TableCell><Mono>{r.id}</Mono></TableCell>
                  <TableCell>{periodLabel(r.period)}</TableCell>
                  <TableCell align="right">{r.lines.length}</TableCell>
                  <TableCell align="right">{money(total(r.lines.filter((l) => l.route === "payroll"), "gross"))}</TableCell>
                  <TableCell align="right">{money(total(r.lines.filter((l) => l.route === "invoice"), "net"))}</TableCell>
                  <TableCell align="right">{money(total(r.lines.filter((l) => l.route === "vendor"), "net"))}</TableCell>
                  <TableCell><Tag tone={RUN_STATUS[r.status]?.tone}>{RUN_STATUS[r.status]?.label}</Tag></TableCell>
                  <TableCell sx={{ fontSize: "0.6rem" }}>{r.payslip_batch_id ? `Payslips ${r.payslip_batch_id}` : ""}{r.invoice_ids?.length ? ` · ${r.invoice_ids.length} invoice(s)` : ""}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    {r.status === "draft" && role.manage && <Button size="small" onClick={() => run(submitContractRun(r.id), "Sent to Finance.")}>Send to Finance</Button>}
                    {r.status === "pending_approval" && role.approve && <><Button size="small" color="success" onClick={() => run(decideContractRun(r.id, true), "Run approved.")}>Approve</Button><Button size="small" color="error" onClick={() => { setReject(r); setNote(""); }}>Reject</Button></>}
                    {r.status === "approved" && (role.approve || role.manage) && <Button size="small" variant="contained" onClick={() => { const x = postContractRun(r.id); run(x, `Posted${x.batchId ? ` · payslip run ${x.batchId}` : ""} · ${x.invoices} invoice(s)${x.warnings?.length ? ` · ${x.warnings.length} warning(s)` : ""}.`); }}>Post</Button>}
                    {["draft", "rejected"].includes(r.status) && role.manage && <IconButton size="small" onClick={() => run(deleteContractRun(r.id), "Run deleted.")} aria-label="Delete"><DeleteOutlineRounded fontSize="small" /></IconButton>}
                  </TableCell>
                </TableRow>
              ))}
              {runs.length === 0 && <TableRow><TableCell colSpan={9}><EmptyState title="No runs yet" text={`Create the first run for ${periodLabel(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`)}.`} /></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <Dialog open={!!sel} onClose={() => setOpen(null)} maxWidth="lg" fullWidth>
        {sel && <>
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}><Box sx={{ flex: 1 }}>{sel.id} · {periodLabel(sel.period)}</Box><Tag tone={RUN_STATUS[sel.status]?.tone}>{RUN_STATUS[sel.status]?.label}</Tag><IconButton onClick={() => setOpen(null)}><CloseRounded /></IconButton></DialogTitle>
          <DialogContent>
            {sel.warnings?.map((w) => <Alert key={w} severity="warning" sx={{ mb: 1, fontSize: "0.66rem" }}>{w}</Alert>)}
            {sel.rejection && <Alert severity="error" sx={{ mb: 1, fontSize: "0.66rem" }}>Rejected: {sel.rejection}</Alert>}
            <LineTable lines={sel.lines} />
            <Stack spacing={0.5} sx={{ mt: 2 }}>{sel.history.map((h, i) => <Typography key={i} sx={{ fontSize: "0.62rem" }}><Box component="span" sx={{ color: "#78827b" }}>{fmtDateTime(h.at)} · {nameOf(h.by)} —</Box> {h.action}</Typography>)}</Stack>
          </DialogContent>
          <DialogActions><Button startIcon={<DownloadRounded />} onClick={() => downloadCsv(`${sel.id}.csv`, ["contract", "worker", "route", "basis", "units", "rate", "base", "ot", "milestones", "markup", "gst", "tds", "net"], sel.lines.map((l) => [l.contract_id, l.name, l.route, l.basis, l.units, l.rate, l.base, l.ot, l.milestones, l.markup, l.gst, l.tds, l.net]))}>Export</Button><Button onClick={() => setOpen(null)}>Close</Button></DialogActions>
        </>}
      </Dialog>
      <ConfirmDialog open={!!reject} title={`Reject ${reject?.id}`} text="HR sees the reason." confirmLabel="Reject" tone="error" disabled={!note.trim()} onClose={() => setReject(null)} onConfirm={() => { if (run(decideContractRun(reject.id, false, note), "Rejected.")) setReject(null); }}>
        <TextField fullWidth multiline minRows={2} label="Reason" value={note} onChange={(e) => setNote(e.target.value)} sx={{ mt: 1 }} />
      </ConfirmDialog>
    </Stack>
  );
}

// ─────────────── Invoices ───────────────
function InvoicesTab() {
  const { data, nameOf, payInvoice, cancelInvoice, notifyToast } = useStore();
  const role = useContractRole();
  const docs = useDocs();
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState(null);
  const [pay, setPay] = useState(null);
  const [cancel, setCancel] = useState(null);
  const [f, setF] = useState({ utr: "", date: isoDate(), note: "" });
  const list = (data.contractInvoices || []).filter((i) => (!kind || i.kind === kind) && (!status || i.status === status));
  const vendorName = (id) => (data.contractVendors || []).find((v) => v.id === id)?.name || id;
  const open = (data.contractInvoices || []).filter((i) => i.status === "approved");
  const run = (r, ok) => { notifyToast(r.ok ? ok : r.error, r.ok ? "success" : "error"); return r.ok; };
  return (
    <Stack spacing={2.5}>
      <Grid min={170}>
        <StatCard label="To pay" value={money(open.reduce((a, i) => a + i.net_payable, 0))} hint={`${open.length} invoice(s)`} tone={open.length ? "warn" : "good"} />
        <StatCard label="Overdue" value={open.filter((i) => i.due_date < isoDate()).length} tone={open.some((i) => i.due_date < isoDate()) ? "bad" : "good"} />
        <StatCard label="TDS deducted (all time)" value={money((data.contractInvoices || []).filter((i) => i.status !== "cancelled").reduce((a, i) => a + i.tds, 0))} tone="info" hint="Deposit and issue Form 16A" />
        <StatCard label="GST on invoices" value={money((data.contractInvoices || []).filter((i) => i.status !== "cancelled").reduce((a, i) => a + i.gst, 0))} tone="neutral" hint="Input tax credit" />
      </Grid>
      <SectionCard noPad>
        <Stack direction="row" spacing={1.2} sx={{ p: 1.5, flexWrap: "wrap" }} useFlexGap>
          <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Kind</InputLabel><Select label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}><MenuItem value="">All</MenuItem><MenuItem value="self_billed">Self-billed (freelance / consultant)</MenuItem><MenuItem value="vendor">Vendor (agency)</MenuItem></Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><MenuItem value="">All</MenuItem>{Object.entries(INVOICE_STATUS).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}</Select></FormControl>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv("contract-invoices.csv", ["invoice", "kind", "period", "party", "subtotal", "gst", "tds", "total", "net", "status", "due", "paid_at", "utr"], list.map((i) => [i.id, i.kind, i.period, i.employee_code ? nameOf(i.employee_code) : vendorName(i.vendor_id), i.subtotal, i.gst, i.tds, i.total, i.net_payable, i.status, i.due_date, i.paid_at || "", i.utr || ""]))}>Export (bank / TDS)</Button>
        </Stack>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 960 }}>
            <TableHead><TableRow><TableCell>Invoice</TableCell><TableCell>Party</TableCell><TableCell>Month</TableCell><TableCell align="right">Subtotal</TableCell><TableCell align="right">GST</TableCell><TableCell align="right">TDS</TableCell><TableCell align="right">Net payable</TableCell><TableCell>Due</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {list.map((i) => (
                <TableRow key={i.id} hover>
                  <TableCell><Mono>{i.id}</Mono><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{i.kind === "vendor" ? "Vendor" : "Self-billed"} · {i.run_id}</Typography></TableCell>
                  <TableCell>{i.employee_code ? <PersonCell name={nameOf(i.employee_code)} sub={i.employee_code} /> : vendorName(i.vendor_id)}</TableCell>
                  <TableCell>{periodLabel(i.period)}</TableCell>
                  <TableCell align="right">{money(i.subtotal, i.currency)}</TableCell>
                  <TableCell align="right">{money(i.gst, i.currency)}</TableCell>
                  <TableCell align="right">{money(i.tds, i.currency)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{money(i.net_payable, i.currency)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", color: i.status === "approved" && i.due_date < isoDate() ? "error.main" : undefined }}>{fmtDate(i.due_date)}</TableCell>
                  <TableCell><Tag tone={INVOICE_STATUS[i.status]?.tone}>{INVOICE_STATUS[i.status]?.label}</Tag>{i.utr && <Typography sx={{ fontSize: "0.54rem", color: "#78827b" }}>UTR {i.utr}</Typography>}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Button size="small" onClick={() => setView(i)}>View</Button>
                    {i.status === "approved" && role.finance && <><Button size="small" variant="contained" startIcon={<PaidRounded />} onClick={() => { setPay(i); setF({ utr: "", date: isoDate(), note: "" }); }}>Pay</Button><Button size="small" color="error" onClick={() => { setCancel(i); setF({ ...f, note: "" }); }}>Cancel</Button></>}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && <TableRow><TableCell colSpan={10}><EmptyState title="No invoices" text="Invoices are raised when a contractor pay run is posted." /></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <DocDialog open={!!view} title={view?.id || ""} html={view ? docs.invoiceHtml(view) : ""} filename={`${String(view?.id || "").replace(/\//g, "-")}.html`} onClose={() => setView(null)} />
      <ConfirmDialog open={!!pay} title={`Record payment · ${pay?.id}`} text={pay ? `${money(pay.net_payable, pay.currency)} to ${pay.employee_code ? nameOf(pay.employee_code) : vendorName(pay.vendor_id)}` : ""} confirmLabel="Mark paid" disabled={!f.utr.trim()} onClose={() => setPay(null)} onConfirm={() => { if (run(payInvoice(pay.id, f), "Payment recorded; payment advice sent.")) setPay(null); }}>
        <Stack spacing={1.5} sx={{ mt: 1 }}><TextField size="small" label="Bank reference (UTR)" value={f.utr} onChange={(e) => setF({ ...f, utr: e.target.value })} /><TextField size="small" type="date" label="Paid on" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Stack>
      </ConfirmDialog>
      <ConfirmDialog open={!!cancel} title={`Cancel ${cancel?.id}`} text="Cancelled invoices are kept for audit." confirmLabel="Cancel invoice" tone="error" disabled={!f.note.trim()} onClose={() => setCancel(null)} onConfirm={() => { if (run(cancelInvoice(cancel.id, f.note), "Invoice cancelled.")) setCancel(null); }}>
        <TextField fullWidth size="small" label="Reason" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} sx={{ mt: 1 }} />
      </ConfirmDialog>
    </Stack>
  );
}

// ─────────────── Vendors ───────────────
function VendorsTab() {
  const { data, upsertVendor, notifyToast } = useStore();
  const role = useContractRole();
  const [edit, setEdit] = useState(null);
  const s = data.contractSettings || DEFAULT_CONTRACT_SETTINGS;
  const workersOf = (v) => (data.contracts || []).filter((c) => c.vendor_id === v.id && ["active", "expiring"].includes(contractState(c, s))).length;
  return (
    <SectionCard title="Staffing vendors" subtitle="Agencies that employ and pay agency workers and invoice you with a markup. Principal-employer duties under the Contract Labour Act apply." noPad action={role.manage && <Button variant="contained" size="small" startIcon={<AddRounded />} onClick={() => setEdit({ markup_pct: 10, payment_terms_days: 30, status: "active", msme: "no" })}>Add vendor</Button>}>
      <TableWrap>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead><TableRow><TableCell>Vendor</TableCell><TableCell>GSTIN</TableCell><TableCell align="right">Markup</TableCell><TableCell align="right">Terms</TableCell><TableCell>CLRA licence</TableCell><TableCell align="right">Workers</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
          <TableBody>
            {(data.contractVendors || []).map((v) => {
              const exp = v.licence_expiry && v.licence_expiry < isoDate();
              const soon = v.licence_expiry && !exp && (new Date(v.licence_expiry) - new Date()) / 86400000 <= 30;
              return (
                <TableRow key={v.id} hover sx={{ cursor: role.manage ? "pointer" : undefined }} onClick={() => role.manage && setEdit(v)}>
                  <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{v.name}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{v.contact} · {v.email}</Typography></TableCell>
                  <TableCell><Mono>{v.gstin || "—"}</Mono></TableCell>
                  <TableCell align="right">{v.markup_pct}%</TableCell>
                  <TableCell align="right">{v.payment_terms_days} days</TableCell>
                  <TableCell>{v.clra_licence || "—"}<Typography sx={{ fontSize: "0.58rem", color: exp ? "error.main" : soon ? "warning.main" : "#78827b", fontWeight: exp || soon ? 700 : 400 }}>{v.licence_expiry ? `${exp ? "Expired" : "Valid to"} ${fmtDate(v.licence_expiry)}` : ""}</Typography></TableCell>
                  <TableCell align="right">{workersOf(v)}</TableCell>
                  <TableCell><Tag tone={v.status === "active" ? "good" : "neutral"}>{v.status}</Tag>{v.msme === "yes" && <Tag tone="info" sx={{ ml: 0.5 }}>MSME · 45-day rule</Tag>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableWrap>
      {edit && (
        <Dialog open onClose={() => setEdit(null)} maxWidth="sm" fullWidth>
          <DialogTitle>{edit.id ? edit.name : "Add vendor"}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, pt: 1 }}>
              {[["name", "Legal name", 2], ["gstin", "GSTIN"], ["pan", "PAN"], ["contact", "Contact person"], ["email", "Billing email"], ["phone", "Phone"], ["markup_pct", "Markup %"], ["payment_terms_days", "Payment terms (days)"], ["clra_licence", "CLRA licence no."], ["licence_expiry", "Licence valid to", 1, "date"], ["address", "Address", 2]].map(([k, l, span, type]) => (
                <TextField key={k} size="small" label={l} type={type || "text"} value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} sx={{ gridColumn: span === 2 ? "1 / -1" : undefined }} slotProps={{ inputLabel: type === "date" ? { shrink: true } : undefined }} />
              ))}
              <FormControl size="small"><InputLabel>MSME</InputLabel><Select label="MSME" value={edit.msme || "no"} onChange={(e) => setEdit({ ...edit, msme: e.target.value })}><MenuItem value="no">No</MenuItem><MenuItem value="yes">Yes (pay within 45 days)</MenuItem></Select></FormControl>
              <FormControl size="small"><InputLabel>Status</InputLabel><Select label="Status" value={edit.status || "active"} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></Select></FormControl>
            </Box>
          </DialogContent>
          <DialogActions><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="contained" onClick={() => { const r = upsertVendor(edit); notifyToast(r.ok ? "Vendor saved." : r.error, r.ok ? "success" : "error"); if (r.ok) setEdit(null); }}>Save</Button></DialogActions>
        </Dialog>
      )}
    </SectionCard>
  );
}

// ─────────────── Compliance ───────────────
function ComplianceTab({ onOpen }) {
  const { data, nameOf } = useStore();
  const flags = allContractFlags(data);
  const [lvl, setLvl] = useState("");
  const list = flags.filter((f) => !lvl || f.level === lvl);
  const count = (l) => flags.filter((f) => f.level === l).length;
  return (
    <Stack spacing={2.5}>
      <Grid min={170}>
        <StatCard label="High" value={count("high")} tone={count("high") ? "bad" : "good"} onClick={() => setLvl("high")} />
        <StatCard label="Medium" value={count("medium")} tone={count("medium") ? "warn" : "good"} onClick={() => setLvl("medium")} />
        <StatCard label="Low" value={count("low")} tone="info" onClick={() => setLvl("low")} />
        <StatCard label="All alerts" value={flags.length} tone="neutral" onClick={() => setLvl("")} />
      </Grid>
      <SectionCard title="Alerts" subtitle="Expiry & renewal, NDA / e-signature, budget, co-employment & misclassification, repeated renewals, vendor licence, PAN / GSTIN, late approvals, missing timesheets" noPad action={<Button size="small" startIcon={<DownloadRounded />} onClick={() => downloadCsv("contract-compliance.csv", ["level", "contract", "worker", "alert"], list.map((f) => [f.level, f.contract_id, nameOf(f.employee_code), f.text]))}>Export</Button>}>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead><TableRow><TableCell>Level</TableCell><TableCell>Worker</TableCell><TableCell>Alert</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {list.map((f, i) => <TableRow key={i} hover><TableCell><Tag tone={f.level === "high" ? "bad" : f.level === "medium" ? "warn" : "info"}>{f.level}</Tag></TableCell><TableCell><PersonCell name={nameOf(f.employee_code)} sub={f.contract_id} /></TableCell><TableCell>{f.text}</TableCell><TableCell align="right"><Button size="small" onClick={() => onOpen(f.contract_id)}>Open</Button></TableCell></TableRow>)}
              {list.length === 0 && <TableRow><TableCell colSpan={4}><EmptyState title="No alerts" text="All contracts are in order." /></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
    </Stack>
  );
}

// ─────────────── Settings ───────────────
function SettingsTab() {
  const { data, updateContractSettings, notifyToast } = useStore();
  const role = useContractRole();
  const [s, setS] = useState({ ...DEFAULT_CONTRACT_SETTINGS, ...(data.contractSettings || {}) });
  const [preview, setPreview] = useState(false);
  const docs = useDocs();
  const sample = (data.contracts || []).find((c) => c.status === "active");
  const num = (k, l, help) => <TextField size="small" label={l} value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value.replace(/[^\d.]/g, "") })} helperText={help} />;
  const save = () => {
    const patch = { ...s };
    ["renewal_alert_days", "final_alert_days", "max_hours_week", "gst_rate", "co_employment_months", "max_renewals", "payment_terms_days", "allow_backdated_timesheets_weeks"].forEach((k) => { patch[k] = Number(patch[k]); });
    if (!role.super) delete patch.approval_by;
    const r = updateContractSettings(patch);
    notifyToast(r.ok ? "Contract settings saved." : r.error, r.ok ? "success" : "error");
  };
  return (
    <Stack spacing={2.5}>
      <SectionCard title="Rules" action={<Button variant="contained" size="small" onClick={save} disabled={!role.manage}>Save</Button>}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
          {num("renewal_alert_days", "Renewal alert (days before end)")}
          {num("final_alert_days", "Final alert (days before end)")}
          {num("max_hours_week", "Max hours per timesheet week")}
          {num("allow_backdated_timesheets_weeks", "Back-dated timesheets (weeks)")}
          {num("gst_rate", "GST rate on fees (%)")}
          {num("payment_terms_days", "Payment terms for self-billed invoices (days)")}
          {num("co_employment_months", "Co-employment alert after (months)", "Freelancers / consultants engaged continuously")}
          {num("max_renewals", "Max renewals before alert")}
          <FormControl size="small" disabled={!role.super}><InputLabel>Contracts approved by</InputLabel><Select label="Contracts approved by" value={s.approval_by} onChange={(e) => setS({ ...s, approval_by: e.target.value })}><MenuItem value="finance">Finance (payroll admin) or Super Admin</MenuItem><MenuItem value="super">Super Admin only</MenuItem></Select></FormControl>
          <TextField size="small" label="Self-billed invoice prefix" value={s.invoice_prefix} onChange={(e) => setS({ ...s, invoice_prefix: e.target.value })} />
          <TextField size="small" label="Vendor invoice prefix" value={s.vendor_invoice_prefix} onChange={(e) => setS({ ...s, vendor_invoice_prefix: e.target.value })} />
          <Box />
          <FormControlLabel control={<Switch checked={!!s.require_nda} onChange={(e) => setS({ ...s, require_nda: e.target.checked })} />} label={<Typography variant="body2">Require NDA for freelance, consultant and agency workers</Typography>} />
          <FormControlLabel control={<Switch checked={!!s.require_worker_signature} onChange={(e) => setS({ ...s, require_worker_signature: e.target.checked })} />} label={<Typography variant="body2">Require the worker's e-signature</Typography>} />
          {/* v10.7: HR restricts timesheet entry on public holidays, and sets the projects workers can log time to */}
          <FormControlLabel control={<Switch checked={!!s.block_holiday_timesheets} onChange={(e) => setS({ ...s, block_holiday_timesheets: e.target.checked })} />} label={<Typography variant="body2">Don't allow timesheet entry on public holidays</Typography>} />
          <TextField size="small" label="Timesheet projects (comma separated)" value={s.timesheet_projects || ""} onChange={(e) => setS({ ...s, timesheet_projects: e.target.value })} helperText="Shown in the project drop-down on My contract & payment → Timesheets" sx={{ gridColumn: { sm: "span 2" } }} />
        </Box>
      </SectionCard>
      <SectionCard title="Contract template" subtitle="Terms printed on every contract. Placeholders: {{company}} {{worker}} {{worker_type}} {{title}} {{start}} {{end}} {{rate_text}} {{ot_multiplier}} {{hours}} {{approver}} {{notice}} {{payment_text}} {{tax_text}} {{renewal_text}} {{relationship_text}} {{country}} {{po_number}} {{contract_id}}" action={<Stack direction="row" spacing={1}>{sample && <Button size="small" variant="outlined" onClick={() => setPreview(true)}>Preview with {sample.id}</Button>}<Button size="small" variant="contained" onClick={save} disabled={!role.manage}>Save</Button></Stack>}>
        <TextField fullWidth multiline minRows={12} value={s.clause_template} onChange={(e) => setS({ ...s, clause_template: e.target.value })} slotProps={{ htmlInput: { style: {  fontSize: 12 } } }} />
        <Typography variant="caption" color="text.secondary">Colours, logo and letterhead come from the payslip design assigned to payment advices (Payslips → Payslip design).</Typography>
      </SectionCard>
      {sample && <DocDialog open={preview} title={`Preview · ${sample.id}`} html={preview ? contractDocumentHtml({ ...data, contractSettings: s }, sample, docs.company, docs.design) : ""} filename="contract-preview.html" onClose={() => setPreview(false)} />}
    </Stack>
  );
}
export { fillTemplate, contractVars, currencyOf };


// v10.6 · Overtime on contractor timesheets: HR approves the timesheet, then the overtime is redirected to Finance.
function adminKindOf106(user) {
  if (["hr", "finance", "hr_finance", "it"].includes(user.access_profile)) return user.access_profile;
  const m = user.modules || [];
  if (m.includes("accounts")) return "hr";
  if (m.includes("payroll")) return "finance";
  return "custom";
}
function OtFinanceQueue({ hrView }) {
  const { data, nameOf, suiteDo, notifyToast, user } = useStore();
  const role = useContractRole();
  const q = data.suite?.otFinance || {};
  const cBy = Object.fromEntries((data.contracts || []).map((c) => [c.id, c]));
  const rows = (data.timesheets || []).filter((t) => q[t.id]).sort((a, b) => b.week_start.localeCompare(a.week_start));
  const pending = rows.filter((t) => q[t.id].status === "pending");
  const decide = (t, ok) => { const r = suiteDo("admin106", (s, { now, code }) => { s.otFinance[t.id] = { ...s.otFinance[t.id], status: ok ? "approved" : "rejected", fin_by: code, fin_at: now }; }, { action: ok ? "OT_FINANCE_APPROVE" : "OT_FINANCE_REJECT", details: t.id, note: { to: t.employee_code, text: `Overtime on your timesheet for the week of ${fmtDate(t.week_start)} was ${ok ? "approved by Finance" : "not approved by Finance"}.`, link: "/my-contract" } }); notifyToast(r.ok ? (ok ? "Overtime approved for the pay run." : "Overtime rejected.") : r.error, r.ok ? "success" : "error"); };
  if (hrView && !rows.length) return null;
  return (
    <SectionCard sx={{ mb: hrView ? 2.5 : 0 }} title={hrView ? "Overtime sent to Finance" : "Overtime approvals"} subtitle="Flow: worker submits → HR (or the timesheet approver) approves → overtime goes to Finance → paid in the contractor pay run" noPad>
      {rows.length === 0 ? <EmptyState title="Nothing from HR yet" text="Timesheets with overtime appear here after HR approves them." /> : (
        <TableWrap><Table size="small" sx={{ minWidth: 760 }}><TableHead><TableRow><TableCell>Worker</TableCell><TableCell>Week of</TableCell><TableCell align="right">Hours</TableCell><TableCell align="right">Overtime hours</TableCell><TableCell align="right">OT value</TableCell><TableCell>HR approved</TableCell><TableCell>Finance</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>{rows.map((t) => { const c = cBy[t.contract_id]; const tot = timesheetTotals(t); const x = q[t.id]; return (
            <TableRow key={t.id}><TableCell><PersonCell name={nameOf(t.employee_code)} sub={t.contract_id} /></TableCell><TableCell>{fmtDate(t.week_start)}</TableCell><TableCell align="right">{tot.hours}</TableCell><TableCell align="right">{tot.ot}</TableCell><TableCell align="right">{c ? money(timesheetValue(c, t).ot, c.currency) : "—"}</TableCell><TableCell>{nameOf(x.hr_by)}</TableCell>
              <TableCell><Tag tone={x.status === "approved" ? "good" : x.status === "rejected" ? "bad" : "warn"}>{x.status === "pending" ? "With Finance" : x.status}</Tag></TableCell>
              <TableCell align="right">{x.status === "pending" && role.finance && !hrView && <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}><Button size="small" variant="contained" onClick={() => decide(t, true)}>Approve OT</Button><Button size="small" color="error" onClick={() => decide(t, false)}>Reject</Button></Stack>}</TableCell>
            </TableRow>); })}</TableBody></Table></TableWrap>
      )}
      {!hrView && <Typography variant="caption" color="text.secondary" sx={{ display: "block", p: 1.5 }}>{pending.length} waiting · signed in as {user.full_name}</Typography>}
    </SectionCard>
  );
}

// v10.6 · How to raise an invoice for a staffing vendor (Staffing vendors tab).
function RaiseInvoiceGuide({ go }) {
  const steps = [
    ["Timesheets approved", "Agency workers' weekly timesheets are approved by HR / the timesheet approver (overtime goes on to Finance)."],
    ["Contractor pay run", "Run the month-end contractor pay run — each vendor gets one line per worker: approved hours × rate + vendor markup."],
    ["Invoice raised", "Open Invoices & payments → the vendor's invoice is created from the run with GST (and TDS 194C) — download it or record the vendor's own invoice number."],
    ["Pay the vendor", "Finance approves and pays within the vendor's payment terms; the payment reference is saved on the invoice."],
  ];
  return (
    <Card sx={{ p: 2, mb: 2.5, borderLeft: "3px solid", borderColor: "primary.main", bgcolor: "background.paper" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "0.85rem" }}>How to raise a vendor invoice</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 1.2, mt: 1 }}>
            {steps.map(([t, d], i) => <Box key={t}><Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: "#9C6B45" }}>{i + 1}. {t}</Typography><Typography sx={{ fontSize: "0.64rem", color: "#5d6b70" }}>{d}</Typography></Box>)}
          </Box>
        </Box>
        <Stack spacing={1}><Button variant="contained" onClick={() => go("pay")}>Contractor pay run</Button><Button variant="outlined" onClick={() => go("invoices")}>Invoices & payments</Button></Stack>
      </Stack>
    </Card>
  );
}
