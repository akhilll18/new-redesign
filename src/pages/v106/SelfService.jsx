// v10.6 · Employee self-service additions from the review notes, and the HR side of the new requests:
//  • Bank-details change request (Pay & statutory) — HR approves, the record updates and Finance is told.
//  • Learning request (Learning → My learning) — the manager / HR approve and enrol.
//  • Contract period & end date (Employment, for contract workers).
//  • HR / IT support response times (TAT) and one "Contact support" card.
//  • Leave rules & regulations box (Request leave) and the LOP notice when a balance is exhausted.
//  • HR queue for these requests (Inbox & approvals → Employee requests).
import React, { useState } from "react";
import ListSelect from "../../components/kit/ListSelect.jsx";
import { Alert, Autocomplete, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AccountBalanceRounded, SchoolRounded, TimerRounded, SupportAgentRounded, GavelRounded, EventBusyRounded, PhoneRounded, MailRounded, ChatRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, Tag, EmptyState, TableWrap, PersonCell, Mono } from "../../components/kit/UI.jsx";
import { fmtDate, timeAgo, maskAccount } from "../../lib/utils.js";
import { adminKind } from "../../lib/statutory.js";

const STATUS_TONE = { pending: "warn", approved: "good", rejected: "bad", enrolled: "good" };
const hrAdmins = (x) => (x.admins || []).filter((a) => a.status === "active" && ["hr", "hr_finance"].includes(adminKind({ ...a, role: "admin" }))).map((a) => a.admin_code);
const finAdmins = (x) => (x.admins || []).filter((a) => a.status === "active" && ["finance", "hr_finance"].includes(adminKind({ ...a, role: "admin" }))).map((a) => a.admin_code);
const note = (x, to, text, link, now) => to.forEach((c) => x.notifications.unshift({ id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, to: c, text, at: now, read: false, link }));

export function BankChangeRequest() {
  const { data, user, suiteDo, notifyToast } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ bank_name: "", bank_account: "", bank_ifsc: "", reason: "" });
  const mine = (data.suite?.selfReq || []).filter((r) => r.type === "bank" && r.employee_code === user.employee_code);
  const pending = mine.find((r) => r.status === "pending");
  function submit() {
    if (!f.bank_name.trim() || !/^\d{9,18}$/.test(f.bank_account) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(f.bank_ifsc.toUpperCase())) return notifyToast("Enter the bank name, a 9–18 digit account number and a valid IFSC (like HDFC0001234).", "error");
    const r = suiteDo("self106", (s, { x, me, now }) => {
      s.selfReq = s.selfReq || [];
      const id = `BNK-${String(s.selfReq.filter((q) => q.type === "bank").length + 1).padStart(4, "0")}`;
      s.selfReq.unshift({ id, type: "bank", employee_code: me, ...f, bank_ifsc: f.bank_ifsc.toUpperCase(), status: "pending", created_at: now });
      note(x, hrAdmins(x), `${user.full_name} asked to change their bank details (${id}).`, "/emp-requests", now);
      return { id };
    }, { action: "BANK_CHANGE_REQUEST", details: (r) => r.id });
    if (!r.ok) return notifyToast(r.error, "error");
    notifyToast("Request sent to HR. Your salary goes to the new account once HR approves it.");
    setOpen(false);
  }
  return (
    <SectionCard title="Bank details" subtitle="Salary, reimbursements and payouts go to this account. Changes are approved by HR and shared with Finance." action={<Button size="small" variant="contained" startIcon={<AccountBalanceRounded />} disabled={!!pending} onClick={() => { setF({ bank_name: user.bank_name || "", bank_account: "", bank_ifsc: "", reason: "" }); setOpen(true); }}>{pending ? "Change request pending" : "Request bank change"}</Button>}>
      <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: "wrap" }}>
        {[["Bank", user.bank_name], ["Account", maskAccount(user.bank_account || "")], ["IFSC", user.bank_ifsc]].map(([l, v]) => <Box key={l}><Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{l}</Typography><Typography sx={{ fontSize: "0.74rem", fontWeight: 700 }}>{v || "—"}</Typography></Box>)}
      </Stack>
      {mine.length > 0 && <Stack spacing={0.5} sx={{ mt: 1.5 }}>{mine.slice(0, 3).map((r) => <Stack key={r.id} direction="row" spacing={1} sx={{ alignItems: "center" }}><Mono>{r.id}</Mono><Typography sx={{ fontSize: "0.66rem", flex: 1 }}>{r.bank_name} · {maskAccount(r.bank_account)} · {timeAgo(r.created_at)}{r.note ? ` · ${r.note}` : ""}</Typography><Tag tone={STATUS_TONE[r.status]}>{r.status}</Tag></Stack>)}</Stack>}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Change bank details</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField label="Bank name *" value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} />
            <TextField label="Account number *" value={f.bank_account} onChange={(e) => setF({ ...f, bank_account: e.target.value.replace(/\D/g, "") })} helperText="9–18 digits" />
            <TextField label="IFSC *" value={f.bank_ifsc} onChange={(e) => setF({ ...f, bank_ifsc: e.target.value.toUpperCase() })} helperText="Like HDFC0001234" />
            <TextField label="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
            <Alert severity="info" sx={{ fontSize: "0.68rem" }}>Upload a cancelled cheque or bank statement in My profile → Documents; HR checks it before approving.</Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={submit}>Send to HR</Button></DialogActions>
      </Dialog>
    </SectionCard>
  );
}

export function LearningRequest() {
  const { data, user, suiteDo, notifyToast } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ topic: "", provider: "", mode: "Online", hours: "", reason: "" });
  const me = data.employees.find((e) => e.employee_code === user.employee_code);
  const mine = (data.suite?.selfReq || []).filter((r) => r.type === "learning" && r.employee_code === user.employee_code);
  // v10.7: provider = a colleague, a team (department) or a group — or type an outside provider.
  const providerOptions = [
    ...data.employees.filter((e) => e.status === "active" && e.employee_code !== user.employee_code).map((e) => ({ label: `${e.full_name} · ${e.designation}`, group: "Employees" })),
    ...[...new Set(data.employees.map((e) => e.department).filter(Boolean))].sort().map((d) => ({ label: `${d} team`, group: "Teams" })),
    ...[...new Set([...(data.suite?.groups || []).map((g) => g.name), ...(data.orgUnits || []).filter((o) => !o.parent_unit).map((o) => o.name), "Learning & Development", "Internal trainers", "Tech guild", "Leadership circle"].filter(Boolean))].map((g) => ({ label: g, group: "Groups" })),
  ];
  function submit() {
    if (!f.topic.trim() || !f.reason.trim()) return notifyToast("Enter the course or skill and why you need it.", "error");
    const r = suiteDo("self106", (s, { x, me: code, now }) => {
      s.selfReq = s.selfReq || [];
      const id = `LRQ-${String(s.selfReq.filter((q) => q.type === "learning").length + 1).padStart(4, "0")}`;
      s.selfReq.unshift({ id, type: "learning", employee_code: code, ...f, hours: Number(f.hours) || 0, status: "pending", created_at: now });
      note(x, [me?.reporting_manager, ...hrAdmins(x)].filter(Boolean), `${user.full_name} requested learning: ${f.topic} (${id}).`, "/emp-requests", now);
      return { id };
    }, { action: "LEARNING_REQUEST", details: (r) => `${r.id} · ${f.topic}` });
    if (!r.ok) return notifyToast(r.error, "error");
    notifyToast("Learning request sent to your manager and HR.");
    setOpen(false);
    setF({ topic: "", provider: "", mode: "Online", hours: "", reason: "" });
  }
  return (
    <SectionCard title="My learning requests" subtitle="Ask for a course, certification or training. Your manager and HR approve; approved courses show in My learning." action={<Button size="small" variant="contained" startIcon={<SchoolRounded />} onClick={() => setOpen(true)}>Request learning</Button>} noPad>
      {mine.length === 0 ? <EmptyState title="No requests yet" text="Request a course and track it here." /> : (
        <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Ref</TableCell><TableCell>Course / skill</TableCell><TableCell>Mode</TableCell><TableCell align="right">Hours</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
          <TableBody>{mine.map((r) => <TableRow key={r.id}><TableCell><Mono>{r.id}</Mono></TableCell><TableCell>{r.topic}<Typography variant="caption" display="block" color="text.secondary">{r.provider}{r.note ? ` · ${r.note}` : ""}</Typography></TableCell><TableCell>{r.mode}</TableCell><TableCell align="right">{r.hours || "—"}</TableCell><TableCell><Tag tone={STATUS_TONE[r.status]}>{r.status}</Tag></TableCell></TableRow>)}</TableBody></Table></TableWrap>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Request learning</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField label="Course, certification or skill *" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />
            <Stack direction="row" spacing={1.5}><Autocomplete freeSolo sx={{ flex: 1 }} options={providerOptions} groupBy={(o) => o.group} getOptionLabel={(o) => (typeof o === "string" ? o : o.label)} inputValue={f.provider} onInputChange={(e, v) => setF({ ...f, provider: v })} renderInput={(params) => <TextField {...params} label="Provider · employee, team or group" />} /><ListSelect listKey="training_mode" blank={false} fullWidth={false} label="Mode" value={f.mode} onChange={(v) => setF({ ...f, mode: v })} sx={{ width: 150 }} /></Stack>
            <TextField type="number" label="Hours" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} />
            <TextField multiline minRows={2} label="How will it help your work? *" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={submit}>Send request</Button></DialogActions>
      </Dialog>
    </SectionCard>
  );
}

/** HR queue for bank-change and learning requests (Inbox & approvals → Employee requests). */
export function SelfRequestsAdmin() {
  const { data, user, nameOf, suiteDo, notifyToast } = useStore();
  const [tab, setTab] = useState("pending");
  const [act, setAct] = useState(null);
  const [msg, setMsg] = useState("");
  const all = data.suite?.selfReq || [];
  const rows = tab === "pending" ? all.filter((r) => r.status === "pending") : all;
  function decide(r, ok) {
    if (!ok && !msg.trim()) return notifyToast("Give a reason.", "error");
    const res = suiteDo("admin106", (s, { x, code, now }) => {
      const q = s.selfReq.find((i) => i.id === r.id);
      if (!q || q.status !== "pending") return { ok: false, error: "Already decided." };
      q.status = ok ? (q.type === "learning" ? "enrolled" : "approved") : "rejected";
      q.decided_by = code; q.decided_at = now; q.note = msg.trim();
      if (ok && q.type === "enrolment" && q.field) { const e = x.employees.find((y) => y.employee_code === q.employee_code); if (e) e[q.field] = q.number; }
      if (ok && q.type === "bank") {
        const e = x.employees.find((y) => y.employee_code === q.employee_code);
        if (e) Object.assign(e, { bank_name: q.bank_name, bank_account: q.bank_account, bank_ifsc: q.bank_ifsc });
        note(x, finAdmins(x), `Bank details of ${nameOf(q.employee_code)} changed (${q.id}) — used from the next payroll run.`, "/payroll-agent", now);
      }
      return { id: q.id, emp: q.employee_code, status: q.status };
    }, { action: ok ? "SELF_REQUEST_APPROVE" : "SELF_REQUEST_REJECT", details: (x) => `${x.id} → ${x.status}`, note: (x) => ({ to: x.emp, text: `Your request ${x.id} was ${x.status}.${msg.trim() ? ` ${msg.trim()}` : ""}`, link: "/inbox" }) });
    if (!res.ok) return notifyToast(res.error, "error");
    notifyToast(ok ? "Approved." : "Rejected; the employee was told.");
    setAct(null); setMsg("");
  }
  return (
    <>
      <Stack direction="row" spacing={0.8} sx={{ mb: 1.5 }}>
        <Chip label={`Waiting (${all.filter((r) => r.status === "pending").length})`} color={tab === "pending" ? "primary" : "default"} onClick={() => setTab("pending")} />
        <Chip label={`All (${all.length})`} color={tab === "all" ? "primary" : "default"} onClick={() => setTab("all")} />
      </Stack>
      <SectionCard noPad>
        {rows.length === 0 ? <EmptyState title="Nothing waiting" text="Bank-details changes, statutory enrolments and learning requests from employees appear here." /> : (
          <TableWrap><Table size="small" sx={{ minWidth: 760 }}><TableHead><TableRow><TableCell>Ref</TableCell><TableCell>Employee</TableCell><TableCell>Request</TableCell><TableCell>Raised</TableCell><TableCell>Status</TableCell><TableCell align="right" /></TableRow></TableHead>
            <TableBody>{rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell><Mono>{r.id}</Mono></TableCell>
                <TableCell><PersonCell name={nameOf(r.employee_code)} sub={r.employee_code} /></TableCell>
                <TableCell>{r.type === "enrolment" ? <>Statutory enrolment: <b>{r.kind_label}</b> · {r.number}{r.file ? ` · proof ${r.file}` : ""}</> : r.type === "bank" ? <>Bank change → <b>{r.bank_name}</b> · {maskAccount(r.bank_account)} · {r.bank_ifsc}</> : <>Learning: <b>{r.topic}</b> · {r.mode}{r.provider ? ` · by ${r.provider}` : ""}{r.hours ? ` · ${r.hours} h` : ""}</>}<Typography variant="caption" display="block" color="text.secondary">{r.reason}</Typography></TableCell>
                <TableCell>{fmtDate(r.created_at)}</TableCell>
                <TableCell><Tag tone={STATUS_TONE[r.status]}>{r.status}</Tag></TableCell>
                <TableCell align="right">{r.status === "pending" && (user.role === "superadmin" || ["hr", "hr_finance"].includes(adminKind(user))) && <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}><Button size="small" variant="contained" onClick={() => setAct({ r, ok: true })}>Approve</Button><Button size="small" color="error" onClick={() => setAct({ r, ok: false })}>Reject</Button></Stack>}</TableCell>
              </TableRow>
            ))}</TableBody></Table></TableWrap>
        )}
      </SectionCard>
      <Dialog open={!!act} onClose={() => setAct(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{act?.ok ? "Approve" : "Reject"} {act?.r.id}</DialogTitle>
        <DialogContent><TextField fullWidth multiline minRows={2} sx={{ mt: 1 }} label={act?.ok ? "Note (optional)" : "Reason *"} value={msg} onChange={(e) => setMsg(e.target.value)} /></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setAct(null)}>Cancel</Button><Button variant="contained" color={act?.ok ? "primary" : "error"} onClick={() => decide(act.r, act.ok)}>{act?.ok ? "Approve" : "Reject"}</Button></DialogActions>
      </Dialog>
    </>
  );
}
export const selfReqCount = (data) => (data.suite?.selfReq || []).filter((r) => r.status === "pending").length;

export function ContractPeriodCard() {
  const { data, user } = useStore();
  const list = (data.contracts || []).filter((c) => c.employee_code === user.employee_code && ["active", "pending_approval", "suspended"].includes(c.status)).sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
  const c = list.find((x) => x.status === "active") || list[0];
  const end = c?.end_date || user.fixed_term_end_date;
  const start = c?.start_date || user.date_of_joining;
  const left = end ? Math.ceil((new Date(`${end}T12:00:00`) - Date.now()) / 86400000) : null;
  return (
    <Card sx={{ p: 2, mb: 2.5, borderLeft: "3px solid", borderColor: "primary.main", bgcolor: "background.paper" }}>
      <Typography sx={{ fontSize: "0.58rem", fontWeight: 800, letterSpacing: "1px", color: "#9C6B45" }}>CONTRACT PERIOD</Typography>
      <Stack direction="row" spacing={4} useFlexGap sx={{ flexWrap: "wrap", mt: 0.8 }}>
        {[["Contract", c ? `${c.id}${c.title ? ` · ${c.title}` : ""}` : "—"], ["Start date", start ? fmtDate(start) : "—"], ["End date", end ? fmtDate(end) : "Open-ended"], ["Days remaining", left == null ? "—" : left < 0 ? "Ended" : `${left} day(s)`], ["On expiry", { review: "Review 30 days before", auto: "Auto-renew", end: "Ends on the end date" }[user.renewal_option] || "Review 30 days before"]].map(([l, v]) => (
          <Box key={l}><Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{l}</Typography><Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: l === "Days remaining" && left != null && left < 30 ? "#E53950" : "#17404D" }}>{v}</Typography></Box>
        ))}
      </Stack>
    </Card>
  );
}

export function SupportTatCard() {
  const { data } = useStore();
  const navigate = useNavigate();
  const tat = data.settings.support_tat || { hr_hours: 1, it_days: 1 };
  return (
    <Card sx={{ p: 2, mb: 2.5, bgcolor: "primary.light" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: "0.58rem", fontWeight: 800, letterSpacing: "1px", color: "#D94F8A" }}>QUICK RESPONSE · HR SUPPORT</Typography>
          <Typography sx={{  fontWeight: 800, fontSize: "0.95rem" }}>Reach HR quickly</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} useFlexGap flexWrap="wrap">
            <Chip icon={<TimerRounded />} label={`HR responds within ${tat.hr_hours} working hour${tat.hr_hours > 1 ? "s" : ""}`} sx={{ fontWeight: 700, bgcolor: "#fff", color: "#D94F8A", border: "1px solid #F5C2D8" }} />
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Button variant="contained" startIcon={<SupportAgentRounded />} onClick={() => document.getElementById("hr-new-ticket")?.click()}>Raise HR request</Button>
          <Button variant="outlined" startIcon={<ChatRounded />} onClick={() => navigate("/chat")}>Chat with HR</Button>
        </Stack>
      </Stack>
    </Card>
  );
}

export function LeaveRulesBox() {
  const { data, user } = useStore();
  const me = data.employees.find((e) => e.employee_code === user.employee_code);
  const custom = data.settings.leave_rules_text;
  const rules = custom ? custom.split("\n").filter(Boolean) : [
    "Apply at least 2 working days in advance for planned leave; sick leave can be applied on the day.",
    "Your reporting manager approves. If they are away, the request goes to the next manager up (or HR) automatically.",
    "Contract, freelance and intern workers request leave without a balance; days not covered by the contract are unpaid (LOP).",
    "When a leave balance is exhausted, extra days are marked as loss of pay (LOP) and deducted in payroll.",
    "More than 3 consecutive sick days need a medical certificate (upload under Documents).",
    "Leave cannot be combined with notice period without HR approval.",
  ];
  return (
    <Card sx={{ p: 2, mb: 2, borderLeft: "3px solid", borderColor: "warning.main", bgcolor: "warning.light" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.8 }}><GavelRounded sx={{ color: "#D99A00", fontSize: 18 }} /><Typography sx={{ fontWeight: 800, fontSize: "0.8rem" }}>Leave rules & regulations{me?.worker_type ? ` · ${me.worker_type}` : ""}</Typography></Stack>
      <Box component="ol" sx={{ m: 0, pl: 2.5, "& li": { fontSize: "0.68rem", mb: 0.3 } }}>{rules.map((r) => <li key={r}>{r}</li>)}</Box>
    </Card>
  );
}

export function LopNotice({ balances }) {
  const out = (balances || []).filter((b) => b.available <= 0 && !b.unlimited);
  if (!out.length) return null;
  return <Alert severity="warning" icon={<EventBusyRounded />} sx={{ mb: 2, fontSize: "0.7rem" }}><b>{out.map((b) => b.name || b.code).join(", ")}</b> exhausted — further days of these types are taken as <b>loss of pay (LOP)</b> and deducted in the next payroll.</Alert>;
}

export { PhoneRounded, MailRounded };

/** v10.6 · Leave on WhatsApp — apply, approve / decline and get updates through WhatsApp Business. */
export function WhatsAppLeaveCard({ approver }) {
  const { data } = useStore();
  const wa = data.suite?.integrations?.whatsapp;
  if (!wa?.connected) return null;
  const num = (wa.mode || "").split("·")[1]?.trim() || "your company WhatsApp number";
  return (
    <Card sx={{ p: 1.6, mb: 2, borderLeft: "3px solid", borderColor: "success.main", bgcolor: "success.light" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>{approver ? "Approve leave on WhatsApp" : "Leave requests, approved on WhatsApp"}</Typography>
          <Typography sx={{ fontSize: "0.66rem", color: "#5d6b70" }}>{approver ? `Leave requests from your team also arrive on WhatsApp from ${num} with Approve / Decline buttons; your tap is saved here.` : `Message ${num}: "Leave 15-17 Oct, family function". You get the request ID, your manager approves on WhatsApp, and you're told the moment it's approved.`}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Box sx={{ px: 1.2, py: 0.6, borderRadius: 2, background: "#fff", border: "1px solid #c8f0d6", fontSize: "0.62rem" }}>💬 Leave request · 3 days</Box>
          <Box sx={{ px: 1.2, py: 0.6, borderRadius: 2, background: "#1F9D63", color: "#fff", fontSize: "0.62rem", fontWeight: 700 }}>✓ Approve</Box>
          <Box sx={{ px: 1.2, py: 0.6, borderRadius: 2, background: "#E53950", color: "#fff", fontSize: "0.62rem", fontWeight: 700 }}>✕ Decline</Box>
        </Stack>
      </Stack>
    </Card>
  );
}
