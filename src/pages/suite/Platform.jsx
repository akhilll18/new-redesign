// Platform (v10): connections, reports, ease of use and trust —
//  • Integrations & API: accounting (Tally, QuickBooks, Xero, Zoho Books, SAP, NetSuite), banks, ERP, biometric
//    devices, SSO and chat; salary journal export; API keys and webhooks.
//  • Workforce intelligence: headcount, payroll cost (multi-currency) and attrition dashboards with attrition risk.
//  • Setup & data import: go-live checklist ("setup in days") and an import wizard from spreadsheets or the old system.
//  • Plan & billing: clear per-employee monthly pricing, no hidden fees, invoices.
//  • Security & backups: encryption, role-based access, sessions, backups and restore points.
//  • Expert support: local-language help from people who know local payroll law.
import React, { useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { Hub as HubIcon, AccountBalance, Fingerprint, Key, Webhook, SyncRounded, DownloadRounded, Groups, Payments, TrendingDown, Warning, Rocket, UploadFile, CheckCircle, Lock, Backup, Restore, Shield, SupportAgent, Translate, Phone, Receipt, Add, ContentCopy } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, TableWrap, PersonCell, EmptyState, Avatar } from "../../components/kit/UI.jsx";
import { ModuleHub, Pill, StatusPill, TwoCol, Hint, money, C, Progress, Ring, Kpi, Steps, useWho, asList } from "../../components/suite/Hub.jsx";
import { computeRun, journalLines } from "../../lib/suitePayroll.js";
import { COUNTRIES } from "../../lib/payroll/index.js";
import { downloadCsv, fmtDate, fmtDateTime, isoDate, monthLabel } from "../../lib/utils.js";

// ── Integrations & API ──────────────────────────────────────────────────────────
const CONNECTORS = [
  ["Accounting", [["tally", "Tally / TallyPrime", "Salary journal as Tally XML vouchers"], ["quickbooks", "QuickBooks Online", "Journal entries & employee vendors"], ["xero", "Xero", "Manual journals & payroll liabilities"], ["zoho_books", "Zoho Books", "Journals with cost centres"], ["sap", "SAP S/4HANA / Business One", "FI postings via IDoc / API"], ["netsuite", "Oracle NetSuite", "Journal entries via SuiteTalk"]]],
  ["Banks & payouts", [["hdfc", "HDFC Bank", "Bulk NEFT / RTGS upload"], ["icici", "ICICI Bank", "Corporate Internet Banking bulk file"], ["axis", "Axis Bank", "Power Access bulk payments"], ["razorpayx", "RazorpayX Payroll payouts", "API payouts with UTR callback"], ["barclays", "Barclays (UK)", "Bacs bureau"], ["chase", "Chase (US)", "NACHA ACH"], ["enbd", "Emirates NBD (UAE)", "WPS SIF"]]],
  ["Attendance & devices", [["essl", "eSSL / ZKTeco biometric", "Fingerprint & face punches pushed live"]]],
  // v10.6: leave requests approved on WhatsApp, alerts by SMS
  ["Messaging", [["whatsapp", "WhatsApp Business", "Apply for leave, approve / decline and get updates on WhatsApp"], ["sms", "SMS gateway", "OTP, punch reminders and approval alerts by SMS"]]],
  ["Identity & collaboration", [["google", "Google Workspace", "SSO and calendar"], ["microsoft", "Microsoft Entra ID / 365", "SSO, Outlook calendar"], ["teams", "Microsoft Teams", "Approvals and alerts in Teams"], ["slack", "Slack", "Approvals and alerts in Slack"], ["whatsapp", "WhatsApp Business", "Payslip-ready and deadline alerts"]]],
];
const EVENTS = ["employee.created", "employee.updated", "employee.exited", "leave.approved", "attendance.punch", "payroll.approved", "payslip.released", "payout.paid", "filing.completed"];

function tallyXml(run) {
  const lines = journalLines(run);
  const entry = (name, dr, amt) => `      <ALLLEDGERENTRIES.LIST><LEDGERNAME>${name}</LEDGERNAME><ISDEEMEDPOSITIVE>${dr ? "Yes" : "No"}</ISDEEMEDPOSITIVE><AMOUNT>${dr ? -amt : amt}</AMOUNT></ALLLEDGERENTRIES.LIST>`;
  return `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA>\n  <TALLYMESSAGE><VOUCHER VCHTYPE="Journal" ACTION="Create"><DATE>${run.period.replace("-", "")}28</DATE><NARRATION>Salary for ${run.period}</NARRATION>\n${lines.map(([n, d, a]) => entry(n, d === "Dr", a)).join("\n")}\n  </VOUCHER></TALLYMESSAGE>\n</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}
function downloadText(name, text, type = "application/xml") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); }

export function Integrations() {
  const { data, suiteDo, suiteCan, notifyToast } = useStore();
  const s = data.suite || {};
  const can = suiteCan("integrations");
  const [key, setKey] = useState(null);
  const [hook, setHook] = useState(null);
  const run = useMemo(() => computeRun(data), [data]);
  const toggle = (id, on) => suiteDo("integrations", (x, { now }) => { x.integrations[id] = on ? { connected: true, last_sync: now } : { connected: false }; }, { action: on ? "INTEGRATION_CONNECT" : "INTEGRATION_DISCONNECT", details: id });
  const sync = (id) => { suiteDo("integrations", (x, { now }) => { x.integrations[id].last_sync = now; }, { action: "INTEGRATION_SYNC", details: id }); notifyToast("Synced."); };
  function exportJournal(target) {
    if (target === "tally") downloadText(`tally-salary-journal-${run.period}.xml`, tallyXml(run));
    else downloadCsv(`${target}-salary-journal-${run.period}.csv`, ["Date", "Account", "Debit", "Credit", "Memo"], journalLines(run).map(([n, d, a]) => [`${run.period}-28`, n, d === "Dr" ? a : "", d === "Cr" ? a : "", `Salary ${run.period}`]));
    suiteDo("integrations", () => ({}), { action: "JOURNAL_EXPORT", details: `${target} · ${run.period}` });
  }
  function createKey() {
    const secret = `ph_live_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    suiteDo("integrations", (x, { now }) => { x.apiKeys = [{ id: `KEY-${Date.now()}`, name: key.name, prefix: secret.slice(0, 12), scopes: key.scopes, created_at: now }, ...(x.apiKeys || [])]; }, { action: "API_KEY_CREATE", details: `${key.name} · ${key.scopes.join(",")}` });
    setKey({ ...key, secret });
  }
  const connected = Object.values(s.integrations || {}).filter((i) => i.connected).length;
  return (
    <ModuleHub eyebrow="PLATFORM · INTEGRATIONS & API" title="Connections" subtitle="Link payroll to your accounting software, banks and ERP; bring in biometric punches; sign in with SSO; and build on the API with keys and webhooks."
      brief={{ text: <><b>{connected}</b> connections live. This month's salary journal is ready for {["tally", "quickbooks", "xero", "zoho_books", "sap"].filter((k) => s.integrations?.[k]?.connected).map((k) => CONNECTORS[0][1].find((c) => c[0] === k)?.[1]).join(", ") || "export"}.</>, actions: [["Export journal to Tally", () => exportJournal("tally")]] }}
      kpis={[{ label: "Connected", value: connected, icon: <HubIcon />, tone: "navy" }, { label: "Banks", value: CONNECTORS[1][1].filter(([k]) => s.integrations?.[k]?.connected).length, icon: <AccountBalance />, tone: "glob" }, { label: "API keys", value: (s.apiKeys || []).length, icon: <Key />, tone: "mint" }, { label: "Webhooks", value: (s.webhooks || []).length, icon: <Webhook />, tone: "purple" }]}>
      <Stack spacing={2}>
        {CONNECTORS.map(([g, list]) => (
          <SectionCard key={g} title={g}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,1fr)", xl: "repeat(3,1fr)" }, gap: 1.2 }}>
              {list.map(([id, name, what]) => { const st = s.integrations?.[id] || {}; return (
                <Card key={id} sx={{ p: 1.5, display: "flex", gap: 1.2, alignItems: "center", borderColor: st.connected ? "rgba(10,158,120,0.4)" : undefined }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: st.connected ? "rgba(16,252,190,0.18)" : "rgba(0,74,119,0.06)", color: st.connected ? C.mintDeep : C.navy, fontWeight: 800, fontSize: "0.8rem", flexShrink: 0 }}>{name.slice(0, 2).toUpperCase()}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{name}</Typography><Typography variant="caption" color="text.secondary" component="div" noWrap>{st.connected ? `${st.mode || what} · synced ${st.last_sync ? fmtDateTime(st.last_sync) : "—"}` : what}</Typography></Box>
                  {st.connected && <Button size="small" onClick={() => (g === "Accounting" ? exportJournal(id) : sync(id))}>{g === "Accounting" ? "Export" : "Sync"}</Button>}
                  <Switch checked={!!st.connected} disabled={!can} onChange={(e) => toggle(id, e.target.checked)} />
                </Card>
              ); })}
            </Box>
          </SectionCard>
        ))}
        <TwoCol right={460}>
          <SectionCard title="API keys" subtitle="REST API — employees, attendance, leave, payroll, payslips" action={<Button size="small" startIcon={<Add />} disabled={!can} onClick={() => setKey({ name: "", scopes: ["employees:read"] })}>New key</Button>} noPad>
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Key</TableCell><TableCell>Scopes</TableCell><TableCell>Created</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>{(s.apiKeys || []).map((k) => <TableRow key={k.id}><TableCell>{k.name}</TableCell><TableCell sx={{  }}>{k.prefix}…</TableCell><TableCell><Typography variant="caption">{k.scopes.join(", ")}</Typography></TableCell><TableCell>{fmtDate(k.created_at)}</TableCell><TableCell><Button size="small" color="error" disabled={!can} onClick={() => suiteDo("integrations", (x) => { x.apiKeys = x.apiKeys.filter((y) => y.id !== k.id); }, { action: "API_KEY_REVOKE", details: k.name })}>Revoke</Button></TableCell></TableRow>)}</TableBody></Table></TableWrap>
            <Box sx={{ p: 2, bgcolor: "rgba(0,74,119,0.04)",  fontSize: "0.72rem", whiteSpace: "pre-wrap" }}>{`GET  /api/v1/employees\nGET  /api/v1/attendance?date=${isoDate()}\nPOST /api/v1/leave-requests\nGET  /api/v1/payroll/runs/${isoDate().slice(0, 7)}\nGET  /api/v1/payslips/{employee_code}\nAuthorization: Bearer ph_live_…`}</Box>
          </SectionCard>
          <SectionCard title="Webhooks" action={<Button size="small" startIcon={<Add />} disabled={!can} onClick={() => setHook({ url: "https://", events: ["payroll.approved"] })}>Add</Button>} noPad>
            {(s.webhooks || []).map((w) => <Box key={w.id} sx={{ px: 2, py: 1.2, borderBottom: 1, borderColor: "divider" }}><Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Typography variant="body2" sx={{  }} noWrap>{w.url}</Typography><Button size="small" onClick={() => { suiteDo("integrations", (x) => { x.webhooks.find((y) => y.id === w.id).last_status = 200; }, { action: "WEBHOOK_TEST", details: w.url }); notifyToast("Test event delivered — 200 OK."); }}>Test</Button></Stack><Typography variant="caption" color="text.secondary">{w.events.join(" · ")} · last {w.last_status || "—"}</Typography></Box>)}
          </SectionCard>
        </TwoCol>
      </Stack>
      <Dialog open={!!key} onClose={() => setKey(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{key?.secret ? "Copy your key now" : "New API key"}</DialogTitle>
        <DialogContent>{key?.secret ? <Stack spacing={1}><Alert severity="warning">This is the only time the full key is shown.</Alert><TextField value={key.secret} slotProps={{ input: { readOnly: true, endAdornment: <Button size="small" startIcon={<ContentCopy />} onClick={() => navigator.clipboard?.writeText(key.secret)}>Copy</Button> } }} /></Stack> : <Stack spacing={1.5} sx={{ mt: 1 }}><TextField label="Name" value={key?.name || ""} onChange={(e) => setKey({ ...key, name: asList(e.target.value) })} /><TextField select label="Scopes" slotProps={{ select: { multiple: true } }} value={key?.scopes || []} onChange={(e) => setKey({ ...key, scopes: asList(e.target.value) })}>{["employees:read", "employees:write", "attendance:read", "attendance:write", "leave:read", "leave:write", "payroll:read", "payslips:read"].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField></Stack>}</DialogContent>
        <DialogActions><Button onClick={() => setKey(null)}>{key?.secret ? "Done" : "Cancel"}</Button>{!key?.secret && <Button variant="contained" disabled={!key?.name} onClick={createKey}>Create</Button>}</DialogActions>
      </Dialog>
      <Dialog open={!!hook} onClose={() => setHook(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Add webhook</DialogTitle>
        <DialogContent><Stack spacing={1.5} sx={{ mt: 1 }}><TextField label="Endpoint URL" value={hook?.url || ""} onChange={(e) => setHook({ ...hook, url: asList(e.target.value) })} /><TextField select label="Events" slotProps={{ select: { multiple: true } }} value={hook?.events || []} onChange={(e) => setHook({ ...hook, events: asList(e.target.value) })}>{EVENTS.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField></Stack></DialogContent>
        <DialogActions><Button onClick={() => setHook(null)}>Cancel</Button><Button variant="contained" disabled={!/^https:\/\/.+\..+/.test(hook?.url || "")} onClick={() => { suiteDo("integrations", (x) => { x.webhooks = [...(x.webhooks || []), { id: `WH-${Date.now()}`, url: hook.url, events: hook.events, active: true }]; }, { action: "WEBHOOK_ADD", details: hook.url }); setHook(null); }}>Add</Button></DialogActions>
      </Dialog>
    </ModuleHub>
  );
}

// ── Workforce intelligence ──────────────────────────────────────────────────────
export function attritionRisk(data, e) {
  const reasons = [];
  let score = 0;
  const yrs = (Date.now() - new Date(e.date_of_joining)) / (365.25 * 86400000);
  if (yrs > 1 && yrs < 2.5) { score += 20; reasons.push("1–2.5 years' tenure — the peak leaving window"); }
  const recognised = (data.suite?.posts || []).some((p) => p.kind === "recognition" && p.to.includes(e.employee_code));
  if (!recognised) { score += 15; reasons.push("No recognition recently"); }
  const peers = data.employees.filter((x) => x.status === "active" && x.department === e.department && x.grade_code === e.grade_code && (x.country_code || "IN") === (e.country_code || "IN"));
  const med = peers.map((x) => x.monthly_gross).sort((a, b) => a - b)[Math.floor(peers.length / 2)] || e.monthly_gross;
  if (e.monthly_gross < med * 0.92) { score += 25; reasons.push(`Paid ${Math.round((1 - e.monthly_gross / med) * 100)}% below peers in the same grade`); }
  const sick = data.requests.filter((r) => r.type === "leave" && r.employee_code === e.employee_code && ["SL", "LOP"].includes(r.leave_type)).length;
  if (sick >= 2) { score += 15; reasons.push(`${sick} sick / LOP leaves this year`); }
  const pulse = (data.suite?.pulses || []).filter((p) => p.emp === e.employee_code);
  if (pulse.length && pulse.reduce((s, p) => s + p.mood, 0) / pulse.length < 2.6) { score += 20; reasons.push("Low daily pulse"); }
  if ((data.suite?.exits || []).some((x) => x.employee_code === e.employee_code)) { score = 100; reasons.unshift("Already resigned"); }
  return { score: Math.min(100, score), reasons };
}

export function Insights() {
  const { data } = useStore();
  const navigate = useNavigate();
  const run = useMemo(() => computeRun(data), [data]);
  const active = data.employees.filter((e) => e.status === "active");
  const byDept = Object.entries(active.reduce((m, e) => ({ ...m, [e.department]: (m[e.department] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const byCountry = Object.entries(active.reduce((m, e) => ({ ...m, [e.country_code || "IN"]: (m[e.country_code || "IN"] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 11 + i); return isoDate(d).slice(0, 7); });
  const hc = months.map((m) => data.employees.filter((e) => e.date_of_joining.slice(0, 7) <= m && !((data.suite?.exits || []).some((x) => x.employee_code === e.employee_code && x.last_day.slice(0, 7) < m))).length);
  const exits12 = (data.suite?.exits || []).filter((x) => x.last_day >= isoDate(new Date(Date.now() - 365 * 86400000))).length;
  const attrition = (exits12 / Math.max(1, hc.reduce((s, x) => s + x, 0) / hc.length)) * 100;
  const costByDept = Object.entries(run.rows.reduce((m, r) => ({ ...m, [r.e.department]: (m[r.e.department] || 0) + r.inr.cost }), {})).sort((a, b) => b[1] - a[1]);
  const risks = active.map((e) => ({ e, ...attritionRisk(data, e) })).filter((r) => r.score >= 35).sort((a, b) => b.score - a.score).slice(0, 8);
  const maxHc = Math.max(...hc);
  return (
    <ModuleHub eyebrow="INSIGHT · WORKFORCE INTELLIGENCE" title="Headcount, payroll cost & attrition" subtitle="Live dashboards from the same data as payroll — plus early warnings and attrition risk. The AI never makes up numbers: every figure is computed from your records."
      brief={{ text: <><b>{active.length}</b> people in <b>{byCountry.length}</b> countries · monthly cost <b>{money(run.totals.cost, "INR", { compact: true })}</b> · 12-month attrition <b>{attrition.toFixed(1)}%</b> · <b>{risks.length}</b> people show attrition risk signals.</>, ask: "Using my workforce data, explain the main attrition risks and what managers should do this month." }}
      kpis={[{ label: "Headcount", value: active.length, hint: `${hc[11] - hc[0] >= 0 ? "+" : ""}${hc[11] - hc[0]} in 12 months`, icon: <Groups />, tone: "navy", spark: hc }, { label: "Monthly payroll cost", value: money(run.totals.cost, "INR", { compact: true }), hint: `${run.byCountry.length} currencies → ₹`, icon: <Payments />, tone: "glob" }, { label: "Cost per head", value: money(run.totals.cost / Math.max(1, run.totals.people), "INR", { compact: true }), icon: <Payments />, tone: "mint" }, { label: "Attrition (12 mo)", value: `${attrition.toFixed(1)}%`, hint: `${exits12} exits`, icon: <TrendingDown />, tone: attrition > 15 ? "bad" : "navy" }, { label: "At risk", value: risks.length, hint: "score ≥ 35", icon: <Warning />, tone: "glob" }]}>
      <TwoCol right={400}>
        <Stack spacing={2}>
          <SectionCard title="Headcount trend" subtitle="Last 12 months">
            <Stack direction="row" spacing={0.8} sx={{ alignItems: "flex-end", height: 140 }}>{hc.map((v, i) => <Box key={i} sx={{ flex: 1, textAlign: "center" }}><Typography variant="caption" sx={{ fontSize: "0.6rem" }}>{v}</Typography><Box sx={{ height: `${(v / maxHc) * 110}px`, bgcolor: i === 11 ? C.glob : C.navy, borderRadius: "4px 4px 0 0" }} /></Box>)}</Stack>
            <Stack direction="row" spacing={0.8} sx={{ mt: 0.5 }}>{months.map((m) => <Typography key={m} variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: "center", fontSize: "0.6rem" }}>{monthLabel(m).slice(0, 3)}</Typography>)}</Stack>
          </SectionCard>
          <SectionCard title="Attrition risk" subtitle="Signals, not judgements — use them to start a conversation" action={<Button size="small" onClick={() => navigate("/people-xp")}>Recognise</Button>} noPad>
            {risks.length === 0 ? <EmptyState title="No one at risk" /> : <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell sx={{ width: 140 }}>Risk</TableCell><TableCell>Why</TableCell></TableRow></TableHead>
              <TableBody>{risks.map((r) => <TableRow key={r.e.employee_code}><TableCell><PersonCell name={r.e.full_name} sub={`${r.e.department} · ${r.e.designation}`} /></TableCell><TableCell><Progress value={r.score} right={r.score} color={r.score >= 60 ? "#B0291F" : C.glob} /></TableCell><TableCell><Typography variant="caption">{r.reasons.join(" · ")}</Typography></TableCell></TableRow>)}</TableBody></Table></TableWrap>}
          </SectionCard>
        </Stack>
        <Stack spacing={2}>
          <SectionCard title="Payroll cost by department" subtitle="₹ / month, all countries"><Stack spacing={1}>{costByDept.map(([d, v], i) => <Progress key={d} label={d} right={money(v, "INR", { compact: true })} value={(v / costByDept[0][1]) * 100} color={i % 2 ? C.glob : C.navy} />)}</Stack></SectionCard>
          <SectionCard title="Headcount by department"><Stack spacing={1}>{byDept.map(([d, n]) => <Progress key={d} label={d} right={n} value={(n / byDept[0][1]) * 100} color={C.navy} />)}</Stack></SectionCard>
          <SectionCard title="By country"><Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap" }}>{byCountry.map(([c, n]) => <Pill key={c} tone={c === "IN" ? "navy" : "glob"}>{COUNTRIES[c]?.name || c} · {n}</Pill>)}</Stack></SectionCard>
        </Stack>
      </TwoCol>
    </ModuleHub>
  );
}

// ── Setup & data import ─────────────────────────────────────────────────────────
const SETUP = [["company", "Company profile & logo", 1], ["entities", "Legal entities & PF / ESI / PT / TAN numbers", 1], ["statutory_ids", "Statutory registrations per state", 1], ["bank", "Salary bank account", 1], ["import_employees", "Import employees", 2], ["salary_structures", "Salary structures & components", 2], ["opening_balances", "Opening leave balances", 2], ["ytd_import", "Year-to-date payroll (mid-year switch)", 2], ["leave_policy", "Leave rule-sets", 3], ["holidays", "Holiday calendar", 3], ["attendance", "Attendance rules & devices", 3], ["approvers", "Approval chains", 3], ["first_parallel_run", "Parallel run against the old system", 4], ["go_live", "Go live", 5]];
const SOURCES = ["Excel / CSV spreadsheet", "Keka", "greytHR", "Zoho People", "Darwinbox", "Tally payroll", "ADP", "Other HRMS"];
const REQUIRED = ["full_name", "email", "department", "designation", "date_of_joining", "monthly_gross"];
const OPTIONAL = ["reporting_manager", "country_code", "region", "city", "gender", "date_of_birth", "pan", "uan", "bank_name", "bank_account", "bank_ifsc", "grade_code", "phone"];

export function SetupImport() {
  const { data, suiteDo, suiteCan, notifyToast, upsertEmployee, user } = useStore();
  const s = data.suite || {};
  const can = user.role === "superadmin";
  const done = SETUP.filter(([k]) => s.setup?.[k]).length;
  const [kind, setKind] = useState("employees");
  const [source, setSource] = useState(SOURCES[0]);
  const [rows, setRows] = useState(null);
  const [map, setMap] = useState({});
  const fileRef = useRef(null);
  const toggle = (k) => suiteDo("setup", (x) => { x.setup[k] = !x.setup[k]; }, { action: "SETUP_STEP", details: k });
  async function onFile(f) {
    if (!f) return;
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const head = lines[0].split(",").map((h) => h.trim());
    const body = lines.slice(1).map((l) => l.split(",").map((x) => x.trim()));
    const auto = {};
    [...REQUIRED, ...OPTIONAL].forEach((k) => { const i = head.findIndex((h) => h.toLowerCase().replace(/[^a-z]/g, "") === k.replace(/_/g, "") || h.toLowerCase().includes(k.split("_")[0])); if (i >= 0) auto[k] = i; });
    setMap(auto); setRows({ head, body, file: f.name });
  }
  const parsed = rows ? rows.body.map((r, i) => { const o = {}; Object.entries(map).forEach(([k, idx]) => { o[k] = r[idx]; }); const errs = REQUIRED.filter((k) => !o[k]); if (o.email && !/^\S+@\S+\.\S+$/.test(o.email)) errs.push("email format"); if (o.email && data.employees.some((e) => e.email === o.email)) errs.push("already exists"); return { i, o, errs }; }) : [];
  function doImport() {
    let ok = 0; const fails = [];
    parsed.filter((p) => !p.errs.length).forEach((p) => {
      const r = upsertEmployee({ ...p.o, monthly_gross: Number(p.o.monthly_gross), country_code: p.o.country_code || "IN", region: p.o.region || "TG", login_id: p.o.email, employment_type: "full_time", worker_type: "permanent", grade_code: p.o.grade_code || "P1", status: "pending_approval" });
      if (r.ok) ok += 1; else fails.push(`${p.o.full_name}: ${Object.values(r.errors || {}).join(", ")}`);
    });
    suiteDo("setup", (x, { now }) => { x.imports = [{ id: `IMP-${Date.now()}`, file: rows.file, kind, source, rows: parsed.length, ok, errors: parsed.length - ok, at: now, by: user.code }, ...(x.imports || [])]; x.setup.import_employees = true; }, { action: "DATA_IMPORT", details: `${rows.file} · ${ok}/${parsed.length}` });
    notifyToast(`${ok} of ${parsed.length} imported${fails.length ? ` — ${fails.length} need fixing` : ""}. New people await account approval.`, fails.length ? "warning" : "success");
    setRows(null);
  }
  const days = [1, 2, 3, 4, 5].map((d) => { const st = SETUP.filter(([, , day]) => day === d); return { label: `Day ${d}`, sub: st.map(([, l]) => l).join(" · "), status: st.every(([k]) => s.setup?.[k]) ? "done" : st.some(([k]) => s.setup?.[k]) ? "running" : "todo" }; });
  return (
    <ModuleHub eyebrow="PLATFORM · SETUP & IMPORT" title="Set up in days, not months" subtitle="A guided go-live checklist and an import wizard that moves your data from spreadsheets or your old system — with validation before anything is saved."
      brief={{ text: <>Go-live <b>{Math.round((done / SETUP.length) * 100)}%</b> complete — {SETUP.length - done} step(s) left. {(s.imports || []).length} import(s) so far.</>, ask: "Walk me through what's left to go live on this HR & payroll system, in order." }}>
      <Stack spacing={2}>
        <Steps steps={days} />
        <TwoCol right={420}>
          <SectionCard title="Import wizard" subtitle="1. Choose what & where from → 2. Upload → 3. Map columns → 4. Validate → 5. Import">
            <Stack spacing={1.5}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField select size="small" label="What" value={kind} onChange={(e) => setKind(e.target.value)} sx={{ flex: 1 }}>{[["employees", "Employees"], ["balances", "Opening leave balances"], ["ytd", "Year-to-date payroll"], ["salary", "Salary structures"]].map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}</TextField>
                <TextField select size="small" label="From" value={source} onChange={(e) => setSource(e.target.value)} sx={{ flex: 1 }}>{SOURCES.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button startIcon={<DownloadRounded />} onClick={() => downloadCsv("employee-import-template.csv", [...REQUIRED, ...OPTIONAL], [["Anita Rao", "anita.rao@example.com", "Engineering", "Software Engineer", isoDate(), 85000, "EMP007", "IN", "TG", "Hyderabad", "F", "1994-05-12", "ABCDE1234F", "", "HDFC Bank", "50100123456789", "HDFC0001234", "P2", "+91 9800000000"]])}>Template</Button>
                <Button variant="contained" startIcon={<UploadFile />} disabled={!can} onClick={() => fileRef.current?.click()}>Upload CSV</Button>
                <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
              </Stack>
              {kind !== "employees" && <Alert severity="info">Opening balances, YTD payroll and salary structures use the same wizard; their templates come with the data from {source}. Our onboarding team does this import with you.</Alert>}
              {rows && (
                <>
                  <Typography variant="body2"><b>{rows.file}</b> · {rows.body.length} rows · {Object.keys(map).length} columns mapped</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>{[...REQUIRED, ...OPTIONAL].map((k) => <TextField key={k} select size="small" label={`${k}${REQUIRED.includes(k) ? " *" : ""}`} value={map[k] ?? ""} onChange={(e) => setMap({ ...map, [k]: e.target.value === "" ? undefined : Number(e.target.value) })}><MenuItem value="">— not in file —</MenuItem>{rows.head.map((h, i) => <MenuItem key={i} value={i}>{h}</MenuItem>)}</TextField>)}</Box>
                  <Alert severity={parsed.some((p) => p.errs.length) ? "warning" : "success"}>{parsed.filter((p) => !p.errs.length).length} ready · {parsed.filter((p) => p.errs.length).length} with errors{parsed.filter((p) => p.errs.length).slice(0, 3).map((p) => ` · row ${p.i + 2}: ${p.errs.join(", ")}`).join("")}</Alert>
                  <Button variant="contained" disabled={!parsed.some((p) => !p.errs.length)} onClick={doImport}>Import {parsed.filter((p) => !p.errs.length).length} row(s)</Button>
                </>
              )}
              {!can && <Hint>Only a Super Admin can import.</Hint>}
            </Stack>
          </SectionCard>
          <Stack spacing={2}>
            <SectionCard title="Go-live checklist" action={<Ring value={done} max={SETUP.length} size={54} stroke={6} label={`${done}/${SETUP.length}`} />}>
              {SETUP.map(([k, l, d]) => <FormControlLabel key={k} sx={{ display: "flex" }} control={<Switch size="small" checked={!!s.setup?.[k]} disabled={!can} onChange={() => toggle(k)} />} label={<Typography variant="body2">Day {d} · {l}</Typography>} />)}
            </SectionCard>
            <SectionCard title="Import history" noPad>{(s.imports || []).map((i) => <Stack key={i.id} direction="row" sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", justifyContent: "space-between" }}><Box><Typography variant="body2">{i.file}</Typography><Typography variant="caption" color="text.secondary">{fmtDateTime(i.at)} · {i.source || "Spreadsheet"}</Typography></Box><Pill tone={i.errors ? "glob" : "mint"}>{i.ok}/{i.rows}</Pill></Stack>)}</SectionCard>
          </Stack>
        </TwoCol>
      </Stack>
    </ModuleHub>
  );
}

// ── Plan & billing ──────────────────────────────────────────────────────────────
// v10.6: two tabs — "My plan" (current plan, cost, invoices, add-ons and the feature coverage of what you have) and
// "Explore plans" (every plan with a suggestion based on your headcount, countries and modules in use).
export function suggestPlan(data) {
  const countries = new Set(data.employees.filter((e) => e.status === "active").map((e) => e.country_code)).size;
  const contingent = data.employees.filter((e) => e.status === "active" && ["contract", "freelance", "consultant", "agency"].includes(e.worker_type)).length;
  if (countries > 1 || (data.suite?.cards || []).length || contingent > 5) return { id: "global", why: `${countries} countries and ${contingent} contingent workers on the payroll — multi-country payroll, EOR and contractor payments fit best.` };
  if (data.employees.length > 10) return { id: "growth", why: "More than 10 employees — Payroll Agent, bank payouts and statutory filing save the most time." };
  return { id: "free", why: "Small team — Core HR, attendance, leave and payroll compute are enough to start." };
}
export function Billing({ tab: initial = "my" }) {
  const { data, suiteDo, notifyToast, user } = useStore();
  const [tab, setTab] = useState(initial);
  const b = data.suite?.billing || {};
  // v10.8: on the server the app holds only a working set — bill on the whole company's headcount
  const n = data.__server?.employees_active ?? data.employees.filter((e) => e.status === "active").length;
  const plan = (b.plans || []).find((p) => p.id === b.plan) || b.plans?.[0];
  const monthly = (p) => p.base + p.per_employee * n;
  const can = user.role === "superadmin";
  const sug = suggestPlan(data);
  const card = (p) => (
    <Card key={p.id} sx={{ p: 2.2, borderWidth: p.id === b.plan || p.id === sug.id ? 2 : 1, borderColor: p.id === b.plan ? C.navy : p.id === sug.id ? "#F27C22" : undefined }}>
      <Stack direction="row" spacing={0.6} sx={{ justifyContent: "space-between" }}><Typography variant="h3">{p.name}</Typography><Stack direction="row" spacing={0.5}>{p.id === sug.id && <Pill tone="glob">suggested</Pill>}{p.id === b.plan && <Pill tone="mint">current</Pill>}</Stack></Stack>
      <Typography sx={{ fontSize: "1.6rem", fontWeight: 800, color: C.navy, mt: 1 }}>{p.per_employee ? `${money(p.per_employee, "INR")}` : "Free"}<Typography component="span" variant="body2" color="text.secondary">{p.per_employee ? " / employee / month" : " for unlimited employees"}</Typography></Typography>
      <Typography variant="caption" color="text.secondary" component="div">{p.base ? `+ ${money(p.base, "INR")} / month platform & bank payouts` : "No card needed"}</Typography>
      <Typography variant="body2" sx={{ mt: 1.2, minHeight: 60 }}>{p.blurb}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, mt: 1 }}>For you: {money(monthly(p), "INR")} / month</Typography>
      {p.id !== b.plan && <Button fullWidth variant="outlined" sx={{ mt: 1.5 }} disabled={!can} onClick={() => { suiteDo("billing", (x) => { x.billing.plan = p.id; }, { action: "PLAN_CHANGE", details: `${b.plan} → ${p.id}` }); notifyToast(`Switched to ${p.name}. Pro-rated from today.`); }}>Switch to {p.name}</Button>}
    </Card>
  );
  return (
    <ModuleHub eyebrow="PLATFORM · PLAN & BILLING" title="Plan & billing" subtitle="One monthly price per active employee. No setup fee, no per-payslip charges, no lock-in."
      tabs={[["my", "My plan"], ["explore", "Explore plans"]]} tab={tab} onTab={setTab}
      brief={{ text: <>You're on <b>{plan?.name}</b> for <b>{n}</b> active employees: <b>{money(monthly(plan), "INR")}</b> / month ({money(plan.base, "INR")} base + {money(plan.per_employee, "INR")} × {n}).{sug.id !== b.plan && <> Suggested: <b>{b.plans.find((p) => p.id === sug.id)?.name}</b> — {sug.why}</>}</> }}>
      {tab === "explore" ? (
        <Stack spacing={2}>
          <Alert severity="info" sx={{ fontSize: "0.72rem" }}><b>Suggestion:</b> {b.plans.find((p) => p.id === sug.id)?.name} — {sug.why}</Alert>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 1.5 }}>{(b.plans || []).map(card)}</Box>
          <SectionCard title="Add-ons" noPad>{(b.addons || []).map(([n2, p]) => <Stack key={n2} direction="row" sx={{ px: 2, py: 0.9, borderBottom: 1, borderColor: "divider", justifyContent: "space-between" }}><Typography variant="body2">{n2}</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{typeof p === "number" ? `${money(p, "INR")} / employee / month` : p}</Typography></Stack>)}</SectionCard>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <TwoCol right={380}>
            <Stack spacing={2}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr" }, gap: 1.5 }}>{plan && card(plan)}</Box>
              <SectionCard title="Invoices" noPad>
                <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Invoice</TableCell><TableCell>Month</TableCell><TableCell align="right">Employees</TableCell><TableCell align="right">Amount (incl. GST)</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                  <TableBody>{(b.invoices || []).map((i) => <TableRow key={i.id}><TableCell>{i.id}</TableCell><TableCell>{monthLabel(i.period)}</TableCell><TableCell align="right">{i.employees}</TableCell><TableCell align="right">{money(i.amount * 1.18, "INR")}</TableCell><TableCell><StatusPill status={i.status} /></TableCell></TableRow>)}</TableBody></Table></TableWrap>
              </SectionCard>
            </Stack>
            <Stack spacing={2}>
              <SectionCard title="No hidden fees">{["No setup or implementation fee", "No charge per payslip, filing or bank file", "Inactive / exited employees are never billed", "No lock-in — cancel any month, export all your data", "Price locked for 12 months", "Support and statutory updates included"].map((t) => <Stack key={t} direction="row" spacing={1} sx={{ py: 0.4 }}><CheckCircle sx={{ fontSize: 16, color: C.mintDeep }} /><Typography variant="body2">{t}</Typography></Stack>)}</SectionCard>
              <SectionCard title="Add-ons" noPad>{(b.addons || []).map(([n2, p]) => <Stack key={n2} direction="row" sx={{ px: 2, py: 0.9, borderBottom: 1, borderColor: "divider", justifyContent: "space-between" }}><Typography variant="body2">{n2}</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{typeof p === "number" ? `${money(p, "INR")}` : p}</Typography></Stack>)}</SectionCard>
            </Stack>
          </TwoCol>
          <Typography sx={{  fontWeight: 800, fontSize: "0.95rem", pt: 1 }}>Feature coverage in my plan</Typography>
          <CoverageEmbed />
        </Stack>
      )}
    </ModuleHub>
  );
}
function CoverageEmbed() {
  const Cov = React.lazy(() => import("./Coverage.jsx"));
  return <React.Suspense fallback={null}><Cov embedded /></React.Suspense>;
}

/** v10.6: Plan & billing card on the Super Admin dashboard. */
export function PlanCard() {
  const { data } = useStore();
  const navigate = useNavigate();
  const b = data.suite?.billing || {};
  // v10.8: on the server the app holds only a working set — bill on the whole company's headcount
  const n = data.__server?.employees_active ?? data.employees.filter((e) => e.status === "active").length;
  const plan = (b.plans || []).find((p) => p.id === b.plan) || b.plans?.[0];
  if (!plan) return null;
  const sug = suggestPlan(data);
  const last = (b.invoices || [])[0];
  return (
    <Card sx={{ p: 2, mb: 2.5, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", bgcolor: "background.paper", borderLeft: "3px solid", borderColor: "primary.main" }}>
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Typography sx={{ fontSize: "0.58rem", fontWeight: 800, letterSpacing: "1px", color: "#66767E" }}>PLAN & BILLING</Typography>
        <Typography sx={{  fontWeight: 800, fontSize: "1.05rem" }}>{plan.name} · {money(plan.base + plan.per_employee * n, "INR")} / month</Typography>
        <Typography variant="body2" color="text.secondary">{n} active employees{last ? ` · last invoice ${last.id} ${last.status}` : ""}{sug.id !== plan.id ? ` · suggested: ${b.plans.find((p) => p.id === sug.id)?.name}` : ""}</Typography>
      </Box>
      <Stack direction="row" spacing={1}><Button variant="contained" onClick={() => navigate("/billing")}>My plan</Button><Button variant="outlined" onClick={() => navigate("/billing?explore=1")}>Explore plans</Button></Stack>
    </Card>
  );
}

// ── Security & backups ──────────────────────────────────────────────────────────
const MODULE_LIST = ["leave", "attendance", "payroll", "payslips", "expense", "benefits", "performance", "recruitment", "onboarding", "compliance", "contracts", "assets", "location", "monitoring"];
export function Security() {
  const { data, suiteDo, notifyToast, user } = useStore();
  const sec = data.suite?.security || {};
  const can = user.role === "superadmin";
  const [restore, setRestore] = useState(null);
  function backup() {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), data })], { type: "application/json" });
    const kb = Math.round(blob.size / 1024);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `peoplehub-backup-${isoDate()}.json`; a.click();
    suiteDo("security", (x, { now }) => { x.security.backups = [{ id: `BK-${Date.now()}`, at: now, kind: "manual", size_kb: kb, status: "ok", by: user.code }, ...x.security.backups]; }, { action: "BACKUP_MANUAL", details: `${kb} KB` });
    notifyToast("Encrypted backup created and downloaded.");
  }
  const admins = data.admins.filter((a) => a.status !== "rejected");
  return (
    <ModuleHub eyebrow="PLATFORM · SECURITY" title="Security, access & backups" subtitle="Encryption everywhere, role-based access to every module, multi-factor sign-in, and automatic backups you can restore."
      actions={<Button variant="contained" startIcon={<Backup />} onClick={backup} disabled={!can}>Back up now</Button>}
      brief={{ text: <>Data is encrypted at rest and in transit. MFA is {data.settings?.require_mfa_admin !== false ? "required" : "optional"} for admins. Last backup <b>{sec.backups?.[0] ? fmtDateTime(sec.backups[0].at) : "—"}</b>.</> }}
      kpis={[{ label: "Encryption", value: "AES-256", hint: "at rest · TLS 1.3 in transit", icon: <Lock />, tone: "navy" }, { label: "MFA coverage", value: `${Math.round((admins.filter((a) => a.mfa_status === "enabled").length / Math.max(1, admins.length)) * 100)}%`, hint: "of admins", icon: <Shield />, tone: "mint" }, { label: "Backups kept", value: sec.backups?.length || 0, hint: sec.backup_schedule?.split("·")[0], icon: <Backup />, tone: "glob" }, { label: "Last pen test", value: sec.last_pen_test ? fmtDate(sec.last_pen_test) : "—", icon: <Shield />, tone: "purple" }]}>
      <Stack spacing={2}>
        <TwoCol right={400}>
          <SectionCard title="Role-based access" subtitle="Who can open which module — change in Users & access" noPad>
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Account</TableCell>{MODULE_LIST.map((m) => <TableCell key={m} align="center" sx={{ fontSize: "0.6rem", px: 0.5 }}>{m}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                <TableRow><TableCell><PersonCell name="Super Admin" sub="all modules" /></TableCell>{MODULE_LIST.map((m) => <TableCell key={m} align="center"><CheckCircle sx={{ fontSize: 16, color: C.navy }} /></TableCell>)}</TableRow>
                {admins.map((a) => <TableRow key={a.admin_code}><TableCell><PersonCell name={a.full_name} sub={`${a.admin_code} · MFA ${a.mfa_status}`} /></TableCell>{MODULE_LIST.map((m) => <TableCell key={m} align="center">{a.modules.includes(m) ? <CheckCircle sx={{ fontSize: 16, color: C.mintDeep }} /> : <Box component="span" sx={{ color: "text.disabled" }}>·</Box>}</TableCell>)}</TableRow>)}
                <TableRow><TableCell><PersonCell name="Employees" sub="self-service only" /></TableCell>{MODULE_LIST.map((m) => <TableCell key={m} align="center"><Box component="span" sx={{ color: "text.disabled" }}>own</Box></TableCell>)}</TableRow>
              </TableBody></Table></TableWrap>
          </SectionCard>
          <Stack spacing={2}>
            <SectionCard title="Protection">
              <Stack spacing={0.8}>
                <Typography variant="body2"><b>At rest:</b> {sec.encryption_at_rest}</Typography>
                <Typography variant="body2"><b>In transit:</b> {sec.encryption_in_transit}</Typography>
                <Typography variant="body2"><b>Field-level encryption:</b> {(sec.field_encryption || []).join(", ")}</Typography>
                <Typography variant="body2"><b>Sign-in:</b> MFA + device fingerprint, lockout after failed attempts, {data.settings?.session_timeout_min || sec.session_minutes} min idle timeout{sec.sso ? ", SSO on" : ""}</Typography>
                <Typography variant="body2"><b>IP allow-list:</b> {(sec.ip_allowlist || []).join(", ") || "off"}</Typography>
                <Typography variant="body2"><b>Certifications:</b> {(sec.certifications || []).join(" · ")}</Typography>
              </Stack>
            </SectionCard>
            <SectionCard title="Backups & restore" subtitle={sec.backup_schedule} noPad>
              {(sec.backups || []).map((b) => <Stack key={b.id} direction="row" sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", justifyContent: "space-between", alignItems: "center" }}><Box><Typography variant="body2">{fmtDateTime(b.at)}</Typography><Typography variant="caption" color="text.secondary">{b.kind} · {b.size_kb} KB</Typography></Box><Button size="small" startIcon={<Restore />} disabled={!can} onClick={() => setRestore(b)}>Restore</Button></Stack>)}
            </SectionCard>
          </Stack>
        </TwoCol>
      </Stack>
      <Dialog open={!!restore} onClose={() => setRestore(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Restore this backup?</DialogTitle>
        <DialogContent><Typography variant="body2">Everything after {restore && fmtDateTime(restore.at)} would be replaced. A restore is done by our support team after a second Super Admin approves — we'll raise the request now.</Typography></DialogContent>
        <DialogActions><Button onClick={() => setRestore(null)}>Cancel</Button><Button variant="contained" color="error" onClick={() => { suiteDo("security", () => ({}), { action: "RESTORE_REQUEST", details: restore.id }); notifyToast("Restore request raised — awaiting second approval."); setRestore(null); }}>Request restore</Button></DialogActions>
      </Dialog>
    </ModuleHub>
  );
}

// ── Expert support ──────────────────────────────────────────────────────────────
const LANGS = ["English", "हिन्दी Hindi", "తెలుగు Telugu", "தமிழ் Tamil", "ಕನ್ನಡ Kannada", "मराठी Marathi", "বাংলা Bengali", "ગુજરાતી Gujarati", "العربية Arabic", "Kiswahili", "Français", "Deutsch", "Español", "Português", "Bahasa"];
const AREAS = ["Payroll law", "Statutory filing", "Bank payouts", "Setup & import", "Leave & attendance", "Product question"];
export function ExpertSupport() {
  const { data, suiteDo, notifyToast, user } = useStore();
  const tickets = data.suite?.supportTickets || [];
  const [f, setF] = useState({ topic: "", area: AREAS[0], language: LANGS[0], country: "IN", callback: false, phone: "" });
  function send() {
    const r = suiteDo("support", (x, { now }) => { x.supportTickets = [{ id: `EXP-${119 + x.supportTickets.length}`, ...f, status: "open", expert: `${f.country === "IN" ? "Payroll compliance team (India)" : `${COUNTRIES[f.country]?.name} payroll expert`} · ${f.language.split(" ").pop()}`, at: now, by: user.code }, ...x.supportTickets]; }, { action: "EXPERT_TICKET", details: `${f.area} · ${f.language}` });
    if (r.ok) { notifyToast(f.callback ? "An expert will call you back within 2 working hours." : "Sent — a payroll expert replies within 4 working hours."); setF({ ...f, topic: "" }); }
  }
  return (
    <ModuleHub eyebrow="SUPPORT · EXPERTS" title="Help from people who know local payroll law" subtitle="Talk to payroll and compliance specialists in your language — by chat, email or a call back. Included in every plan."
      brief={{ text: <>Average first reply <b>38 minutes</b> · {LANGS.length} languages · experts for {Object.keys(COUNTRIES).length} countries.</> }}
      kpis={[{ label: "Open questions", value: tickets.filter((t) => t.status === "open").length, icon: <SupportAgent />, tone: "glob" }, { label: "Languages", value: LANGS.length, icon: <Translate />, tone: "navy" }, { label: "Resolved", value: tickets.filter((t) => ["resolved", "answered"].includes(t.status)).length, icon: <CheckCircle />, tone: "mint" }]}>
      <TwoCol right={420}>
        <SectionCard title="Your questions" noPad>
          {tickets.length === 0 ? <EmptyState title="No questions yet" /> : <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Ticket</TableCell><TableCell>Topic</TableCell><TableCell>Language</TableCell><TableCell>Expert</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
            <TableBody>{tickets.map((t) => <TableRow key={t.id}><TableCell>{t.id}</TableCell><TableCell><Typography variant="body2">{t.topic}</Typography><Typography variant="caption" color="text.secondary">{t.area} · {fmtDateTime(t.at)}</Typography></TableCell><TableCell>{t.language}</TableCell><TableCell><Typography variant="caption">{t.expert}</Typography></TableCell><TableCell><StatusPill status={t.status} /></TableCell></TableRow>)}</TableBody></Table></TableWrap>}
        </SectionCard>
        <SectionCard title="Ask an expert">
          <Stack spacing={1.5}>
            <TextField size="small" label="Your question" multiline minRows={3} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />
            <Stack direction="row" spacing={1}><TextField select size="small" label="Area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} sx={{ flex: 1 }}>{AREAS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}</TextField><TextField select size="small" label="Country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} sx={{ flex: 1 }}>{Object.entries(COUNTRIES).map(([k, v]) => <MenuItem key={k} value={k}>{v.name}</MenuItem>)}</TextField></Stack>
            <TextField select size="small" label="Language" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}>{LANGS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}</TextField>
            <FormControlLabel control={<Switch checked={f.callback} onChange={(e) => setF({ ...f, callback: e.target.checked })} />} label="Call me back" />
            {f.callback && <TextField size="small" label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}
            <Button variant="contained" disabled={!f.topic} onClick={send}>Send to an expert</Button>
          </Stack>
        </SectionCard>
      </TwoCol>
    </ModuleHub>
  );
}
