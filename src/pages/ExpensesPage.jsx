// Expenses & travel (Keka) with advance requests (PeopleHR "Advance Amount").
// Claims and advances go to the reporting manager, then the Finance admin, then are paid / disbursed.
import React, { useRef, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, FormHelperText, IconButton, InputAdornment, InputLabel, MenuItem, Select, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { AddRounded, DeleteOutlineRounded, AttachFileRounded, ReceiptLongRounded, PaymentsRounded } from "@mui/icons-material";
import { useStore } from "../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Mono, TableWrap, EmptyState, KeyVal, FlagList } from "../components/kit/UI.jsx";
import { RequestDrawer, RequestStatus } from "../components/kit/Requests.jsx";
import { validateExpense, validateAdvance, expenseTotal } from "../lib/requests.js";
import { fmtDate, fmtNum, isoDate, readFileAsDataUrl } from "../lib/utils.js";
import { SOURCE_LABEL } from "../lib/expenseHub.js";

const blankItem = () => ({ date: isoDate(), category: "", description: "", amount: "", receipt: null });

function ExpenseClaimDialog({ open, onClose }) {
  const { data, user, createRequest, notifyToast } = useStore();
  const [form, setForm] = useState({ title: "", purpose: "", project: "", payment_mode: "payroll", advance_ref: "", items: [blankItem()], declaration: false });
  const [tried, setTried] = useState(false);
  const fileRefs = useRef({});
  useEffect(() => {
    if (open) {
      setForm({ title: "", purpose: "", project: "", payment_mode: "payroll", advance_ref: "", items: [blankItem()], declaration: false });
      setTried(false);
    }
  }, [open]);
  const { errors, itemErrors, flags, total } = validateExpense(form, { emp: user, expenseCategories: data.expenseCategories, settings: data.settings });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  const show = (k) => tried && errors[k];
  const advances = data.requests.filter((r) => r.type === "advance" && r.employee_code === user.employee_code && r.status === "Disbursed" && !r.settled);

  async function attach(i, file) {
    if (!file) return;
    if (file.size > data.settings.max_file_mb * 1048576) return notifyToast(`Receipts must be under ${data.settings.max_file_mb} MB.`, "error");
    setItem(i, "receipt", { name: file.name, size: file.size, type: file.type, data_url: await readFileAsDataUrl(file) });
  }
  function submit() {
    setTried(true);
    if (Object.keys(errors).length) return notifyToast(Object.values(errors)[0], "error");
    const r = createRequest("expense", form);
    if (!r.ok) return notifyToast(Object.values(r.errors)[0], "error");
    notifyToast(`Claim ${r.id} for ₹${fmtNum(total)} sent for approval.`);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New expense claim</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Claim title *" value={form.title} onChange={(e) => set("title", e.target.value)} error={!!show("title")} helperText={show("title") || "e.g. Client visit – Bengaluru"} />
            <TextField label="Project / cost centre" value={form.project} onChange={(e) => set("project", e.target.value)} helperText="Optional" />
          </Stack>
          <TextField label="Business purpose *" value={form.purpose} onChange={(e) => set("purpose", e.target.value)} error={!!show("purpose")} helperText={show("purpose") || " "} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Reimburse through</InputLabel>
              <Select label="Reimburse through" value={form.payment_mode} onChange={(e) => set("payment_mode", e.target.value)}>
                <MenuItem value="payroll">Next payroll</MenuItem>
                <MenuItem value="bank">Bank transfer</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Adjust against advance</InputLabel>
              <Select label="Adjust against advance" value={form.advance_ref} onChange={(e) => set("advance_ref", e.target.value)}>
                <MenuItem value="">None</MenuItem>
                {advances.map((a) => <MenuItem key={a.request_id} value={a.request_id}>{a.request_id} · ₹{fmtNum(a.approved_amount)}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>

          <Typography variant="h3">Expense lines</Typography>
          {form.items.map((it, i) => {
            const e = (tried && itemErrors[i]) || {};
            const cat = data.expenseCategories.find((c) => c.code === it.category);
            return (
              <Box key={i} sx={{ p: 1.5, border: "1px solid #e5eae5", borderRadius: 1, display: "grid", gridTemplateColumns: { xs: "1fr", md: "140px 1.2fr 1.6fr 120px auto auto" }, gap: 1.2, alignItems: "start" }}>
                <TextField label="Date" type="date" value={it.date} onChange={(ev) => setItem(i, "date", ev.target.value)} error={!!e.date} helperText={e.date || " "} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: isoDate() } }} />
                <FormControl size="small" error={!!e.category}>
                  <InputLabel>Category</InputLabel>
                  <Select label="Category" value={it.category} onChange={(ev) => setItem(i, "category", ev.target.value)}>
                    {data.expenseCategories.map((c) => <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>)}
                  </Select>
                  <FormHelperText>{e.category || (cat ? `Limit ₹${fmtNum(cat.limit)}` : " ")}</FormHelperText>
                </FormControl>
                <TextField label="Description" value={it.description} onChange={(ev) => setItem(i, "description", ev.target.value)} error={!!e.description} helperText={e.description || " "} />
                <TextField label="Amount" value={it.amount} onChange={(ev) => setItem(i, "amount", ev.target.value.replace(/[^\d.]/g, ""))} error={!!e.amount} helperText={e.amount || " "} slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> }, htmlInput: { inputMode: "decimal" } }} />
                <Box>
                  <Button size="small" variant={it.receipt ? "contained" : "outlined"} color={e.receipt ? "error" : "primary"} startIcon={<AttachFileRounded />} onClick={() => fileRefs.current[i]?.click()} sx={{ whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden" }}>
                    {it.receipt ? "Receipt ✓" : "Receipt"}
                  </Button>
                  <input ref={(el) => (fileRefs.current[i] = el)} type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(ev) => attach(i, ev.target.files?.[0])} />
                  <FormHelperText error={!!e.receipt}>{e.receipt || (it.receipt ? it.receipt.name.slice(0, 18) : " ")}</FormHelperText>
                </Box>
                <IconButton aria-label="Remove line" disabled={form.items.length === 1} onClick={() => set("items", form.items.filter((_, j) => j !== i))}><DeleteOutlineRounded /></IconButton>
              </Box>
            );
          })}
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Button startIcon={<AddRounded />} onClick={() => set("items", [...form.items, blankItem()])} disabled={form.items.length >= 20}>Add line</Button>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 800 }}>Total ₹{fmtNum(total)}</Typography>
          </Stack>
          {show("items") && <Alert severity="error">{errors.items}</Alert>}
          <FlagList flags={flags} dense />
          <FormControlLabel control={<Checkbox checked={form.declaration} onChange={(e) => set("declaration", e.target.checked)} />} label={<Typography sx={{ fontSize: "0.65rem" }}>I confirm these are genuine business expenses, not claimed before, and the receipts are original. *</Typography>} />
          {show("declaration") && <FormHelperText error>{errors.declaration}</FormHelperText>}
          <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>Receipts are required above ₹{data.settings.receipt_required_above} and always for travel, stay, phone and client spends. Claim within {data.settings.expense_claim_window_days} days.</Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit}>Submit claim</Button>
      </DialogActions>
    </Dialog>
  );
}

function AdvanceDialog({ open, onClose }) {
  const { data, user, createRequest, notifyToast } = useStore();
  const fileRef = useRef(null);
  const [form, setForm] = useState({});
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (open) {
      setForm({ request_date: isoDate(), request_amount: "", required_by: isoDate(Date.now() + 3 * 86400000), purpose: "", note: "", attachment: null });
      setTried(false);
    }
  }, [open]);
  const { errors } = validateAdvance(form, { settings: data.settings, requests: data.requests, emp: user });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const show = (k) => tried && errors[k];
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Advance amount request</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Employee" value={`${user.full_name} (${user.employee_code})`} disabled />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Request date *" type="date" value={form.request_date || ""} onChange={(e) => set("request_date", e.target.value)} error={!!show("request_date")} helperText={show("request_date") || " "} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Request amount *" value={form.request_amount || ""} onChange={(e) => set("request_amount", e.target.value.replace(/[^\d]/g, ""))} error={!!show("request_amount")} helperText={show("request_amount") || `Up to ₹${fmtNum(data.settings.max_advance_inr)}`} slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }} />
          </Stack>
          <TextField label="Required by *" type="date" value={form.required_by || ""} onChange={(e) => set("required_by", e.target.value)} error={!!show("required_by")} helperText={show("required_by") || " "} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Reason *" multiline minRows={3} value={form.purpose || ""} onChange={(e) => set("purpose", e.target.value)} error={!!show("purpose")} helperText={show("purpose") || "Enter the reason for which you are taking the advance"} />
          <TextField label="Note" multiline minRows={2} value={form.note || ""} onChange={(e) => set("note", e.target.value)} />
          <Box>
            <Button size="small" variant="outlined" startIcon={<AttachFileRounded />} onClick={() => fileRef.current?.click()}>{form.attachment ? form.attachment.name : "Attachment (optional)"}</Button>
            <input ref={fileRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={async (e) => { const f = e.target.files?.[0]; if (f) set("attachment", { name: f.name, size: f.size, type: f.type, data_url: await readFileAsDataUrl(f) }); }} />
          </Box>
          <Alert severity="info">Approved amount, disbursed date and approver are filled in by your manager and Finance. Settle the advance with an expense claim within {data.settings.advance_settle_days} days of disbursement.</Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { setTried(true); if (Object.keys(errors).length) return; const r = createRequest("advance", form); if (!r.ok) return notifyToast(Object.values(r.errors)[0], "error"); notifyToast(`Advance ${r.id} sent for approval.`); onClose(); }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ExpensesPage() {
  const { data, user } = useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("claims");
  const [claimOpen, setClaimOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const noPolicy = user.expense_policy === "none";
  // v10.6: contract / freelance workers have no advance amount — they claim expenses only.
  const noAdvance = ["contract", "freelance", "consultant", "agency", "temporary", "intern", "apprentice"].includes(data.employees.find((e) => e.employee_code === user.employee_code)?.worker_type);
  const claims = data.requests.filter((r) => r.type === "expense" && r.employee_code === user.employee_code);
  const advances = data.requests.filter((r) => r.type === "advance" && r.employee_code === user.employee_code);
  const y = String(new Date().getFullYear());
  const claimedYear = claims.filter((c) => c.created_at.startsWith(y) && c.status !== "Cancelled" && c.payment_mode !== "company_paid").reduce((s, c) => s + expenseTotal(c.items), 0);
  const paid = claims.filter((c) => c.status === "Paid" && c.payment_mode !== "company_paid").reduce((s, c) => s + (c.approved_amount ?? expenseTotal(c.items)), 0);
  const pendingAmt = claims.filter((c) => ["Pending", "Approved"].includes(c.status) && c.payment_mode !== "company_paid").reduce((s, c) => s + expenseTotal(c.items), 0);
  const openAdv = advances.filter((a) => a.status === "Disbursed" && !a.settled).reduce((s, a) => s + a.approved_amount, 0);

  return (
    <>
      <PageHeader eyebrow="ME · EXPENSES & TRAVEL" title="Expenses & travel" subtitle={noAdvance ? "Claim business spends with receipts. Your manager approves first, then Finance pays." : "Claim business spends and request advances. Your manager approves first, then Finance pays."} actions={<>{!noAdvance && <Button variant="outlined" startIcon={<PaymentsRounded />} disabled={noPolicy} onClick={() => setAdvOpen(true)}>Request advance</Button>}<Button variant="contained" startIcon={<AddRounded />} disabled={noPolicy} onClick={() => setClaimOpen(true)}>New expense claim</Button></>} />
      {noPolicy && <Alert severity="warning" sx={{ mb: 2 }}>Expense policy is not assigned yet. Please contact your HR administration to assign an expense policy.</Alert>}
      <Stack spacing={2.5}>
        <Grid min={190}>
          <StatCard label={`Claimed in ${y}`} value={`₹${fmtNum(claimedYear)}`} icon={<ReceiptLongRounded />} />
          <StatCard label="Reimbursed" value={`₹${fmtNum(paid)}`} tone="good" />
          <StatCard label="Awaiting approval or payment" value={`₹${fmtNum(pendingAmt)}`} tone="warn" />
          {!noAdvance && <StatCard label="Advance to settle" value={`₹${fmtNum(openAdv)}`} tone="info" hint={openAdv ? "Adjust it in your next claim" : "Nothing outstanding"} />}
        </Grid>
        <SectionCard noPad>
          <Box sx={{ px: 1.5, pt: 1, borderBottom: "1px solid #edf0ec" }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab value="claims" label={`Expense claims (${claims.length})`} sx={{ minHeight: 44, fontSize: "0.7rem" }} />
              {!noAdvance && <Tab value="advances" label={`Advances (${advances.length})`} sx={{ minHeight: 44, fontSize: "0.7rem" }} />}
              <Tab value="policy" label="Expense policy" sx={{ minHeight: 44, fontSize: "0.7rem" }} />
            </Tabs>
          </Box>
          {tab === "claims" && (claims.length === 0 ? <EmptyState title="No claims yet" text="Submit your first claim with receipts." /> : (
            <TableWrap>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead><TableRow><TableCell>Claim</TableCell><TableCell>Title</TableCell><TableCell align="right">Lines</TableCell><TableCell align="right">Claimed</TableCell><TableCell align="right">Approved</TableCell><TableCell>Submitted</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {claims.map((c) => (
                    <TableRow key={c.request_id} hover sx={{ cursor: "pointer" }} onClick={() => setParams({ req: c.request_id })}>
                      <TableCell><Mono>{c.request_id}</Mono></TableCell>
                      <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 600 }}>{c.title}</Typography><Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{c.project || "No project"}{c.source?.app ? ` · from ${SOURCE_LABEL(c.source.app)}` : ""}{c.payment_mode === "company_paid" ? " · company-paid" : ""}</Typography></TableCell>
                      <TableCell align="right">{c.items.length}</TableCell>
                      <TableCell align="right">₹{fmtNum(expenseTotal(c.items))}</TableCell>
                      <TableCell align="right">{c.approved_amount != null ? `₹${fmtNum(c.approved_amount)}` : "—"}</TableCell>
                      <TableCell>{fmtDate(c.created_at)}</TableCell>
                      <TableCell><RequestStatus r={c} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          ))}
          {tab === "advances" && (advances.length === 0 ? <EmptyState title="No advances" text="Request an advance before a trip or event." /> : (
            <TableWrap>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead><TableRow><TableCell>Advance</TableCell><TableCell>Request date</TableCell><TableCell align="right">Requested</TableCell><TableCell align="right">Approved</TableCell><TableCell>Disbursed</TableCell><TableCell>Reason</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {advances.map((a) => (
                    <TableRow key={a.request_id} hover sx={{ cursor: "pointer" }} onClick={() => setParams({ req: a.request_id })}>
                      <TableCell><Mono>{a.request_id}</Mono></TableCell>
                      <TableCell>{fmtDate(a.request_date)}</TableCell>
                      <TableCell align="right">₹{fmtNum(a.request_amount)}</TableCell>
                      <TableCell align="right">{a.approved_amount != null ? `₹${fmtNum(a.approved_amount)}` : "—"}</TableCell>
                      <TableCell>{fmtDate(a.disbursed_date)}</TableCell>
                      <TableCell sx={{ maxWidth: 220 }}><Typography noWrap sx={{ fontSize: "0.65rem" }}>{a.purpose}</Typography>{a.source?.app && <Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>from {SOURCE_LABEL(a.source.app)}</Typography>}</TableCell>
                      <TableCell><RequestStatus r={a} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          ))}
          {tab === "policy" && (
            <Box sx={{ p: 2 }}>
              <KeyVal cols={3} items={[["Your policy", user.expense_policy === "sales" ? "Sales & travel" : user.expense_policy === "none" ? "Not assigned" : "Standard"], ["Receipt required above", `₹${data.settings.receipt_required_above}`], ["Claim window", `${data.settings.expense_claim_window_days} days`], ["Maximum advance", `₹${fmtNum(data.settings.max_advance_inr)}`], ["Settle advance within", `${data.settings.advance_settle_days} days`], ["Approval", data.settings.workflow.expense === "manager" ? "Manager" : "Manager, then Finance"]]} />
              <TableWrap>
                <Table size="small" sx={{ mt: 2, minWidth: 420 }}>
                  <TableHead><TableRow><TableCell>Category</TableCell><TableCell align="right">Limit per line</TableCell><TableCell>Receipt</TableCell></TableRow></TableHead>
                  <TableBody>{data.expenseCategories.map((c) => <TableRow key={c.code}><TableCell>{c.name}</TableCell><TableCell align="right">₹{fmtNum(c.limit)}</TableCell><TableCell>{c.receipt_always ? "Always" : `Above ₹${data.settings.receipt_required_above}`}</TableCell></TableRow>)}</TableBody>
                </Table>
              </TableWrap>
            </Box>
          )}
        </SectionCard>
      </Stack>
      <ExpenseClaimDialog open={claimOpen} onClose={() => setClaimOpen(false)} />
      <AdvanceDialog open={advOpen} onClose={() => setAdvOpen(false)} />
      <RequestDrawer id={params.get("req")} onClose={() => setParams({})} />
    </>
  );
}
