// My finances (Keka "My Finances" + PeopleHR "Finance"): pay, tax, salary loans.
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MyPayslips } from "../components/pay/PayslipViews.jsx";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { AddRounded, DownloadRounded } from "@mui/icons-material";
import { useStore } from "../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Mono, TableWrap, EmptyState, KeyVal, Tag } from "../components/kit/UI.jsx";
import { RequestDrawer, RequestStatus } from "../components/kit/Requests.jsx";
import { validateLoan } from "../lib/requests.js";
import { fmtNum, fmtDate, isoDate } from "../lib/utils.js";

// Indian income tax estimate (FY 2025-26 slabs). Illustrative only; payroll computes the real TDS.
function slabTax(income, slabs) {
  let tax = 0;
  let prev = 0;
  for (const [upto, rate] of slabs) {
    if (income > prev) tax += (Math.min(income, upto) - prev) * rate;
    prev = upto;
  }
  return tax;
}
export function taxEstimate(emp, declared80c = 150000, declared80d = 25000) {
  const gross = emp.monthly_gross * 12;
  if (emp.tax_regime === "old") {
    const taxable = Math.max(0, gross - 50000 - Math.min(declared80c, 150000) - declared80d);
    let tax = slabTax(taxable, [[250000, 0], [500000, 0.05], [1000000, 0.2], [Infinity, 0.3]]);
    if (taxable <= 500000) tax = 0;
    return { gross, taxable, tax: Math.round(tax * 1.04), regime: "Old" };
  }
  const taxable = Math.max(0, gross - 75000);
  let tax = slabTax(taxable, [[400000, 0], [800000, 0.05], [1200000, 0.1], [1600000, 0.15], [2000000, 0.2], [2400000, 0.25], [Infinity, 0.3]]);
  if (taxable <= 1200000) tax = 0;
  return { gross, taxable, tax: Math.round(tax * 1.04), regime: "New" };
}
function fyMonthsElapsed() {
  const d = new Date();
  const m = d.getMonth(); // 0 = Jan
  return m >= 3 ? m - 2 : m + 10; // April = 1
}

function ManageTax() {
  const { user, updateProfile, notifyToast } = useStore();
  const est = taxEstimate(user);
  const alt = taxEstimate({ ...user, tax_regime: user.tax_regime === "old" ? "new" : "old" });
  const paid = Math.round((est.tax / 12) * fyMonthsElapsed());
  const fyStart = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const [confirm, setConfirm] = useState(false);
  const declarations = [
    ["80C · PF, PPF, ELSS, life insurance", 150000, 150000, 0],
    ["80D · Health insurance premium", 25000, 0, 0],
    ["HRA · Rent paid", 240000, 0, 0],
    ["24(b) · Home loan interest", 0, 0, 0],
  ];
  return (
    <Stack spacing={2.5}>
      <Alert severity="info" action={<Button size="small" onClick={() => setConfirm(true)}>Switch to {user.tax_regime === "old" ? "new" : "old"} regime</Button>}>
        Your income and tax liability is being computed as per the <b>{est.regime} Tax Regime</b>. Under the {alt.regime.toLowerCase()} regime your estimated tax would be ₹{fmtNum(alt.tax)}.
      </Alert>
      <Grid min={240}>
        <SectionCard title="Investment declaration" action={<Tag tone="bad">Closed</Tag>}>
          <Typography sx={{ fontSize: "0.65rem", color: "#78827b" }}>You cannot add or edit declarations as the investment declaration window has lapsed.</Typography>
        </SectionCard>
        <SectionCard title="Proof submission" action={<Tag tone="good">Open</Tag>}>
          <Typography sx={{ fontSize: "0.65rem", color: "#78827b" }}>Current window till 20 Jan {fyStart + 1}. Upload rent receipts and investment proofs from Documents.</Typography>
        </SectionCard>
      </Grid>
      <Grid min={200}>
        <StatCard label="Net taxable income" value={`₹${fmtNum(est.taxable)}`} hint={`Gross ₹${fmtNum(est.gross)} less deductions`} />
        <StatCard label="Total tax payable" value={`₹${fmtNum(est.tax)}`} tone="warn" hint="Including 4% cess (estimate)" />
        <StatCard label="Tax already paid" value={`₹${fmtNum(paid)}`} tone="good" hint={`TDS for ${fyMonthsElapsed()} month(s) of FY ${fyStart}-${String(fyStart + 1).slice(2)}`} />
      </Grid>
      <SectionCard title="My declarations" subtitle={`FY ${fyStart}-${String(fyStart + 1).slice(2)}`} noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 560 }}>
            <TableHead><TableRow><TableCell>Declaration</TableCell><TableCell align="right">Declared</TableCell><TableCell align="right">Proof submitted</TableCell><TableCell align="right">Rejected</TableCell><TableCell align="right">Accepted</TableCell></TableRow></TableHead>
            <TableBody>
              {declarations.map(([n, d, p, r]) => (
                <TableRow key={n}><TableCell>{n}</TableCell><TableCell align="right">₹{fmtNum(d)}</TableCell><TableCell align="right">₹{fmtNum(p)}</TableCell><TableCell align="right">₹{fmtNum(r)}</TableCell><TableCell align="right">₹{fmtNum(p - r)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        {est.regime === "New" && <Typography sx={{ p: 1.5, fontSize: "0.6rem", color: "#78827b" }}>Most deductions do not apply under the new regime; they are kept for reference if you switch.</Typography>}
      </SectionCard>
      <Grid min={260}>
        <SectionCard title="Form 130 (formerly Form 16)" subtitle="Salary, deductions and tax paid for filing returns">
          <Stack spacing={1}>
            <Typography sx={{ fontSize: "0.65rem" }}>APR {fyStart - 1} – MAR {fyStart}</Typography>
            <Alert severity="warning">Form 130 has not been released by the admin for the selected financial year.</Alert>
          </Stack>
        </SectionCard>
        <SectionCard title="Form 124 (formerly Form 12BB)" subtitle="Proposed investments and expenses that are tax deductible">
          <Stack spacing={1}>
            <Typography sx={{ fontSize: "0.65rem" }}>APR {fyStart} – MAR {fyStart + 1}</Typography>
            <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => notifyToast("Form 124 is generated by payroll; in this demo it is not a real file.", "info")}>Download Form 124</Button>
          </Stack>
        </SectionCard>
        <SectionCard title="Tax filing" subtitle={`Due date for FY ${fyStart - 1}-${String(fyStart).slice(2)} returns was 31 Jul ${fyStart}`}>
          <Typography sx={{ fontSize: "0.65rem", color: "#78827b" }}>File your ITR with any e-filing partner or on the income-tax portal using Form 130.</Typography>
        </SectionCard>
      </Grid>
      <Dialog open={confirm} onClose={() => setConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Switch to the {user.tax_regime === "old" ? "new" : "old"} regime?</DialogTitle>
        <DialogContent><Typography sx={{ fontSize: "0.7rem" }}>Estimated yearly tax changes from ₹{fmtNum(est.tax)} to ₹{fmtNum(alt.tax)}. TDS from the next payroll uses the new choice.</Typography></DialogContent>
        <DialogActions><Button color="inherit" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="contained" onClick={() => { const r = updateProfile({ tax_regime: user.tax_regime === "old" ? "new" : "old" }); notifyToast(r.ok ? "Tax regime updated." : "Could not update.", r.ok ? "success" : "error"); setConfirm(false); }}>Switch</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}

function LoanDialog({ open, onClose }) {
  const { data, user, createRequest, notifyToast } = useStore();
  const [form, setForm] = useState({});
  const [tried, setTried] = useState(false);
  // v10.6: loan clarity — default amount, salary bank, payslip upload, take-home, previous loans, Aadhaar & PAN.
  const maxAmt = Math.round((user.monthly_gross || 0) * (data.settings.loan_max_multiple || 1));
  const defaultAmt = Math.min(maxAmt, Math.round((user.monthly_gross || 0) / 1000) * 1000);
  const slip = [...(data.payslipBatches || [])].filter((b) => b.status === "Released").sort((a, b) => b.period.localeCompare(a.period)).map((b) => b.slips.find((x) => x.employee_code === user.employee_code)).find(Boolean);
  const takeHome = Math.round(slip?.values?.NET_PAY || slip?.net || (user.monthly_gross || 0) * 0.88);
  const prev = data.requests.filter((r) => r.type === "loan" && r.employee_code === user.employee_code);
  useEffect(() => {
    if (open) {
      setForm({ amount: String(defaultAmt || ""), tenure_months: "6", reason: "", start_month: isoDate(Date.now() + 30 * 86400000).slice(0, 7), payslip_file: "", aadhaar_last4: "", pan: user.pan || "" });
      setTried(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const { errors, emi } = validateLoan(form, { settings: data.settings, emp: user, requests: data.requests });
  const extraErr = { ...(form.payslip_file ? {} : { payslip_file: "Upload your latest payslip." }), ...(/^\d{4}$/.test(form.aadhaar_last4 || "") ? {} : { aadhaar_last4: "Enter the last 4 digits of your Aadhaar." }), ...(/^[A-Z]{5}\d{4}[A-Z]$/.test((form.pan || "").toUpperCase()) ? {} : { pan: "Enter a valid PAN (like ABCDE1234F)." }) };
  const allErr = { ...errors, ...extraErr };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const show = (k) => tried && allErr[k];
  const emiPct = takeHome ? Math.round((emi / takeHome) * 100) : 0;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Request salary loan</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 1, p: 1.2, borderRadius: 2, background: "#E6F6EE" }}>
            {[["Eligible up to", `₹${fmtNum(maxAmt)}`], ["Default amount", `₹${fmtNum(defaultAmt)}`], ["Monthly take-home", `₹${fmtNum(takeHome)}`], ["Salary bank", `${user.bank_name || "—"} ${user.bank_account ? `••${String(user.bank_account).slice(-4)}` : ""}`]].map(([l, v]) => <Box key={l}><Typography sx={{ fontSize: "0.58rem", color: "#5d6b70" }}>{l}</Typography><Typography sx={{ fontSize: "0.74rem", fontWeight: 800 }}>{v}</Typography></Box>)}
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField fullWidth label="Loan amount *" value={form.amount || ""} onChange={(e) => set("amount", e.target.value.replace(/\D/g, ""))} error={!!show("amount")} helperText={show("amount") || `Default ₹${fmtNum(defaultAmt)} · up to ₹${fmtNum(maxAmt)}`} slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }} />
            <TextField fullWidth label="Tenure (months) *" value={form.tenure_months || ""} onChange={(e) => set("tenure_months", e.target.value.replace(/\D/g, ""))} error={!!show("tenure_months")} helperText={show("tenure_months") || `1 to ${data.settings.loan_max_tenure_months}`} />
          </Stack>
          <TextField label="First EMI month" type="month" value={form.start_month || ""} onChange={(e) => set("start_month", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField fullWidth label="PAN *" value={form.pan || ""} onChange={(e) => set("pan", e.target.value.toUpperCase())} error={!!show("pan")} helperText={show("pan") || "As on your PAN card"} />
            <TextField fullWidth label="Aadhaar (last 4 digits) *" value={form.aadhaar_last4 || ""} onChange={(e) => set("aadhaar_last4", e.target.value.replace(/\D/g, "").slice(0, 4))} error={!!show("aadhaar_last4")} helperText={show("aadhaar_last4") || "Only the last 4 digits are stored"} />
          </Stack>
          <Box>
            <Button size="small" variant="outlined" component="label">{form.payslip_file || "Upload latest payslip *"}<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) set("payslip_file", f.name); }} /></Button>
            {show("payslip_file") && <Typography sx={{ fontSize: "0.62rem", color: "error.main", mt: 0.4 }}>{allErr.payslip_file}</Typography>}
          </Box>
          <Box sx={{ p: 1.2, borderRadius: 2, border: "1px solid #e3e9ec" }}>
            <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, mb: 0.4 }}>Previous loans ({prev.length})</Typography>
            {prev.length === 0 ? <Typography sx={{ fontSize: "0.64rem", color: "#78827b" }}>No previous salary loans.</Typography> : prev.map((l) => <Typography key={l.request_id} sx={{ fontSize: "0.64rem" }}>{l.request_id} · ₹{fmtNum(l.approved_amount ?? l.amount)} · {l.tenure_months} mo · {l.status}{l.closed ? " · closed" : ""}</Typography>)}
          </Box>
          <TextField label="Reason *" multiline minRows={2} value={form.reason || ""} onChange={(e) => set("reason", e.target.value)} error={!!show("reason")} helperText={show("reason") || " "} />
          <Alert severity={emiPct > 40 ? "warning" : "info"}>EMI ₹{fmtNum(emi)} a month ({emiPct}% of your take-home), deducted from salary. Interest-free. Finance confirms the amount you get — it can be lower than requested.</Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { setTried(true); if (Object.keys(allErr).length) return; const r = createRequest("loan", { ...form, pan: (form.pan || "").toUpperCase(), take_home: takeHome, bank_last4: String(user.bank_account || "").slice(-4) }); if (!r.ok) return notifyToast(Object.values(r.errors)[0], "error"); notifyToast(`Loan request ${r.id} sent — Finance confirms the amount you get.`); onClose(); }}>Send request</Button>
      </DialogActions>
    </Dialog>
  );
}

// v10.4: Pay & benefits → "My payslips" (view="pay") and "Manage tax, salary & loan" (view="manage") are separate sub-tabs.
import { loanAccessOf } from "./v107/Extras.jsx";

export default function FinancesPage({ view }) {
  const { data, user } = useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "tax" ? "tax" : params.get("tab") === "loans" ? "loans" : view === "manage" ? "tax" : "pay");
  const [loanOpen, setLoanOpen] = useState(false);
  const loans = data.requests.filter((r) => r.type === "loan" && r.employee_code === user.employee_code);
  // v10.7: Finance enables / disables the loan request; loans open after 1 year of employment.
  const access = loanAccessOf(data, data.employees.find((e) => e.employee_code === user.employee_code) || user);
  return (
    <>
      <PageHeader eyebrow={view === "manage" ? "PAY & BENEFITS · TAX, SALARY & LOAN" : "PAY & BENEFITS · MY PAYSLIPS"} title={view === "manage" ? "Manage tax, salary & loan" : view === "pay" ? "My payslips" : "My finances"} subtitle={`Current compensation ₹${fmtNum(user.monthly_gross * 12)} / annum · pay cycle monthly`} />
      {view !== "pay" && (
        <Box sx={{ mb: 2, borderBottom: "1px solid #e5eae4" }}>
          <Tabs value={tab === "pay" && view === "manage" ? "tax" : tab} onChange={(_, v) => setTab(v)}>
            {!view && <Tab value="pay" label="My pay" sx={{ fontSize: "0.7rem" }} />}
            <Tab value="tax" label="Manage tax" sx={{ fontSize: "0.7rem" }} />
            <Tab value="loans" label={`Salary loan (${loans.length})`} sx={{ fontSize: "0.7rem" }} />
          </Tabs>
        </Box>
      )}
      {(view === "pay" || (!view && tab === "pay")) && <MyPayslips />}
      {view !== "pay" && (tab === "tax" || (view === "manage" && tab === "pay")) && <ManageTax />}
      {view !== "pay" && tab === "loans" && (
        <SectionCard title="Salary loans" subtitle={`Interest-free, up to ${data.settings.loan_max_multiple}× monthly gross, repaid over at most ${data.settings.loan_max_tenure_months} months`} action={<Button variant="contained" size="small" startIcon={<AddRounded />} disabled={!access.ok} onClick={() => setLoanOpen(true)}>Request loan</Button>} noPad>
          {!access.ok && <Alert severity="info" sx={{ m: 1.5, fontSize: "0.68rem" }}>{access.reason}</Alert>}
          {loans.length === 0 ? <EmptyState title="Sorry, your search returned no results" text="You have no salary loan requests." /> : (
            <TableWrap>
              <Table size="small" sx={{ minWidth: 620 }}>
                <TableHead><TableRow><TableCell>Loan</TableCell><TableCell align="right">Requested</TableCell><TableCell align="right">Amount you get (Finance)</TableCell><TableCell align="right">Tenure</TableCell><TableCell align="right">EMI</TableCell><TableCell>Requested</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {loans.map((l) => (
                    <TableRow key={l.request_id} hover sx={{ cursor: "pointer" }} onClick={() => setParams({ req: l.request_id })}>
                      <TableCell><Mono>{l.request_id}</Mono></TableCell>
                      <TableCell align="right">₹{fmtNum(l.amount)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{l.approved_amount != null ? `₹${fmtNum(l.approved_amount)}` : l.status === "Pending" ? "Awaiting Finance" : `₹${fmtNum(l.amount)}`}</TableCell>
                      <TableCell align="right">{l.tenure_months} mo</TableCell>
                      <TableCell align="right">₹{fmtNum(l.emi)}</TableCell>
                      <TableCell>{fmtDate(l.created_at)}</TableCell>
                      <TableCell><RequestStatus r={l} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </SectionCard>
      )}
      <LoanDialog open={loanOpen} onClose={() => setLoanOpen(false)} />
      <RequestDrawer id={params.get("req")} onClose={() => setParams({})} />
    </>
  );
}


