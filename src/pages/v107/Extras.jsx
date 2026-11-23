// v10.7 · Review of 20 Nov 2026 (evening):
//  • Leave & holidays: the holiday list under Calendar & tasks (Country space left My profile).
//  • Statutory enrolments: employees add PF / ESI / NPS / nominations with a + button → HR approves.
//  • Salary loan access: Finance enables or disables the loan request per employee (after 1 year of service).
//  • IT support response time (30 min – 1 hour) on IT support & my assets.
//  • Contract & freelance payslips (Sep 2026) on My contract & payment.
//  • Chat with EZY Support for the Super Admin.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Avatar, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AddRounded, CelebrationRounded, DownloadRounded, SendRounded, SupportAgentRounded, TimerRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, Tag, EmptyState, TableWrap, PersonCell, Mono } from "../../components/kit/UI.jsx";
import { holidaysFor } from "../../country/countryPacks.js";
import { fmtDate, fmtNum, isoDate, timeAgo } from "../../lib/utils.js";
import { isContingent } from "../../data/employeeFields.js";
import { enquiries } from "../WelcomePage.jsx";
import { adminKind } from "../../lib/statutory.js";
import { APP_CONFIG } from "../../data/seed.js";

// ── Leave & holidays ─────────────────────────────────────────────────────────
export function HolidaysCard() {
  const { data, user } = useStore();
  const me = data.employees.find((e) => e.employee_code === user.employee_code);
  const year = new Date().getFullYear();
  const list = holidaysFor(data, me).filter((h) => String(h.date).startsWith(String(year)) || String(h.date).startsWith(String(year + 1))).sort((a, b) => a.date.localeCompare(b.date));
  const today = isoDate();
  const next = list.find((h) => h.date >= today);
  return (
    <SectionCard title={`Holidays ${year}`} subtitle={`${list.filter((h) => h.type !== "optional").length} public holidays${list.some((h) => h.type === "optional") ? ` · ${list.filter((h) => h.type === "optional").length} optional` : ""}${next ? ` · next: ${next.name} on ${fmtDate(next.date)}` : ""}`} noPad>
      {list.length === 0 ? <EmptyState title="No holidays published" text="HR publishes the holiday calendar for your country." /> : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0,1fr))", xl: "repeat(3, minmax(0,1fr))" } }}>
          {list.map((h) => {
            const past = h.date < today;
            return (
              <Stack key={`${h.date}-${h.name}`} direction="row" spacing={1.2} sx={{ px: 2, py: 1, borderBottom: "1px solid #eef1f2", alignItems: "center", opacity: past ? 0.5 : 1, background: next?.date === h.date ? "#FFF8DB" : undefined }}>
                <Box sx={{ width: 44, textAlign: "center", borderRadius: 1.5, py: 0.4, background: h.type === "optional" ? "#F1ECFA" : "#E7F2FD", color: h.type === "optional" ? "#7E57C2" : "#1E88E5" }}>
                  <Typography sx={{ fontSize: "0.55rem", fontWeight: 800 }}>{new Date(`${h.date}T12:00:00`).toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}</Typography>
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 800, lineHeight: 1 }}>{Number(h.date.slice(8, 10))}</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{h.name}</Typography>
                  <Typography sx={{ fontSize: "0.6rem", color: "#7b878c" }}>{new Date(`${h.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long" })}{h.type === "optional" ? " · optional (pick one)" : ""}</Typography>
                </Box>
              </Stack>
            );
          })}
        </Box>
      )}
    </SectionCard>
  );
}

// ── Statutory enrolments (+ to add, HR approves) ─────────────────────────────
export const ENROLMENTS = [
  ["pf", "Provident Fund (PF / EPF)", "UAN", "uan"],
  ["eps", "PF number (member ID)", "PF member ID", "pf_number"],
  ["esi", "ESI (ESIC IP number)", "IP number", "esic_number"],
  ["nps", "NPS (PRAN)", "PRAN", "nps_pran"],
  ["form2", "Form 2 · PF / EPS nomination", "Nominee name", null],
  ["formf", "Form F · gratuity nomination", "Nominee name", null],
  ["form11", "Form 11 · EPF declaration", "Declaration date", null],
  ["pt", "Professional tax (state)", "State", null],
  ["lwf", "Labour welfare fund (state)", "State", null],
];
export function StatutoryEnrolments() {
  const { data, user, suiteDo, notifyToast } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "pf", number: "", date: isoDate(), note: "", file: "" });
  const mine = (data.suite?.selfReq || []).filter((r) => r.type === "enrolment" && r.employee_code === user.employee_code);
  const def = ENROLMENTS.find((e) => e[0] === f.kind);
  function submit() {
    if (!f.number.trim()) return notifyToast(`Enter the ${def[2]}.`, "error");
    const r = suiteDo("self106", (s, { x, me, now }) => {
      s.selfReq = s.selfReq || [];
      const id = `ENR-${String(s.selfReq.filter((q) => q.type === "enrolment").length + 1).padStart(4, "0")}`;
      s.selfReq.unshift({ id, type: "enrolment", employee_code: me, kind: f.kind, kind_label: def[1], field: def[3], number: f.number.trim(), date: f.date, reason: f.note, file: f.file, status: "pending", created_at: now });
      (x.admins || []).filter((a) => a.status === "active" && ["hr", "hr_finance"].includes(adminKind({ ...a, role: "admin" }))).forEach((a) => x.notifications.unshift({ id: `N-${Date.now()}-${a.admin_code}`, to: a.admin_code, text: `${user.full_name} added a statutory enrolment: ${def[1]} (${id}).`, at: now, read: false, link: "/emp-requests" }));
      return { id };
    }, { action: "ENROLMENT_ADD", details: (x) => `${x.id} · ${def[1]}` });
    if (!r.ok) return notifyToast(r.error, "error");
    notifyToast("Sent to HR for verification.");
    setOpen(false);
    setF({ kind: "pf", number: "", date: isoDate(), note: "", file: "" });
  }
  return (
    <SectionCard title="Government & statutory enrolments" subtitle="PF, ESI, NPS and nominations. Add one with + — HR verifies it and updates your record." action={<Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setOpen(true)}>Add enrolment</Button>} noPad>
      <TableWrap>
        <Table size="small" sx={{ minWidth: 640 }}>
          <TableHead><TableRow><TableCell>Enrolment</TableCell><TableCell>Number / detail</TableCell><TableCell>On record</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
          <TableBody>
            {ENROLMENTS.map(([k, l, , field]) => {
              const req = mine.find((r) => r.kind === k);
              const rec = field ? user[field] : null;
              if (!req && !rec) return null;
              return <TableRow key={k}><TableCell>{l}</TableCell><TableCell>{req?.number || "—"}</TableCell><TableCell>{rec || "—"}</TableCell><TableCell>{req ? <Tag tone={req.status === "approved" ? "good" : req.status === "rejected" ? "bad" : "warn"}>{req.status === "pending" ? "With HR" : req.status}</Tag> : <Tag tone="good">on record</Tag>}</TableCell></TableRow>;
            })}
            {!mine.length && !ENROLMENTS.some((e) => e[3] && user[e[3]]) && <TableRow><TableCell colSpan={4}><Typography variant="body2" color="text.secondary">No enrolments yet — use Add enrolment.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableWrap>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Add a statutory enrolment</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField select label="Enrolment" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{ENROLMENTS.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}</TextField>
            <TextField label={`${def[2]} *`} value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />
            <TextField type="date" label="Date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            <Button component="label" variant="outlined" size="small">{f.file || "Attach proof (optional)"}<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const x = e.target.files?.[0]; if (x) setF({ ...f, file: x.name }); }} /></Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={submit}>Send to HR</Button></DialogActions>
      </Dialog>
    </SectionCard>
  );
}

// ── Salary loan access (Finance) ─────────────────────────────────────────────
const validDate = (v) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v) : null);
export const tenureMonths = (e) => { const d = validDate(e?.date_of_joining); return d ? Math.floor((Date.now() - d) / (30.44 * 86400000)) : 0; };
// v10.8: the day a person completes one year (null when the joining date is missing or invalid, e.g. after a CSV import)
const oneYearOn = (e) => { const d = validDate(e?.date_of_joining); if (!d) return null; d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };
/** { ok, reason } — loans need 12 months of service and Finance to have enabled the employee. */
export function loanAccessOf(data, e) {
  const months = tenureMonths(e);
  const set = data.suite?.loanAccess?.[e?.employee_code];
  if (months < 12) return { ok: false, reason: `Salary loans open after 1 year of service — you have ${months} month(s).`, months };
  if (set === false) return { ok: false, reason: "Salary loan requests are switched off for you by Finance.", months };
  if (set !== true && data.settings.loan_auto_enable === false) return { ok: false, reason: "Finance hasn't enabled salary loans for you yet.", months };
  return { ok: true, months };
}
export function LoanAccessAdmin() {
  const { data, user, suiteDo, updateSettings, notifyToast } = useStore();
  const [q, setQ] = useState("");
  const can = user.role === "superadmin" || ["finance", "hr_finance"].includes(adminKind(user));
  const rows = data.employees.filter((e) => e.status === "active" && !isContingent(e) && (!q || `${e.full_name} ${e.employee_code} ${e.department}`.toLowerCase().includes(q.toLowerCase())));
  const set = (e, v) => { const r = suiteDo("admin106", (s) => { s.loanAccess = { ...(s.loanAccess || {}), [e.employee_code]: v }; }, { action: "LOAN_ACCESS", details: `${e.employee_code} → ${v ? "enabled" : "disabled"}`, note: { to: e.employee_code, text: v ? "Salary loan requests are now open for you (Pay & benefits → Tax, salary & loan)." : "Salary loan requests were switched off for you by Finance.", link: "/finances-manage" } }); if (!r.ok) notifyToast(r.error, "error"); };
  const auto = data.settings.loan_auto_enable !== false;
  return (
    <>
      <PageHeader title="Salary loan access" subtitle="Finance enables or disables the salary-loan request for each employee. Loans open only after one year of employment. When Finance approves a loan, HR is notified." />
      <Card sx={{ p: 1.6, mb: 2, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", borderLeft: "5px solid #1F9D63" }}>
        <Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 800, fontSize: "0.8rem" }}>Enable automatically after 1 year of service</Typography><Typography variant="body2" color="text.secondary">Off: nobody can request a loan until Finance switches them on below.</Typography></Box>
        <Switch checked={auto} disabled={!can} onChange={(e) => { updateSettings({ loan_auto_enable: e.target.checked }); notifyToast(e.target.checked ? "Loans open automatically after 1 year." : "Loans now need Finance to enable each person."); }} />
        <TextField size="small" placeholder="Search employees" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 240 }} />
      </Card>
      <SectionCard noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Joined</TableCell><TableCell align="right">Service</TableCell><TableCell>Eligible (1 year)</TableCell><TableCell>Open loans</TableCell><TableCell>Loan request</TableCell></TableRow></TableHead>
            <TableBody>{rows.map((e) => {
              const acc = loanAccessOf(data, e);
              const months = tenureMonths(e);
              const set0 = data.suite?.loanAccess?.[e.employee_code];
              const open = data.requests.filter((r) => r.type === "loan" && r.employee_code === e.employee_code && ["Pending", "Approved", "Disbursed"].includes(r.status) && !r.closed).length;
              return (
                <TableRow key={e.employee_code} hover>
                  <TableCell><PersonCell name={e.full_name} sub={`${e.employee_code} · ${e.department}`} /></TableCell>
                  <TableCell>{fmtDate(e.date_of_joining)}</TableCell>
                  <TableCell align="right">{Math.floor(months / 12)} y {months % 12} m</TableCell>
                  <TableCell>{months >= 12 ? <Tag tone="good">Yes</Tag> : oneYearOn(e) ? <Tag tone="neutral">After {fmtDate(oneYearOn(e))}</Tag> : <Tag tone="warn">Joining date missing</Tag>}</TableCell>
                  <TableCell>{open || "—"}</TableCell>
                  <TableCell><Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Switch size="small" checked={acc.ok || (months < 12 && set0 === true)} disabled={!can || months < 12} onChange={(ev) => set(e, ev.target.checked)} /><Typography variant="caption" color="text.secondary">{months < 12 ? "Not yet eligible" : acc.ok ? (set0 === true ? "Enabled by Finance" : "Enabled (automatic)") : "Disabled"}</Typography></Stack></TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
    </>
  );
}

// ── IT support response time ─────────────────────────────────────────────────
export function ItSupportTatCard() {
  const { data } = useStore();
  const tat = data.settings.support_tat || {};
  const min = tat.it_min_minutes || 30;
  const max = tat.it_max_minutes || 60;
  return (
    <Card sx={{ p: 2, mb: 2.5, bgcolor: "info.light", borderLeft: "3px solid", borderColor: "info.main" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: "0.58rem", fontWeight: 800, letterSpacing: "1px", color: "#1E88E5" }}>IT SUPPORT · RESPONSE TIME (TAT)</Typography>
          <Typography sx={{  fontWeight: 800, fontSize: "0.95rem" }}>IT responds within {min} minutes to {max / 60 === 1 ? "1 hour" : `${max} minutes`}</Typography>
          <Typography variant="body2" color="text.secondary">Critical (can't work): {min} min · High: 45 min · Normal and low: within {max / 60 === 1 ? "1 hour" : `${max} min`} during working hours.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>{[["Critical", `${min} min`, "#E53950"], ["High", "45 min", "#F27C22"], ["Normal / low", max / 60 === 1 ? "1 hour" : `${max} min`, "#1F9D63"]].map(([l, t, c]) => <Chip key={l} icon={<TimerRounded />} label={`${l} · ${t}`} sx={{ fontWeight: 700, bgcolor: "#fff", color: c, border: `1px solid ${c}55` }} />)}</Stack>
      </Stack>
    </Card>
  );
}

// ── Contract & freelance payslips ────────────────────────────────────────────
function contractSlip(data, e, c, period) {
  const ts = (data.timesheets || []).filter((t) => t.contract_id === c.id && String(t.week_start).slice(0, 7) === period && ["approved", "paid", "processed"].includes(t.status));
  const hrsTs = ts.reduce((s, t) => s + t.entries.reduce((a, x) => a + (Number(x.hours) || 0), 0), 0);
  const otTs = ts.reduce((s, t) => s + t.entries.reduce((a, x) => a + (Number(x.ot_hours) || 0), 0), 0);
  const rate = Number(c.rate || c.pay_rate || e.pay_rate) || 0;
  const basis = c.pay_basis || e.pay_basis || "hourly";
  const hours = hrsTs || (basis === "hourly" ? Math.round((Number(e.std_hours_week) || 40) * 4.3) : 0);
  const days = basis === "daily" ? 21 : 0;
  const gross = basis === "monthly" ? rate : basis === "daily" ? rate * days : basis === "milestone" ? Math.round(rate / 3) : hours * rate;
  const otPay = Math.round(otTs * rate * (Number(c.ot_multiplier || e.ot_multiplier) || 1.5));
  const total = gross + otPay;
  const sec = e.tds_section || (["freelance", "consultant"].includes(e.worker_type) ? "194J" : "194C");
  const tdsRate = sec === "194J" ? 0.1 : 0.02;
  const gst = e.gst_registered === "yes" ? Math.round(total * 0.18) : 0;
  const tds = Math.round(total * tdsRate);
  return { period, basis, rate, hours, days, otHours: otTs, gross, otPay, total, gst, tds, sec, net: total + gst - tds, weeks: ts.length };
}
export function ContractPayslips({ c, me }) {
  const { data } = useStore();
  const periods = ["2026-09", "2026-10"].filter((p) => p >= String(c.start_date || "").slice(0, 7));
  const [period, setPeriod] = useState(periods[0] || "2026-09");
  if (!c) return null;
  const sl = contractSlip(data, me, c, period);
  const label = new Date(`${period}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const unit = sl.basis === "monthly" ? "Monthly fee" : sl.basis === "daily" ? `${sl.days} days × ₹${fmtNum(sl.rate)}` : sl.basis === "milestone" ? "Milestone payment" : `${sl.hours} hours × ₹${fmtNum(sl.rate)}`;
  async function download() {
    const d = await import("docx");
    const { Document, Packer, Paragraph, TextRun, Table: T, TableRow: TR, TableCell: TC, WidthType } = d;
    const row = (a, b, bold) => new TR({ children: [new TC({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: a, bold })] })] }), new TC({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: b, bold })] })] })] });
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ children: [new TextRun({ text: data.settings.payslip_company?.legal_name || APP_CONFIG.companyName, bold: true, size: 28 })] }),
      new Paragraph({ children: [new TextRun({ text: `${me.worker_type === "freelance" ? "Freelancer" : "Contract worker"} payslip · ${label}`, bold: true, size: 24 })] }),
      new Paragraph({ children: [new TextRun(`${me.full_name} · ${me.employee_code} · ${c.id} · ${c.title || me.designation}`)] }),
      new Paragraph(""),
      new T({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [row("Fee", "Amount (₹)", true), row(unit, fmtNum(sl.gross)), ...(sl.otPay ? [row(`Overtime ${sl.otHours} h`, fmtNum(sl.otPay))] : []), ...(sl.gst ? [row("GST 18%", fmtNum(sl.gst))] : []), row(`TDS u/s ${sl.sec}`, `− ${fmtNum(sl.tds)}`), row("Net payable", fmtNum(sl.net), true)] }),
      new Paragraph(""),
      new Paragraph({ children: [new TextRun({ text: "Contract / freelance engagement — not a salary; PF, ESI and gratuity do not apply. TDS certificate (Form 16A) is issued quarterly.", italics: true, size: 18 })] }),
    ] }] });
    const blob = await Packer.toBlob(doc);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Payslip_${me.employee_code}_${period}.docx`; a.click();
  }
  return (
    <SectionCard title={`Payslip · ${label}`} subtitle={`${me.worker_type === "freelance" ? "Freelance" : "Contract"} fee statement from the contractor pay run${sl.weeks ? ` · ${sl.weeks} approved timesheet week(s)` : ""}`}
      action={<Stack direction="row" spacing={1}><TextField select size="small" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ minWidth: 150 }}>{periods.map((p) => <MenuItem key={p} value={p}>{new Date(`${p}-01T12:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</MenuItem>)}</TextField><Button size="small" variant="contained" startIcon={<DownloadRounded />} onClick={download}>Download</Button></Stack>}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, gap: 1.5 }}>
        {[["Fee", `₹${fmtNum(sl.gross)}`, unit], ["Overtime", `₹${fmtNum(sl.otPay)}`, `${sl.otHours} h`], ["GST", `₹${fmtNum(sl.gst)}`, sl.gst ? "18% (GST registered)" : "Not registered"], [`TDS ${sl.sec}`, `− ₹${fmtNum(sl.tds)}`, sl.sec === "194J" ? "10% professional fees" : "2% contract work"], ["Net payable", `₹${fmtNum(sl.net)}`, "Paid by bank transfer"]].map(([l, v, h]) => (
          <Box key={l} sx={{ p: 1.2, borderRadius: 2, background: l === "Net payable" ? "#E6F6EE" : "#f6f8f9" }}><Typography sx={{ fontSize: "0.6rem", color: "#6b777c" }}>{l}</Typography><Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>{v}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#7b878c" }}>{h}</Typography></Box>
        ))}
      </Box>
    </SectionCard>
  );
}

// ── Chat with EZY Support (Super Admin) ──────────────────────────────────────
const TOPICS = ["Payroll run help", "Statutory filing (PF / ESI / TDS)", "Add users or locations", "Billing & invoices", "Data import", "Report a bug"];
function autoReply(text, n) {
  const t = text.toLowerCase();
  const ticket = `EZY-${String(4100 + n).padStart(5, "0")}`;
  if (/bill|invoice|plan|price/.test(t)) return `Thanks — billing questions go to our accounts desk. I've opened ticket ${ticket}; you'll hear back within 2 business hours. Your plan details are under Platform → Plan & billing.`;
  if (/payroll|pf|esi|tds|filing|challan/.test(t)) return `Got it. A payroll specialist is picking this up (ticket ${ticket}). Meanwhile, check Payroll Agent → Data taken for this payroll — most issues show up there. Typical response: 30 minutes.`;
  if (/bug|error|not working|issue|crash/.test(t)) return `Sorry about that. I've logged ticket ${ticket} with priority High. Please share the screen name and steps; a screenshot helps. Engineering responds within 1 hour.`;
  if (/import|upload|data/.test(t)) return `Our onboarding team can import it for you. Share the file in this chat or use Platform → Setup & data import. Ticket ${ticket}.`;
  return `Thanks for reaching out — an EZY Support agent has been assigned (ticket ${ticket}) and will reply here shortly. Typical first response: 30 minutes during business hours.`;
}
export function EzySupportChat() {
  const { data, user, suiteDo } = useStore();
  const thread = data.suite?.ezySupport || [];
  const [text, setText] = useState("");
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [thread.length]);
  function send(msg) {
    const body = (msg ?? text).trim();
    if (!body) return;
    suiteDo("admin106", (s, { now, code }) => {
      s.ezySupport = [...(s.ezySupport || []), { from: code, me: true, text: body, at: now }];
      s.ezySupport.push({ from: "EZY Support", me: false, text: autoReply(body, s.ezySupport.length), at: new Date(Date.now() + 2000).toISOString() });
    }, { action: "EZY_SUPPORT_MESSAGE", details: body.slice(0, 80) });
    setText("");
  }
  return (
    <>
      <PageHeader title="Chat with EZY Support" subtitle="Reach the EZY HR product team directly — payroll and statutory specialists, billing and engineering. Every conversation gets a ticket number." />
      <Card sx={{ display: "flex", flexDirection: "column", height: "min(640px, 72vh)", overflow: "hidden" }}>
        <Stack direction="row" spacing={1.2} sx={{ px: 2, py: 1.2, borderBottom: "1px solid", borderColor: "divider", alignItems: "center", bgcolor: "background.paper" }}>
          <Avatar sx={{ bgcolor: "#263238", width: 34, height: 34 }}><SupportAgentRounded fontSize="small" /></Avatar>
          <Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 800, fontSize: "0.8rem" }}>EZY Support</Typography><Typography sx={{ fontSize: "0.6rem", color: "#1F9D63" }}>● Online · replies in ~30 min</Typography></Box>
          <Chip size="small" label={`${thread.filter((m) => !m.me).length} replies`} />
        </Stack>
        <Box sx={{ flex: 1, overflowY: "auto", p: 2, background: "#f7f9fa" }}>
          {thread.length === 0 && (
            <Stack spacing={1.5} sx={{ alignItems: "center", mt: 4 }}>
              <Typography variant="body2" color="text.secondary">Hi {user.full_name.split(" ")[0]} — how can we help? Pick a topic or type below.</Typography>
              <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: "wrap", justifyContent: "center" }}>{TOPICS.map((t) => <Chip key={t} label={t} onClick={() => send(t)} sx={{ fontWeight: 700 }} />)}</Stack>
            </Stack>
          )}
          <Stack spacing={1}>
            {thread.map((m, i) => (
              <Box key={i} sx={{ alignSelf: m.me ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                <Box sx={{ px: 1.5, py: 1, borderRadius: 3, background: m.me ? "#15414F" : "#fff", color: m.me ? "#fff" : "#17404D", border: m.me ? "none" : "1px solid #e3e9ec", fontSize: "0.72rem" }}>{m.text}</Box>
                <Typography sx={{ fontSize: "0.55rem", color: "#9aa7ac", textAlign: m.me ? "right" : "left", mt: 0.2 }}>{m.me ? "You" : "EZY Support"} · {timeAgo(m.at)}</Typography>
              </Box>
            ))}
            <div ref={end} />
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} sx={{ p: 1.2, borderTop: "1px solid #e3e9ec" }}>
          <TextField size="small" fullWidth placeholder="Type your message to EZY Support" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <Button variant="contained" endIcon={<SendRounded />} onClick={() => send()}>Send</Button>
        </Stack>
      </Card>
      {user.role === "superadmin" && (() => { const list = enquiries(); return (
        <SectionCard title="Website enquiries & subscriptions" subtitle="From the Contact → employee count → pricing page shown before sign-in." noPad sx={{ mt: 2 }}>
          {list.length === 0 ? <EmptyState title="No enquiries yet" text="New visitors' contact details, employee count and chosen plan appear here." /> : (
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>When</TableCell><TableCell>Contact</TableCell><TableCell>Company</TableCell><TableCell align="right">Employees</TableCell><TableCell>Plan</TableCell><TableCell align="right">≈ / month</TableCell></TableRow></TableHead>
              <TableBody>{list.map((q) => <TableRow key={q.id}><TableCell>{fmtDate(q.at)}</TableCell><TableCell>{q.name}<Typography variant="caption" display="block" color="text.secondary">{q.email} · {q.phone}</Typography></TableCell><TableCell>{q.company}<Typography variant="caption" display="block" color="text.secondary">{q.country}</Typography></TableCell><TableCell align="right">{q.employees}</TableCell><TableCell><Tag tone="info">{q.plan_name} · {q.billing}</Tag></TableCell><TableCell align="right">₹{fmtNum(q.monthly_estimate)}</TableCell></TableRow>)}</TableBody></Table></TableWrap>
          )}
        </SectionCard>
      ); })()}
    </>
  );
}

export { CelebrationRounded };
