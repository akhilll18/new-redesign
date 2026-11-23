// Shared views for leave / expense / advance / loan requests: approval chain, detail drawer with
// the actions the viewer is allowed (employee cancel, manager step, admin step + payout, super admin override).
import { FORM_TYPES } from "../../lib/forms.js";
import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Divider, Drawer, IconButton, InputAdornment, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { CloseRounded, CheckRounded, CloseOutlined, HourglassEmptyRounded, RemoveRounded, AttachFileRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { KeyVal, Mono, StatusChip, Tag, TableWrap, FlagList } from "./UI.jsx";
import { fmtDate, fmtDateTime, fmtNum, fmtBytes, isoDate } from "../../lib/utils.js";
import { REQUEST_TYPES, REG_REASONS, SCREENOFF_REASONS, fmtMins, expenseTotal, currentAdminStep, stepModule, stepLabel } from "../../lib/requests.js";
import { IT_CATEGORY_LABEL, IT_PRIORITY, IT_STATUS } from "../../lib/itdesk.js";
import { MenuItem, Select, FormControl, InputLabel } from "@mui/material";

import { AiReview } from "../ai/AiInsight.jsx";
import { requestFacts } from "../../lib/ai/facts.js";

function RecordedPunches({ code, date }) {
  const { data } = useStore();
  const list = data.punches.filter((p) => p.employee_code === code && p.ts.startsWith(date)).sort((a, b) => a.ts.localeCompare(b.ts));
  if (!list.length) return "No punches recorded";
  return list.map((p) => `${p.type === "in" ? "In" : "Out"} ${new Date(p.ts).toTimeString().slice(0, 5)}`).join(" · ");
}
import { openDocument } from "../../lib/openDocument.js";
import { SOURCE_LABEL, PAID_BY_LABEL } from "../../lib/expenseHub.js";

export function statusLabel(r) {
  if (r.status === "Pending") return r.stage === "manager" ? "Pending · manager" : currentAdminStep(r)?.role ? `Pending · ${stepLabel(r, currentAdminStep(r))}` : "Pending · admin";
  if (r.status === "Approved" && r.type === "asset") return "Approved · to assign";
  if (r.status === "Approved" && ["expense", "advance", "loan"].includes(r.type)) return r.type === "expense" ? "Approved · to pay" : "Approved · to disburse";
  return r.status;
}

export function RequestStatus({ r }) {
  const tone = r.status === "Pending" ? "warn" : ["Approved", "Paid", "Disbursed", "Fulfilled"].includes(r.status) ? "good" : r.status === "Rejected" ? "bad" : "neutral";
  return <Tag tone={tone}>{statusLabel(r)}</Tag>;
}

// Submitted → Manager → Admin (→ Paid / Disbursed)
export function ApprovalChain({ item }) {
  const { nameOf, data } = useStore();
  const itTicket = (id) => (data.itTickets || []).find((t) => t.id === id);
  const steps = [{ label: "Submitted", who: item.employee_code, status: "approved", at: item.created_at || item.submitted_at }, ...(item.steps || []).map((s) => ({ label: s.level === "manager" ? "Manager" : item.type ? stepLabel(item, s) : "HR admin", who: s.approver, status: s.status, at: s.at, note: s.note }))];
  if (item.type === "itsupport") {
    const tk = itTicket?.(item.ticket_id);
    steps.push({ label: "IT admin", who: tk?.assigned_to || null, status: !tk ? "waiting" : tk.status === "awaiting_approval" ? (item.status === "Rejected" ? "skipped" : "waiting") : ["resolved", "closed"].includes(tk.status) && !String(tk.resolution).startsWith("Not approved") ? "approved" : tk.status === "closed" ? "skipped" : "pending", at: tk?.resolved_at });
  }
  if (item.type === "asset") steps.push({ label: "Assigned", who: null, status: item.status === "Fulfilled" ? "approved" : ["Rejected", "Cancelled"].includes(item.status) ? "skipped" : "waiting", at: item.history?.find((h) => h.status === "Fulfilled")?.at });
  if (["expense", "advance", "loan"].includes(item.type)) steps.push({ label: item.type === "expense" ? "Reimbursed" : "Disbursed", who: null, status: ["Paid", "Disbursed"].includes(item.status) ? "approved" : item.status === "Rejected" || item.status === "Cancelled" ? "skipped" : "waiting", at: item.paid_on || item.disbursed_date });
  const icon = { approved: <CheckRounded />, rejected: <CloseOutlined />, pending: <HourglassEmptyRounded />, waiting: null, skipped: <RemoveRounded /> };
  const color = { approved: "#2e7d32", rejected: "#d32f2f", pending: "#bf7955", waiting: "#d9e2d9", skipped: "#d9e2d9" };
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Stack direction="row" sx={{ minWidth: 120 * steps.length, py: 0.5 }}>
        {steps.map((s, i) => (
          <Stack key={i} sx={{ flex: 1, alignItems: "center", position: "relative", minWidth: 0 }}>
            {i > 0 && <Box sx={{ position: "absolute", top: 12, right: "50%", width: "100%", height: 2, background: s.status === "approved" ? "#2e7d32" : "#e6ece5" }} />}
            <Box sx={{ zIndex: 1, width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", background: ["approved", "rejected"].includes(s.status) ? color[s.status] : "#fff", border: `2px solid ${color[s.status]}`, color: ["approved", "rejected"].includes(s.status) ? "#fff" : color[s.status], "& svg": { fontSize: 15 } }}>
              {icon[s.status] || <Typography sx={{ fontSize: "0.55rem" }}>{i + 1}</Typography>}
            </Box>
            <Typography sx={{ mt: 0.5, fontSize: "0.62rem", fontWeight: 700, textAlign: "center" }}>{s.label}</Typography>
            <Typography sx={{ fontSize: "0.58rem", color: "#78827b", textAlign: "center" }} noWrap>
              {s.status === "skipped" ? "Skipped" : s.who ? nameOf(s.who) : s.status === "waiting" ? "Waiting" : ""}
            </Typography>
            <Typography sx={{ fontSize: "0.55rem", color: "#9aa39c", textAlign: "center" }}>{s.at ? fmtDateTime(s.at) : s.status === "pending" ? "Waiting for decision" : " "}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function Doc({ doc }) {
  if (!doc) return <Typography sx={{ fontSize: "0.6rem", color: "#d32f2f" }}>No receipt</Typography>;
  return (
    <Button size="small" startIcon={<AttachFileRounded sx={{ fontSize: 14 }} />} onClick={() => openDocument(doc)} disabled={!doc.data_url} sx={{ fontSize: "0.6rem", p: 0, minWidth: 0, justifyContent: "flex-start" }} title={doc.data_url ? "Open" : "Sample file (no content in the demo)"}>
      {doc.name} · {fmtBytes(doc.size)}
    </Button>
  );
}

export function RequestDetail({ r }) {
  const { empBy, orgBy, nameOf, leaveTypeBy, expCatBy, allData, data } = useStore();
  const e = empBy[r.employee_code];
  const company = (allData?.companies || []).find((c) => c.company_id === (r.company_id || e?.company_id));
  const location = (allData?.workLocations || []).find((l) => l.location_id === (r.location_id || e?.location_id));
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
        <Tag tone="accent">{REQUEST_TYPES[r.type].label}</Tag>
        <Mono sx={{ fontWeight: 700 }}>{r.request_id}</Mono>
        <RequestStatus r={r} />
        {r.override && <Tag tone="warn">Super Admin override</Tag>}
      </Stack>
      <ApprovalChain item={r} />
      <FlagList flags={r.flags || []} dense />
      <KeyVal cols={3} items={[["Employee", `${e?.full_name} (${r.employee_code})`], ["Department", orgBy[e?.department]?.name], ["Reporting manager", e?.reporting_manager ? nameOf(e.reporting_manager) : "—"], ...(company ? [["Company", company.short], ["Location", location?.name || "—"], ["Cost centre", location?.cost_centre || "—"]] : [])]} />
      {r.source?.app && <Alert severity="info" sx={{ py: 0.3 }}>Brought in from <b>{SOURCE_LABEL(r.source.app)}</b> · {r.source.external_id} · status there: {r.source.external_status}{r.currency && r.currency !== "INR" ? ` · original currency ${r.currency}` : ""}{r.paid_by && r.paid_by !== "employee" ? ` · paid by ${PAID_BY_LABEL[r.paid_by] || r.paid_by}${r.vendor ? ` (${r.vendor})` : ""} — nothing to reimburse` : ""}.</Alert>}
      <Divider />
      {/* v10.13: self-service forms — every field the employee filled in */}
      {FORM_TYPES[r.type] && <KeyVal cols={2} items={FORM_TYPES[r.type].fields.filter((fl) => r[fl.key] !== undefined && r[fl.key] !== "").map((fl) => [fl.label, fl.options ? (fl.options.find(([v]) => v === r[fl.key])?.[1] || r[fl.key]) : fl.type === "number" && /cost/.test(fl.key) ? `₹${Number(r[fl.key]).toLocaleString("en-IN")}` : String(r[fl.key])])} />}
      {FORM_TYPES[r.type]?.confidential && <Alert severity="warning" sx={{ py: 0.2 }}>Confidential — not shared with the employee's reporting manager.</Alert>}
      {r.type === "leave" && (
        <KeyVal
          items={[
            ["Leave type", leaveTypeBy[r.leave_type]?.name, { required: true }],
            ["Days", `${r.days} working day(s)${r.half_day !== "none" ? ` · ${r.half_day} half` : ""}`],
            ["From", fmtDate(r.from_date), { required: true }],
            ["To", fmtDate(r.to_date), { required: true }],
            ["Reason", r.reason, { full: true, required: true }],
            ["Contact while away", r.contact],
            ["Attachment", r.attachment ? <Doc key="d" doc={r.attachment} /> : "—"],
          ]}
        />
      )}
      {r.type === "expense" && (
        <>
          <KeyVal items={[["Title", r.title, { required: true }], ["Project / cost centre", r.project], ["Purpose", r.purpose, { full: true, required: true }], ["Payment", r.payment_mode === "bank" ? "Bank transfer" : r.payment_mode === "company_paid" ? "Company-paid (no reimbursement)" : "With next payroll"], ["Advance adjusted", r.advance_ref || "—"]]} />
          <TableWrap>
            <Table size="small" sx={{ minWidth: 520 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Receipt</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {r.items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(it.date)}</TableCell>
                    <TableCell>{expCatBy[it.category]?.name}</TableCell>
                    <TableCell>{it.description}</TableCell>
                    <TableCell><Doc doc={it.receipt} /></TableCell>
                    <TableCell align="right">₹{fmtNum(it.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} sx={{ fontWeight: 700 }}>Total claimed{r.approved_amount != null && r.approved_amount !== expenseTotal(r.items) ? ` · approved ₹${fmtNum(r.approved_amount)}` : ""}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>₹{fmtNum(expenseTotal(r.items))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableWrap>
        </>
      )}
      {r.type === "advance" && (
        <KeyVal
          items={[
            ["Request date", fmtDate(r.request_date), { required: true }],
            ["Request amount", `₹${fmtNum(r.request_amount)}`, { required: true }],
            ["Approved amount", r.approved_amount != null ? `₹${fmtNum(r.approved_amount)}` : "—"],
            ["Required by", fmtDate(r.required_by)],
            ["Disbursed date", fmtDate(r.disbursed_date)],
            ["Settle by", fmtDate(r.settle_by)],
            ["Reason", r.purpose, { full: true, required: true }],
            ["Note", r.note, { full: true }],
          ]}
        />
      )}
      {r.type === "regularize" && (
        <KeyVal
          items={[
            ["Day", fmtDate(r.date), { required: true }],
            ["Corrected in / out", `${r.in_time} – ${r.out_time}`, { required: true }],
            ["Reason", (REG_REASONS.find((x) => x[0] === r.reason_code) || [])[1], { required: true }],
            ["Recorded punches", <RecordedPunches key="p" code={r.employee_code} date={r.date} />],
            ["Explanation", r.reason, { full: true, required: true }],
          ]}
        />
      )}
      {r.type === "screenoff" && (
        <KeyVal
          items={[
            ["Day", fmtDate(r.date), { required: true }],
            ["Screen-off time claimed as work", fmtMins(r.minutes), { required: true }],
            ["Time of day", r.from_time ? `${r.from_time} – ${r.to_time}` : "—"],
            ["Reason", (SCREENOFF_REASONS.find((x) => x[0] === r.reason_code) || [])[1], { required: true }],
            ["Recorded punches", <RecordedPunches key="p" code={r.employee_code} date={r.date} />],
            ["What they worked on", r.reason, { full: true, required: true }],
            ["On approval", "The time moves from screen-off into worked hours for that day.", { full: true }],
          ]}
        />
      )}
      {r.type === "asset" && (
        <KeyVal items={[["Asset", r.category, { required: true }], ["Needed by", fmtDate(r.needed_by), { required: true }], ["Priority", r.priority === "high" ? "Urgent" : "Normal"], ["Assigned", r.assigned_asset || "—"], ["Reason", r.reason, { full: true, required: true }]]} />
      )}
      {r.type === "asset_purchase" && (
        <KeyVal items={[["Item", r.item, { required: true }], ["Category", r.category, { required: true }], ["Quantity", r.quantity, { required: true }], ["Estimated cost / unit", `₹${fmtNum(r.est_cost)}`, { required: true }], ["Estimated total", `₹${fmtNum(r.total_cost)}`], ["Preferred vendor", r.vendor || "—"], ["Needed by", fmtDate(r.needed_by), { required: true }], ["Why it is needed", r.reason, { full: true, required: true }]]} />
      )}
      {r.type === "itsupport" && (
        <KeyVal items={[["IT ticket", r.ticket_id], ["Ticket status", IT_STATUS[data.itTickets?.find((t) => t.id === r.ticket_id)?.status]?.label || "—"], ["Issue", r.subject, { required: true }], ["Category", IT_CATEGORY_LABEL[r.category] || r.category], ["Impact", IT_PRIORITY[r.priority]?.label || r.priority], ["Description", r.reason, { full: true }]]} />
      )}
      {r.type === "loan" && (
        <KeyVal
          items={[
            ["Loan amount", `₹${fmtNum(r.amount)}`, { required: true }],
            ["Approved amount", r.approved_amount != null ? `₹${fmtNum(r.approved_amount)}` : "—"],
            ["Tenure", `${r.tenure_months} months`, { required: true }],
            ["EMI (deducted from salary)", `₹${fmtNum(r.emi)}`],
            ["First EMI", r.start_month],
            ["Disbursed", fmtDate(r.disbursed_date)],
            ["Reason", r.reason, { full: true, required: true }],
          ]}
        />
      )}
      {r.payment_ref && <KeyVal items={[["Payment reference", r.payment_ref], ["Paid / disbursed on", fmtDate(r.paid_on || r.disbursed_date)]]} />}
      <Divider />
      <Typography variant="overline" sx={{ color: "#8a948d" }}>History</Typography>
      <Stack spacing={1}>
        {[...r.history].reverse().map((h, i) => (
          <Stack key={i} direction="row" spacing={1.2}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: "#244d3d", mt: 0.7, flexShrink: 0 }} />
            <Box>
              <Typography sx={{ fontSize: "0.68rem" }}>
                <b>{h.status}</b> · {nameOf(h.by)}
              </Typography>
              <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>
                {fmtDateTime(h.at)}
                {h.note ? ` · ${h.note}` : ""}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

// Drawer with the actions this viewer may take.
export function RequestDrawer({ id, onClose }) {
  const store = useStore();
  const { data, user, decideRequest, payoutRequest, cancelRequest, overrideRequest, assignAsset, notifyToast } = store;
  const [assetPick, setAssetPick] = useState("");
  const r = data.requests.find((x) => x.request_id === id);
  const [decision, setDecision] = useState("approve");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(isoDate());
  const [err, setErr] = useState("");
  useEffect(() => {
    setDecision("approve");
    setNote("");
    setErr("");
    setRef("");
    if (r) setAmount(String(r.approved_amount ?? (r.type === "expense" ? expenseTotal(r.items) : r.request_amount ?? r.amount ?? "")));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return null;

  const isOwner = user.role === "emp" && r.employee_code === user.employee_code;
  const isManagerStep = user.role === "emp" && r.status === "Pending" && r.stage === "manager" && r.steps[0]?.approver === user.employee_code;
  const isAdminStep = user.role === "admin" && r.status === "Pending" && r.stage === "admin" && user.modules.includes(stepModule(r, currentAdminStep(r)));
  const canPayout = user.role === "admin" && r.status === "Approved" && ["expense", "advance", "loan"].includes(r.type) && user.modules.includes(r.type);
  const canAssign = (user.role === "superadmin" || (user.role === "admin" && user.modules.includes("assets"))) && r.status === "Approved" && r.type === "asset";
  const stock = data.assets.filter((a) => a.status === "in_stock" && (a.category === r.category || r.category === "Other"));
  const canOverride = user.role === "superadmin" && !["Cancelled"].includes(r.status);
  const futureLeave = r.type === "leave" && r.status === "Approved" && r.from_date > isoDate();
  const canCancel = isOwner && (r.status === "Pending" || futureLeave);
  const money = ["expense", "advance", "loan"].includes(r.type);

  function act() {
    setErr("");
    let res;
    if (canOverride) res = overrideRequest(r.request_id, { approve: decision === "approve", note });
    else res = decideRequest(r.request_id, { approve: decision === "approve", note, approved_amount: isAdminStep && money ? amount : undefined });
    if (!res.ok) return setErr(res.error);
    notifyToast(`${r.request_id} ${decision === "approve" ? "approved" : "rejected"}.`);
    onClose();
  }

  return (
    <Drawer anchor="right" open={!!id} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 640 } } } }}>
      <Stack sx={{ height: "100%" }}>
        <Stack direction="row" sx={{ alignItems: "center", px: 2.5, py: 1.5, borderBottom: "1px solid #edf0ec" }}>
          <Typography variant="h2" sx={{ flex: 1 }}>{REQUEST_TYPES[r.type].label} {r.request_id}</Typography>
          <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
        </Stack>
        <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
          {(isManagerStep || isAdminStep || canOverride) && (() => { const f = requestFacts(r, store); return <Box sx={{ mb: 2 }}><AiReview kind={REQUEST_TYPES[r.type].label.toLowerCase()} id={r.request_id} facts={f.facts} flags={f.flags} rec={f.rec} onUseNote={setNote} onDecision={setDecision} /></Box>; })()}
          <RequestDetail r={r} />
        </Box>

        {(isManagerStep || isAdminStep || canOverride) && (
          <Box sx={{ borderTop: "1px solid #edf0ec", p: 2.5, background: "#fbfdfb" }}>
            <Stack spacing={1.5}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                <Typography variant="h3">{canOverride ? "Super Admin override" : isManagerStep ? "Your decision as manager" : "Final decision"}</Typography>
                <ToggleButtonGroup exclusive size="small" value={decision} onChange={(_, v) => v && setDecision(v)} sx={{ background: "#fff" }}>
                  <ToggleButton value="approve" color="success" sx={{ fontSize: "0.65rem" }}><CheckRounded sx={{ fontSize: 15, mr: 0.5 }} /> Approve</ToggleButton>
                  <ToggleButton value="reject" color="error" sx={{ fontSize: "0.65rem" }}><CloseOutlined sx={{ fontSize: 15, mr: 0.5 }} /> Reject</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              {err && <Alert severity="error">{err}</Alert>}
              {isAdminStep && money && decision === "approve" && (
                <TextField label="Approved amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} helperText="You may approve less than claimed; say why in the note." slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment>, sx: { background: "#fff" } } }} />
              )}
              <TextField label={canOverride ? "Audit note (required)" : decision === "reject" ? "Reason (required, the employee sees it)" : "Note (optional)"} multiline minRows={2} value={note} onChange={(e) => setNote(e.target.value)} slotProps={{ input: { sx: { background: "#fff" } } }} />
              <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                <Button color="inherit" onClick={onClose}>Cancel</Button>
                <Button variant="contained" color={decision === "approve" ? "primary" : "error"} onClick={act}>
                  {decision === "approve" ? (isManagerStep && r.steps.length > 1 ? "Approve and send to admin" : canOverride ? "Override: approve" : "Confirm approval") : canOverride ? "Override: reject" : "Confirm rejection"}
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}

        {canPayout && (
          <Box sx={{ borderTop: "1px solid #edf0ec", p: 2.5, background: "#fbfdfb" }}>
            <Stack spacing={1.5}>
              <Typography variant="h3">{r.type === "expense" ? "Record reimbursement" : "Record disbursement"} · ₹{fmtNum(r.approved_amount ?? (r.type === "expense" ? expenseTotal(r.items) : r.request_amount ?? r.amount))}</Typography>
              {err && <Alert severity="error">{err}</Alert>}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField label="Payment reference (UTR)" required value={ref} onChange={(e) => setRef(e.target.value)} slotProps={{ input: { sx: { background: "#fff" } } }} />
                <TextField label={r.type === "expense" ? "Paid on" : "Disbursed date"} type="date" required value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true }, input: { sx: { background: "#fff" } } }} />
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    const res = payoutRequest(r.request_id, { ref, date });
                    if (!res.ok) return setErr(res.error);
                    notifyToast(`${r.request_id} marked ${r.type === "expense" ? "paid" : "disbursed"}.`);
                    onClose();
                  }}
                >
                  {r.type === "expense" ? "Mark paid" : "Mark disbursed"}
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}

        {canAssign && (
          <Box sx={{ borderTop: "1px solid #edf0ec", p: 2.5, background: "#fbfdfb" }}>
            <Stack spacing={1.5}>
              <Typography variant="h3">Assign from stock</Typography>
              {stock.length === 0 ? (
                <Alert severity="warning">No {r.category.toLowerCase()} in stock. Add one in Assets, then assign it here.</Alert>
              ) : (
                <FormControl size="small" fullWidth>
                  <InputLabel>Asset</InputLabel>
                  <Select label="Asset" value={assetPick} onChange={(e) => setAssetPick(e.target.value)} sx={{ background: "#fff" }}>
                    {stock.map((a) => <MenuItem key={a.asset_id} value={a.asset_id}>{a.asset_id} · {a.model} · {a.serial}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {err && <Alert severity="error">{err}</Alert>}
              <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                <Button variant="contained" disabled={!assetPick} onClick={() => { const res = assignAsset(assetPick, r.employee_code, r.request_id); if (!res.ok) return setErr(res.error); notifyToast(`${assetPick} assigned.`); onClose(); }}>Assign asset</Button>
              </Stack>
            </Stack>
          </Box>
        )}

        {canCancel && (
          <Stack direction="row" sx={{ justifyContent: "flex-end", px: 2.5, py: 1.5, borderTop: "1px solid #edf0ec" }}>
            <Button
              color="error"
              variant="outlined"
              onClick={() => {
                const res = cancelRequest(r.request_id);
                notifyToast(res.ok ? `${r.request_id} cancelled.` : res.error, res.ok ? "success" : "error");
                if (res.ok) onClose();
              }}
            >
              Cancel request
            </Button>
          </Stack>
        )}
      </Stack>
    </Drawer>
  );
}
